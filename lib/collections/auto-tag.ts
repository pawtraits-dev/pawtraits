/**
 * Auto-tagging (server only). When a catalogue design is saved, Claude looks at the picture,
 * its prompt and its theme, and returns which collections it belongs in (from the fixed list),
 * the sports team if the outfit is clearly a team kit, and 5–10 descriptive tags. Saved
 * straight away; editable in Admin → Collections → Tagging. Never throws.
 *
 * Certain signals skip the model: a design whose outfit is a team kit is that team; a quiz
 * breed picture is its Pawsonality type.
 */
import Anthropic from '@anthropic-ai/sdk';
import { getSetting } from '@/lib/app-settings';
import { OCCASIONS, ZODIAC } from './definitions';
import { LEAGUES, SPORTS_TEAMS } from './sports-teams';

const MODEL = 'claude-haiku-4-5-20251001';
export const MAX_TAGS = 10;

/** Words that describe every design, or are internal, so are never shown as tags */
const BLOCKED_TAGS = new Set([
  'ai', 'ai generated', 'ai-generated', 'gemini', 'gemini generated', 'midjourney', 'variation', 'admin upload', 'print quality',
  'pet', 'pets', 'animal', 'dog', 'cat', 'puppy', 'kitten', 'portrait', 'pet portrait', 'painting', 'art', 'artwork', 'digital art',
  'illustration', 'image', 'picture', 'photo', 'cute', 'adorable', 'anthropomorphic', 'anthropomorphised', 'anthropomorphized',
  'pawtraits', 'pawtrait', 'quiz generated', 'portrait format', 'landscape format', 'square format',
]);

export interface TagAnswer { collections: string[]; team: string | null; tags: string[]; confidence: number }

export interface TagContext {
  pawsonalities: { code: string; name: string; path: string }[];
}

function collectionList(ctx: TagContext): string {
  const occ = OCCASIONS.map(o => `occasions/${o.slug} (${o.name})`).join('; ');
  const zod = ZODIAC.map(z => `zodiac/${z.slug}`).join('; ');
  const paw = ctx.pawsonalities.map(p => `${p.path} (${p.name})`).join('; ');
  return `Occasions: ${occ}\nZodiac signs: ${zod}\nPawsonality types: ${paw}`;
}

function teamList(): string {
  return (Object.keys(LEAGUES) as (keyof typeof LEAGUES)[]).map(lg =>
    `${LEAGUES[lg].name}: ` + SPORTS_TEAMS.filter(t => t.league === lg).map(t => `sports/${lg}/${t.slug} = ${t.short} (${t.colours.map(c => c.name).join('/')})`).join('; '),
  ).join('\n');
}

export function buildPrompt(ctx: TagContext, info: { prompt?: string | null; description?: string | null; theme?: string | null; breed?: string | null; outfit?: string | null }): string {
  return `You are cataloguing an anthropomorphic pet portrait (a pet dressed and posed like a person) for a shop's browse and search.

About this design:
- Breed: ${info.breed || 'unknown'}
- Theme (internal): ${info.theme || 'none'}
- Outfit: ${info.outfit || 'not recorded'}
- Description: ${(info.description || '').slice(0, 400) || 'none'}
- Generation prompt: ${(info.prompt || '').slice(0, 800) || 'none'}

1. "collections": which of these the design clearly belongs in (usually 0 or 1; only if obvious from the picture or text, never a guess):
${collectionList(ctx)}
A design belongs to an occasion only if it visibly shows it (Christmas jumper, Santa hat, tree, pumpkins, birthday cake, hearts…). Zodiac or Pawsonality only if the text says so.

2. "team": the sports team ONLY if the outfit is unmistakably that team's kit by its colours and the sport (otherwise null). Use the path:
${teamList()}

3. "tags": 5 to ${MAX_TAGS} short lowercase tags a shopper might search or click: clothing and accessories (crown, tartan scarf, bow tie), props, setting (snow, library, beach), activity, mood, main colours. 1 to 3 words each. Not: the breed, "dog", "cat", "pet", "portrait", "cute", art style words, or anything about AI.

4. "confidence": 0 to 1, how sure you are about collections and team.

Reply with JSON only: {"collections": [...], "team": "sports/..."|null, "tags": [...], "confidence": 0.0}`;
}

export function cleanTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const r of raw) {
    const t = String(r ?? '').toLowerCase().replace(/[^a-z0-9 &-]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!t || t.length > 30 || t.split(' ').length > 3 || BLOCKED_TAGS.has(t) || BLOCKED_TAGS.has(t.replace(/-/g, ' '))) continue;
    if (!out.includes(t)) out.push(t);
  }
  return out.slice(0, MAX_TAGS);
}

/** Parse the model's reply against the known paths; anything unknown is dropped */
export function parseTagReply(text: string, validPaths: Set<string>): TagAnswer | null {
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return null;
  try {
    const v = JSON.parse(json);
    const collections = (Array.isArray(v.collections) ? v.collections : []).map(String)
      .filter((p: string) => validPaths.has(p) && !p.startsWith('sports/')).slice(0, 3);
    const team = typeof v.team === 'string' && validPaths.has(v.team) && /^sports\/[^/]+\/[^/]+$/.test(v.team) ? v.team : null;
    const confidence = Math.max(0, Math.min(1, Number(v.confidence) || 0));
    return { collections: Array.from(new Set(collections)), team, tags: cleanTags(v.tags), confidence };
  } catch {
    return null;
  }
}

let client: Anthropic | null = null;
function anthropic() {
  const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('No Claude API key');
  return (client ??= new Anthropic({ apiKey }));
}

function thumbUrl(row: any): string | null {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (cloud && row.cloudinary_public_id) return `https://res.cloudinary.com/${cloud}/image/upload/c_limit,w_768,h_768/f_jpg,q_80/${row.cloudinary_public_id}`;
  return /^https:\/\//.test(row.public_url || '') ? row.public_url : null;
}

async function askModel(prompt: string, imageUrl: string | null): Promise<string> {
  const content: any[] = [];
  if (imageUrl) {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(20_000) });
    if (res.ok) {
      const type = (res.headers.get('content-type') || '').split(';')[0];
      const media = type === 'image/png' || type === 'image/webp' ? type : 'image/jpeg';
      content.push({ type: 'image', source: { type: 'base64', media_type: media, data: Buffer.from(await res.arrayBuffer()).toString('base64') } });
    }
  }
  content.push({ type: 'text', text: prompt });
  const response = await anthropic().messages.create({ model: MODEL, max_tokens: 400, messages: [{ role: 'user', content }] });
  return response.content.map(c => (c.type === 'text' ? c.text : '')).join('');
}

export type ModelFn = (prompt: string, imageUrl: string | null) => Promise<string>;

/**
 * Tags one design and saves the result. Returns what was saved (or an error string).
 * `model` can be swapped in tests.
 */
export async function autoTagImage(supabase: any, imageId: string, opts: { model?: ModelFn; force?: boolean } = {}): Promise<{ ok: true; answer: TagAnswer } | { ok: false; error: string }> {
  try {
    const { data: row } = await supabase.from('image_catalog')
      .select('id, prompt_text, description, marketing_description, tags, display_tags, display_tags_edited, is_customer_generated, cloudinary_public_id, public_url, auto_tagged_at, breeds:breed_id (name), themes:theme_id (name), outfits:outfit_id (id, name, slug)')
      .eq('id', imageId).maybeSingle();
    if (!row) return { ok: false, error: 'not found' };
    if (row.is_customer_generated) return { ok: false, error: 'customer design' };
    if (row.auto_tagged_at && !opts.force) return { ok: false, error: 'already tagged' };

    const { data: cols } = await supabase.from('collections').select('id, path, name, kind, depth, outfit_id');
    const byPath = new Map<string, any>((cols ?? []).map((c: any) => [c.path, c]));
    const ctx: TagContext = { pawsonalities: (cols ?? []).filter((c: any) => c.kind === 'pawsonality' && c.depth === 1).map((c: any) => ({ code: c.path.split('/')[1], name: c.name, path: c.path })) };

    // Signals that don't need the model
    const sure: string[] = [];
    const teamByOutfit = row.outfits?.id ? (cols ?? []).find((c: any) => c.outfit_id === row.outfits.id) : null;
    if (teamByOutfit) sure.push(teamByOutfit.path);
    const quizCode = (row.tags ?? []).map((t: string) => /^pawsonality:([A-Z]{4})$/.exec(t)?.[1]).find(Boolean);
    if (quizCode && byPath.has(`pawsonalities/${quizCode.toLowerCase()}`)) sure.push(`pawsonalities/${quizCode.toLowerCase()}`);

    // Every pet's breed ("Beagle and Persian"), not just the first (multi-pet plan phase 1)
    const { data: pets } = await supabase.from('image_catalog_subjects').select('subject_order, breeds:breed_id (name)').eq('image_catalog_id', imageId).order('subject_order');
    const petBreeds = Array.from(new Set([row.breeds?.name, ...(pets ?? []).map((p: any) => p.breeds?.name)].filter(Boolean)));
    const breed = petBreeds.length > 1 ? `${(pets ?? []).length || petBreeds.length} pets: ${petBreeds.join(' and ')}` : petBreeds[0];
    const prompt = buildPrompt(ctx, { prompt: row.prompt_text, description: row.marketing_description || row.description, theme: row.themes?.name, breed, outfit: row.outfits?.name });
    const reply = await (opts.model ?? askModel)(prompt, thumbUrl(row));
    const answer = parseTagReply(reply, new Set(byPath.keys()));
    if (!answer) {
      await supabase.from('image_catalog').update({ auto_tag_error: 'Unreadable answer', auto_tagged_at: new Date().toISOString() }).eq('id', imageId);
      return { ok: false, error: 'unreadable answer' };
    }
    if (teamByOutfit) answer.team = teamByOutfit.path;
    const paths = Array.from(new Set([...sure, ...answer.collections, ...(answer.team ? [answer.team] : [])]));

    await supabase.from('image_catalog').update({
      ...(row.display_tags_edited ? {} : { display_tags: answer.tags }),
      auto_tag: { ...answer, model: MODEL, at: new Date().toISOString() },
      auto_tagged_at: new Date().toISOString(),
      auto_tag_error: null,
    }).eq('id', imageId);

    // Replace earlier automatic links; admin links and exclusions stay as they are
    await supabase.from('design_collections').delete().eq('image_id', imageId).eq('source', 'auto').eq('excluded', false);
    const rows = paths.map(p => byPath.get(p)).filter(Boolean).map((c: any) => ({ image_id: imageId, collection_id: c.id, source: 'auto' }));
    if (rows.length) await supabase.from('design_collections').upsert(rows, { onConflict: 'image_id,collection_id', ignoreDuplicates: true });
    return { ok: true, answer };
  } catch (err: any) {
    console.error('autoTagImage failed', imageId, err);
    try { await supabase.from('image_catalog').update({ auto_tag_error: String(err?.message || err).slice(0, 200) }).eq('id', imageId); } catch { /* ignore */ }
    return { ok: false, error: String(err?.message || err) };
  }
}

/** For save routes: tag a new design if auto-tagging is on (call inside next/server `after`) */
export async function autoTagNew(supabase: any, imageId: string | null | undefined): Promise<void> {
  if (!imageId) return;
  if (!(await getSetting('auto_tag_enabled'))) return;
  await autoTagImage(supabase, imageId);
}

/** Backfill: tags up to `limit` untagged catalogue designs, a few at a time. Designs that failed are
 * left for "Try failed ones again" so a broken design can't stall the run. */
/** Puts failed designs back in the queue */
export async function requeueFailed(supabase: any): Promise<number> {
  const { data } = await supabase.from('image_catalog').update({ auto_tag_error: null, auto_tagged_at: null })
    .not('auto_tag_error', 'is', null).or('is_customer_generated.is.null,is_customer_generated.eq.false').select('id');
  return (data ?? []).length;
}

export async function tagUntagged(supabase: any, limit = 12, opts: { model?: ModelFn } = {}): Promise<{ tagged: number; failed: number; remaining: number }> {
  const { data: rows } = await supabase.from('image_catalog').select('id')
    .is('auto_tagged_at', null).is('auto_tag_error', null).or('is_customer_generated.is.null,is_customer_generated.eq.false')
    .order('created_at', { ascending: false }).limit(Math.min(50, Math.max(1, limit)));
  let tagged = 0, failed = 0;
  const ids: string[] = (rows ?? []).map((r: any) => r.id);
  for (let i = 0; i < ids.length; i += 4) {
    const results = await Promise.all(ids.slice(i, i + 4).map(id => autoTagImage(supabase, id, { model: opts.model })));
    for (const r of results) r.ok ? tagged++ : failed++;
  }
  const { count } = await supabase.from('image_catalog').select('id', { count: 'exact', head: true })
    .is('auto_tagged_at', null).is('auto_tag_error', null).or('is_customer_generated.is.null,is_customer_generated.eq.false');
  return { tagged, failed, remaining: count ?? 0 };
}
