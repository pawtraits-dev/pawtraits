/**
 * Breed of the pet in a customer's uploaded photo (server only), for Admin > Customisations.
 * Customisations made from a saved pet already carry its breed; uploaded photos don't, so after
 * painting we ask Claude Haiku which breed it is and match the answer to the breeds table.
 * Result: customer_custom_images.pet_breed_id (when matched) and metadata.detected_breed
 * { animal, name, confidence, matched } with metadata.breed_source = 'detected'.
 * The same call also names the coat (colour / pattern), matched to the coats table: metadata.detected_coat
 * { name, matched } and, only when the row has no coat yet, pet_coat_id. Rows that already have a breed
 * but no coat can be filled in with { fillCoat: true } (a coat-only question; the breed is never changed).
 * Never throws.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createWithUsage } from '@/lib/ai/usage';
import { serviceClient } from '@/lib/qr/server';

const MODEL = 'claude-haiku-4-5-20251001';
let client: Anthropic | null = null;

type Breed = { id: string; name: string; animal_type: 'dog' | 'cat'; alternative_names: string[] | null };
let breedCache: { at: number; list: Breed[] } | null = null;

async function breeds(supabase: SupabaseClient): Promise<Breed[]> {
  if (breedCache && Date.now() - breedCache.at < 10 * 60_000) return breedCache.list;
  const { data } = await supabase.from('breeds').select('id, name, animal_type, alternative_names').eq('is_active', true);
  breedCache = { at: Date.now(), list: (data ?? []) as Breed[] };
  return breedCache.list;
}

type Coat = { id: string; name: string; animal_type: 'dog' | 'cat' };
let coatCache: { at: number; list: Coat[] } | null = null;

async function coats(supabase: SupabaseClient): Promise<Coat[]> {
  if (coatCache && Date.now() - coatCache.at < 10 * 60_000) return coatCache.list;
  const { data } = await supabase.from('coats').select('id, name, animal_type').eq('is_active', true);
  coatCache = { at: Date.now(), list: (data ?? []) as Coat[] };
  return coatCache.list;
}

const norm = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();

/** Match a breed name from the model to the breeds table (name, then alternative names) */
export function matchBreed(list: Breed[], animal: string, name: string): Breed | null {
  const n = norm(name);
  if (!n) return null;
  const pool = list.filter(b => b.animal_type === animal);
  return pool.find(b => norm(b.name) === n)
    ?? pool.find(b => (b.alternative_names ?? []).some(a => norm(a) === n))
    ?? pool.find(b => norm(b.name).replace(/ (dog|cat)$/, '') === n.replace(/ (dog|cat)$/, ''))
    ?? null;
}

/** Match a coat name from the model to the coats table (same animal only; "Black & White" = "black and white"; a trailing "coat" is ignored) */
export function matchCoat(list: Coat[], animal: string, name: string): Coat | null {
  const n = norm(name);
  if (!n || (animal !== 'dog' && animal !== 'cat')) return null;
  const pool = list.filter(c => c.animal_type === animal);
  const bare = (x: string) => x.replace(/ coat$/, '');
  return pool.find(c => norm(c.name) === n)
    ?? pool.find(c => bare(norm(c.name)) === bare(n))
    ?? null;
}

export interface BreedReply { animal: 'dog' | 'cat' | 'other'; breed: string; confidence: number; coat: string }

/** The model's JSON reply: { animal, breed, confidence, coat }. Null when there is no usable JSON. */
export function parseReply(text: string): BreedReply | null {
  const m = /\{[\s\S]*\}/.exec(text)?.[0];
  if (!m) return null;
  try {
    const v = JSON.parse(m);
    const animal = v.animal === 'dog' || v.animal === 'cat' ? v.animal : 'other';
    const confidence = Math.max(0, Math.min(1, Number(v.confidence) || 0));
    return { animal, breed: String(v.breed || '').slice(0, 80), confidence, coat: String(v.coat || '').slice(0, 60) };
  } catch { return null; }
}

/** Reply to the coat-only question: { coat }. Null when there is no usable JSON. */
export function parseCoatReply(text: string): { coat: string } | null {
  const m = /\{[\s\S]*\}/.exec(text)?.[0];
  if (!m) return null;
  try { return { coat: String(JSON.parse(m).coat || '').slice(0, 60) }; } catch { return null; }
}

/** A small JPEG of the pet photo (Cloudinary resizes it) as base64 */
async function photo(url: string): Promise<string | null> {
  const small = url.includes('/image/upload/') ? url.replace('/image/upload/', '/image/upload/c_limit,w_768,h_768,f_jpg,q_80/') : url;
  const res = await fetch(small);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer()).toString('base64');
}

const textOf = (res: any) => (res.content ?? []).map((c: any) => (c.type === 'text' ? c.text : '')).join('');
const coatNames = (list: Coat[], a: 'dog' | 'cat') => list.filter(c => c.animal_type === a).map(c => c.name).sort().join('; ');

/** Store the coat answer: metadata.detected_coat, and pet_coat_id only while it is still empty */
async function saveCoat(supabase: SupabaseClient, id: string, coat: Coat | null) {
  if (!coat) return;
  await supabase.from('customer_custom_images').update({ pet_coat_id: coat.id }).eq('id', id).is('pet_coat_id', null);
}

export async function detectPetBreed(
  customImageId: string,
  supabase: SupabaseClient = serviceClient(),
  opts: { fillCoat?: boolean } = {},
): Promise<'matched' | 'unmatched' | 'skipped' | 'failed'> {
  try {
    const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return 'skipped';
    const { data: row } = await supabase.from('customer_custom_images')
      .select('id, pet_breed_id, pet_coat_id, pet_image_url, metadata').eq('id', customImageId).maybeSingle();
    if (!row) return 'skipped';
    const meta: any = row.metadata ?? {};

    // Breed already known (saved pet, or tried before): only a coat can still be filled in, and only when asked
    if (row.pet_breed_id || meta.detected_breed) {
      if (!opts.fillCoat || row.pet_coat_id || meta.detected_coat) return 'skipped';
      return await detectCoatOnly(customImageId, supabase, row, apiKey);
    }

    const [list, coatList, image] = await Promise.all([breeds(supabase), coats(supabase), photo(row.pet_image_url)]);
    if (!image) return 'failed';
    const names = (a: 'dog' | 'cat') => list.filter(b => b.animal_type === a).map(b => b.name).sort().join('; ');
    const wantCoat = !row.pet_coat_id;
    const coatPrompt = wantCoat ? `
Also name the pet's coat colour or pattern, picking the closest name from these lists (use "Other" if none fits):
Dog coats: ${coatNames(coatList, 'dog')}
Cat coats: ${coatNames(coatList, 'cat')}` : '';

    client ??= new Anthropic({ apiKey });
    const res: any = await createWithUsage(client, { feature: 'pet-breed', customerImageId: customImageId }, {
      model: MODEL, max_tokens: wantCoat ? 120 : 80,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
        { type: 'text', text: `Which breed is the main pet in this photo? Pick the closest name from these lists when one fits; otherwise say "Mixed breed" (or "Domestic Shorthair" / "Domestic Longhair" for a non-pedigree cat).
Dogs: ${names('dog')}
Cats: ${names('cat')}${coatPrompt}
Reply with JSON only: {"animal": "dog" | "cat" | "other", "breed": "<name>", "confidence": <0 to 1>${wantCoat ? ', "coat": "<name>"' : ''}}` },
      ] }],
    });
    const reply = parseReply(textOf(res));
    if (!reply) return 'failed';

    const hit = reply.animal === 'other' ? null : matchBreed(list, reply.animal, reply.breed);
    const coatHit = wantCoat ? matchCoat(coatList, reply.animal, reply.coat) : null;
    const metadata = {
      ...meta,
      breed_source: 'detected',
      detected_breed: { animal: reply.animal, name: hit?.name ?? reply.breed, confidence: reply.confidence, matched: !!hit },
      ...(wantCoat ? { detected_coat: { name: coatHit?.name ?? reply.coat, matched: !!coatHit } } : {}),
    };
    await supabase.from('customer_custom_images')
      .update({ metadata, ...(hit ? { pet_breed_id: hit.id } : {}) })
      .eq('id', customImageId)
      .is('pet_breed_id', null);
    await saveCoat(supabase, customImageId, coatHit);
    return hit ? 'matched' : 'unmatched';
  } catch (err) {
    console.warn('detectPetBreed failed', customImageId, err);
    return 'failed';
  }
}

/** Rows that already have a breed (saved pet or detected) but no coat: ask for the coat only; the breed is left alone */
async function detectCoatOnly(
  customImageId: string, supabase: SupabaseClient,
  row: { pet_breed_id: string | null; pet_image_url: string; metadata: any }, apiKey: string,
): Promise<'matched' | 'unmatched' | 'failed'> {
  const meta: any = row.metadata ?? {};
  const list = await breeds(supabase);
  let breed: { name: string; animal: string } | null = null;
  if (row.pet_breed_id) {
    const known = list.find(b => b.id === row.pet_breed_id);
    if (known) breed = { name: known.name, animal: known.animal_type };
    else {
      const { data } = await supabase.from('breeds').select('name, animal_type').eq('id', row.pet_breed_id).maybeSingle();
      if (data) breed = { name: (data as any).name, animal: (data as any).animal_type };
    }
  }
  breed ??= meta.detected_breed ? { name: String(meta.detected_breed.name || ''), animal: String(meta.detected_breed.animal || '') } : null;
  const store = (detected_coat: { name: string; matched: boolean }) =>
    supabase.from('customer_custom_images').update({ metadata: { ...meta, detected_coat } }).eq('id', customImageId);

  if (!breed || (breed.animal !== 'dog' && breed.animal !== 'cat')) {
    await store({ name: '', matched: false }); // not a dog or cat: nothing to ask, and do not try again
    return 'unmatched';
  }
  const [coatList, image] = await Promise.all([coats(supabase), photo(row.pet_image_url)]);
  if (!image) return 'failed';
  client ??= new Anthropic({ apiKey });
  const res: any = await createWithUsage(client, { feature: 'pet-breed', customerImageId: customImageId }, {
    model: MODEL, max_tokens: 40,
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
      { type: 'text', text: `This ${breed.animal} is ${breed.name ? `a ${breed.name}` : 'of unknown breed'}. Which coat colour or pattern does it have? Pick the closest name from this list, or "Other" if none fits:
${coatNames(coatList, breed.animal)}
Reply with JSON only: {"coat": "<name>"}` },
    ] }],
  });
  const reply = parseCoatReply(textOf(res));
  if (!reply) return 'failed';
  const hit = matchCoat(coatList, breed.animal, reply.coat);
  await store({ name: hit?.name ?? reply.coat, matched: !!hit });
  await saveCoat(supabase, customImageId, hit);
  return hit ? 'matched' : 'unmatched';
}
