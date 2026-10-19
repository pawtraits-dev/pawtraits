/**
 * Breed of the pet in a customer's uploaded photo (server only), for Admin > Customisations.
 * Customisations made from a saved pet already carry its breed; uploaded photos don't, so after
 * painting we ask Claude Haiku which breed it is and match the answer to the breeds table.
 * Result: customer_custom_images.pet_breed_id (when matched) and metadata.detected_breed
 * { animal, name, confidence, matched } with metadata.breed_source = 'detected'.
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

function parseReply(text: string): { animal: 'dog' | 'cat' | 'other'; breed: string; confidence: number } | null {
  const m = /\{[\s\S]*\}/.exec(text)?.[0];
  if (!m) return null;
  try {
    const v = JSON.parse(m);
    const animal = v.animal === 'dog' || v.animal === 'cat' ? v.animal : 'other';
    const confidence = Math.max(0, Math.min(1, Number(v.confidence) || 0));
    return { animal, breed: String(v.breed || '').slice(0, 80), confidence };
  } catch { return null; }
}

/** A small JPEG of the pet photo (Cloudinary resizes it) as base64 */
async function photo(url: string): Promise<string | null> {
  const small = url.includes('/image/upload/') ? url.replace('/image/upload/', '/image/upload/c_limit,w_768,h_768,f_jpg,q_80/') : url;
  const res = await fetch(small);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer()).toString('base64');
}

export async function detectPetBreed(customImageId: string, supabase: SupabaseClient = serviceClient()): Promise<'matched' | 'unmatched' | 'skipped' | 'failed'> {
  try {
    const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return 'skipped';
    const { data: row } = await supabase.from('customer_custom_images')
      .select('id, pet_breed_id, pet_image_url, metadata').eq('id', customImageId).maybeSingle();
    if (!row || row.pet_breed_id || (row.metadata as any)?.detected_breed) return 'skipped';

    const [list, image] = await Promise.all([breeds(supabase), photo(row.pet_image_url)]);
    if (!image) return 'failed';
    const names = (a: 'dog' | 'cat') => list.filter(b => b.animal_type === a).map(b => b.name).sort().join('; ');

    client ??= new Anthropic({ apiKey });
    const res: any = await createWithUsage(client, { feature: 'pet-breed', customerImageId: customImageId }, {
      model: MODEL, max_tokens: 80,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
        { type: 'text', text: `Which breed is the main pet in this photo? Pick the closest name from these lists when one fits; otherwise say "Mixed breed" (or "Domestic Shorthair" / "Domestic Longhair" for a non-pedigree cat).
Dogs: ${names('dog')}
Cats: ${names('cat')}
Reply with JSON only: {"animal": "dog" | "cat" | "other", "breed": "<name>", "confidence": <0 to 1>}` },
      ] }],
    });
    const reply = parseReply((res.content ?? []).map((c: any) => (c.type === 'text' ? c.text : '')).join(''));
    if (!reply) return 'failed';

    const hit = reply.animal === 'other' ? null : matchBreed(list, reply.animal, reply.breed);
    const metadata = {
      ...((row.metadata as any) ?? {}),
      breed_source: 'detected',
      detected_breed: { animal: reply.animal, name: hit?.name ?? reply.breed, confidence: reply.confidence, matched: !!hit },
    };
    await supabase.from('customer_custom_images')
      .update({ metadata, ...(hit ? { pet_breed_id: hit.id } : {}) })
      .eq('id', customImageId)
      .is('pet_breed_id', null);
    return hit ? 'matched' : 'unmatched';
  } catch (err) {
    console.warn('detectPetBreed failed', customImageId, err);
    return 'failed';
  }
}
