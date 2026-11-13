/**
 * Captions, server side (see lib/captions/caption.ts).
 *   captionRows()          every Pawsonality type and Zodiac sign with its default and admin wording
 *   designCaption()        the caption for a design (its type/sign collection, or its parent's)
 *   bakeCaption()          a stored copy of a picture with the plate drawn on
 *   applyCaptionToDesign() / removeCaptionFromDesign()   on a catalogue design (and its versions)
 *   captionForNewVersion() a version just saved gets the plate when asked
 *   cleanPictureId()       the picture AI should work from (no words, no plate)
 */
import { v2 as cloudinary } from 'cloudinary';
import type { SupabaseClient } from '@supabase/supabase-js';
import { catalogVariants } from '@/lib/catalog/register-image';
import { cloudinaryService } from '@/lib/cloudinary';
import { getLiveQuiz } from '@/lib/quiz/server';
import { readWords } from '@/lib/picture-words';
import { CAPTION_MAX, ZODIAC_TAGLINES, captionLayer, cleanCaptionText, readCaptionOverlay, symbolPublicId, type Caption, type CaptionAnimal, type CaptionWording } from './caption';
import { zodiacSymbolSvg } from './zodiac-symbols';
import { readFrameOverlay, type FrameOverlay } from '@/lib/frames/frame';
import { TAROT } from '@/lib/tarot';

export const CAPTION_MIGRATION = 'Run db/migrations/2026-11-08-captions.sql first';

function configure() {
  if (!cloudinary.config().cloud_name) {
    cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });
  }
}

// ---------------------------------------------------------------------------------------------
// Wording

export interface CaptionRow {
  id: string; path: string; kind: 'pawsonality' | 'zodiac' | 'tarot'; slug: string; name: string;
  code: string | null;                       // Pawsonality code (ESFB), or the tarot card's Roman numeral
  defaults: Required<CaptionWording>;
  wording: CaptionWording;                   // admin's own (collections.metadata.caption)
  designs: number;
  heroImageId: string | null;
}

let rowsCache: { at: number; rows: Promise<CaptionRow[]> } | null = null;
/** Every type and sign, with the quiz's current names and taglines as defaults (cached 20 s) */
export function captionRows(supabase: SupabaseClient, fresh = false): Promise<CaptionRow[]> {
  if (fresh || !rowsCache || Date.now() - rowsCache.at > 20_000) {
    const rows = loadCaptionRows(supabase);
    rowsCache = { at: Date.now(), rows };
    rows.catch(() => { rowsCache = null; });
  }
  return rowsCache.rows;
}

async function loadCaptionRows(supabase: SupabaseClient): Promise<CaptionRow[]> {
  const [{ data: cols, error }, dogQuiz, catQuiz, { data: counts }] = await Promise.all([
    supabase.from('collections').select('id, path, kind, slug, name, metadata, hero_image_id, sort_order').in('kind', ['pawsonality', 'zodiac', 'tarot']).eq('depth', 1).order('kind').order('sort_order'),
    getLiveQuiz('pawsonality', 'dog').catch(() => null),
    getLiveQuiz('pawsonality', 'cat').catch(() => null),
    supabase.from('collection_design_counts').select('collection_id, designs'),
  ]);
  if (error) throw new Error(error.message);
  const types = (q: typeof dogQuiz) => new Map((q?.resultTypes ?? []).map(t => [t.code.toUpperCase(), t]));
  const dogs = types(dogQuiz), cats = types(catQuiz);
  const count = new Map((counts ?? []).map((c: any) => [c.collection_id, c.designs as number]));
  const tagline = (name: string, t?: string | null) => (t && t.trim().toLowerCase() !== name.trim().toLowerCase() ? t.trim() : '');

  return (cols ?? []).map((c: any) => {
    const meta = c.metadata ?? {};
    let defaults: Required<CaptionWording>;
    let code: string | null = null;
    if (c.kind === 'pawsonality') {
      code = String(meta.code || c.slug).toUpperCase();
      const d = dogs.get(code), k = cats.get(code);
      const dogName = d?.name || meta.dog_name || c.name, catName = k?.name || meta.cat_name || dogName;
      defaults = { title_dog: `${code} · ${dogName}`, title_cat: `${code} · ${catName}`, tagline_dog: tagline(dogName, d?.tagline), tagline_cat: tagline(catName, k?.tagline) };
    } else if (c.kind === 'tarot') {
      // The card's name is the title; taglines are for the owner to type in
      code = String(meta.numeral ?? TAROT.find(t => t.slug === c.slug)?.numeral ?? '') || null;
      defaults = { title_dog: c.name, title_cat: c.name, tagline_dog: '', tagline_cat: '' };
    } else {
      const z = ZODIAC_TAGLINES[c.slug] ?? { dog: '', cat: '' };
      defaults = { title_dog: c.name, title_cat: c.name, tagline_dog: z.dog, tagline_cat: z.cat };
    }
    const w = meta.caption && typeof meta.caption === 'object' ? meta.caption : {};
    const wording: CaptionWording = {};
    for (const k of ['title_dog', 'title_cat', 'tagline_dog', 'tagline_cat'] as const) if (typeof w[k] === 'string') wording[k] = w[k];
    return { id: c.id, path: c.path, kind: c.kind, slug: c.slug, name: c.name, code, defaults, wording, designs: count.get(c.id) ?? 0, heroImageId: c.hero_image_id };
  });
}

/** The caption for a type/sign and an animal: admin wording where set, else the default */
export function rowCaption(row: Pick<CaptionRow, 'kind' | 'slug' | 'defaults' | 'wording'>, animal: CaptionAnimal): Caption | null {
  const pick = (k: keyof CaptionWording) => (typeof row.wording[k] === 'string' ? row.wording[k]! : row.defaults[k]);
  const title = cleanCaptionText(pick(`title_${animal}`), CAPTION_MAX.title);
  if (!title) return null;
  const tagline = cleanCaptionText(pick(`tagline_${animal}`), CAPTION_MAX.tagline) || null;
  return { title, tagline, symbol: row.kind === 'zodiac' && zodiacSymbolSvg(row.slug) ? row.slug : null };
}

/** Save admin wording for one type/sign (an empty tagline means "no tagline"; null = back to default) */
export async function saveWording(supabase: SupabaseClient, collectionId: string, wording: Record<string, unknown>): Promise<void> {
  const { data: col, error } = await supabase.from('collections').select('metadata, kind').eq('id', collectionId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!col || !['pawsonality', 'zodiac', 'tarot'].includes((col as any).kind)) throw new Error('Not a Pawsonality type, Zodiac sign or tarot card');
  const meta = { ...((col as any).metadata ?? {}) };
  const next: CaptionWording = { ...(meta.caption ?? {}) };
  for (const k of ['title_dog', 'title_cat', 'tagline_dog', 'tagline_cat'] as const) {
    if (!(k in wording)) continue;
    const v = wording[k];
    if (v === null) delete next[k];
    else next[k] = cleanCaptionText(v, k.startsWith('title') ? CAPTION_MAX.title : CAPTION_MAX.tagline);
  }
  if (Object.keys(next).length) meta.caption = next; else delete meta.caption;
  rowsCache = null;
  const { error: e2 } = await supabase.from('collections').update({ metadata: meta }).eq('id', collectionId);
  if (e2) throw new Error(e2.message);
}

/** The type/sign collection a design is in (its own, else the design it was made from) */
export async function designRow(supabase: SupabaseClient, imageId: string, kinds: string[] = ['pawsonality', 'zodiac']): Promise<{ collectionId: string; animal: CaptionAnimal | null } | null> {
  const { data: img } = await supabase.from('image_catalog').select('id, variation_of, breed_id, breeds:breed_id (animal_type)').eq('id', imageId).maybeSingle();
  if (!img) return null;
  const animal = ((img as any).breeds?.animal_type === 'cat' ? 'cat' : (img as any).breeds?.animal_type === 'dog' ? 'dog' : null) as CaptionAnimal | null;
  for (const id of [img.id, (img as any).variation_of].filter(Boolean) as string[]) {
    const { data } = await supabase.from('design_collections').select('collection_id, source, created_at, collections!inner (kind, depth)').eq('image_id', id).eq('excluded', false).in('collections.kind', kinds).eq('collections.depth', 1).limit(50);
    // Deterministic: an admin's link beats an automatic one; then the oldest link; then the id
    const best = [...(data ?? [])].sort((a: any, b: any) =>
      Number(a.source === 'auto') - Number(b.source === 'auto') || String(a.created_at).localeCompare(String(b.created_at)) || String(a.collection_id).localeCompare(String(b.collection_id)))[0];
    if (best) return { collectionId: (best as any).collection_id, animal };
  }
  return null;
}

/**
 * The caption plate for a design: its Pawsonality type, worded for `animal` (the customer's
 * pet), else for the design's own breed's animal. Null otherwise: Zodiac and tarot designs use
 * the frame (lib/frames/), never the plate.
 */
export async function designCaption(supabase: SupabaseClient, imageId: string, animal?: CaptionAnimal | null): Promise<{ dog: Caption | null; cat: Caption | null; caption: Caption | null; designAnimal: CaptionAnimal } | null> {
  const d = await designRow(supabase, imageId, ['pawsonality']);
  if (!d) return null;
  const rows = await captionRows(supabase);
  const row = rows.find(r => r.id === d.collectionId);
  if (!row) return null;
  const designAnimal = d.animal ?? 'dog';
  const dog = rowCaption(row, 'dog'), cat = rowCaption(row, 'cat');
  const use = animal ?? designAnimal;
  return { dog, cat, caption: use === 'cat' ? cat : dog, designAnimal };
}

// ---------------------------------------------------------------------------------------------
// Drawing

let symbolsReady: Promise<void> | null = null;
/** Zodiac symbols on Cloudinary (uploaded once, from lib/captions/zodiac-symbols.ts) */
export function ensureSymbols(): Promise<void> {
  if (!symbolsReady) {
    symbolsReady = (async () => {
      configure();
      const res = await cloudinary.api.resources({ type: 'upload', prefix: 'pawtraits/zodiac-symbols/', max_results: 50 });
      const have = new Set<string>((res.resources ?? []).map((r: any) => r.public_id));
      for (const slug of Object.keys((await import('./zodiac-symbols')).ZODIAC_SYMBOL_PATHS)) {
        const id = symbolPublicId(slug);
        if (have.has(id)) continue;
        const svg = zodiacSymbolSvg(slug)!;
        await cloudinary.uploader.upload(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`, { public_id: id, overwrite: false, resource_type: 'image', tags: ['zodiac-symbol'] });
      }
    })().catch(e => { symbolsReady = null; throw e; });
  }
  return symbolsReady;
}

/** Store a copy of a Cloudinary picture with the plate drawn on (full size, PNG) */
export async function bakeCaption(publicId: string, caption: Caption, folder = 'pawtraits/catalog-captions'): Promise<{ public_id: string; secure_url: string; width: number; height: number; bytes: number }> {
  configure();
  if (caption.symbol) await ensureSymbols();
  const dims = await cloudinaryService.getSourceDimensions(publicId).catch(() => null);
  const aspect = dims?.width && dims?.height ? dims.width / dims.height : 2 / 3;
  const url = cloudinary.url(publicId, { secure: true, raw_transformation: captionLayer(caption, aspect), format: 'png' });
  const r = await cloudinary.uploader.upload(url, { folder, resource_type: 'image', tags: ['caption'] });
  return { public_id: r.public_id, secure_url: r.secure_url, width: r.width, height: r.height, bytes: r.bytes };
}

/** Make a stored picture the design's picture (and set other columns with it, e.g. caption_overlay or frame_overlay) */
export async function setDesignPicture(supabase: SupabaseClient, imageId: string, publicId: string, secureUrl: string, fields: Record<string, unknown>) {
  const variants = catalogVariants(publicId, secureUrl);
  const { error } = await supabase.from('image_catalog').update({
    cloudinary_public_id: publicId,
    public_url: variants.mid_size?.url || secureUrl,
    storage_path: `cloudinary:${publicId}`,
    image_variants: variants,
    cloudinary_version: null, cloudinary_signature: null,
    ...fields,
  }).eq('id', imageId);
  if (error) throw new Error(/caption_overlay/.test(error.message) ? CAPTION_MIGRATION : /frame_overlay/.test(error.message) ? 'Run db/migrations/2026-11-13-framed-cards.sql first' : error.message);
}

const setPicture = (supabase: SupabaseClient, imageId: string, publicId: string, secureUrl: string, overlay: unknown) =>
  setDesignPicture(supabase, imageId, publicId, secureUrl, { caption_overlay: overlay });

/** The frame on a design, or null (also before the framed-cards migration) */
export async function frameOverlayOf(supabase: SupabaseClient, imageId: string): Promise<FrameOverlay | null> {
  const { data, error } = await supabase.from('image_catalog').select('frame_overlay').eq('id', imageId).maybeSingle();
  return error ? null : readFrameOverlay((data as any)?.frame_overlay);
}

/**
 * Draw the plate on a design (worded for its own breed's animal). The picture without the plate
 * is kept as caption_overlay.clean_public_id, so it can be redrawn or taken off.
 */
export async function applyCaptionToDesign(supabase: SupabaseClient, imageId: string, given?: Caption | null): Promise<Caption> {
  const { data: row, error } = await supabase.from('image_catalog').select('id, cloudinary_public_id, caption_overlay').eq('id', imageId).maybeSingle();
  if (error) throw new Error(error.message.includes('caption_overlay') ? CAPTION_MIGRATION : error.message);
  if (!row?.cloudinary_public_id) throw new Error('Design not found');
  // Zodiac and tarot designs use the frame, never the plate
  if (await designRow(supabase, imageId, ['zodiac', 'tarot'])) throw new Error('Zodiac and tarot designs use the frame, not the caption plate');
  // A design has the plate or a frame, never both
  if ((await frameOverlayOf(supabase, imageId))?.applied) throw new Error('This design has a frame on. Take the frame off first.');
  const caption = given ?? (await designCaption(supabase, imageId))?.caption ?? null;
  if (!caption) throw new Error('This design is not in a Pawsonality type collection');
  const overlay = readCaptionOverlay((row as any).caption_overlay);
  // Already showing exactly this plate: nothing to redraw
  const a = overlay?.applied;
  if (a && a.title === caption.title && a.tagline === caption.tagline && a.symbol === caption.symbol) return caption;
  const clean = overlay?.clean_public_id ?? row.cloudinary_public_id;
  const baked = await bakeCaption(clean, caption);
  await setPicture(supabase, imageId, baked.public_id, baked.secure_url, { clean_public_id: clean, applied: { ...caption, at: new Date().toISOString() } });
  return caption;
}

/** Take the plate off: the design goes back to its clean picture */
export async function removeCaptionFromDesign(supabase: SupabaseClient, imageId: string): Promise<boolean> {
  const { data: row, error } = await supabase.from('image_catalog').select('id, caption_overlay').eq('id', imageId).maybeSingle();
  if (error) throw new Error(error.message.includes('caption_overlay') ? CAPTION_MIGRATION : error.message);
  const overlay = readCaptionOverlay((row as any)?.caption_overlay);
  if (!overlay?.applied) return false;
  const url = cloudinary.url(overlay.clean_public_id, { secure: true });
  await setPicture(supabase, imageId, overlay.clean_public_id, url, null);
  return true;
}

/** Plate on (or off) a design and every breed / coat version made from it */
export async function captionDesignAndVersions(supabase: SupabaseClient, imageId: string, on: boolean, opts: { versions?: boolean; deadline?: number } = {}): Promise<{ done: number; failed: number; skipped: number; errors: string[] }> {
  const ids = [imageId];
  if (opts.versions) {
    const { data } = await supabase.from('image_catalog').select('id').eq('variation_of', imageId).limit(500);
    ids.push(...(data ?? []).map((v: any) => v.id));
  }
  return captionMany(supabase, ids, on, opts.deadline);
}

/** Plate on (or off) many designs, stopping politely at the deadline (the rest are "skipped") */
export async function captionMany(supabase: SupabaseClient, ids: string[], on: boolean, deadline = Date.now() + 270_000): Promise<{ done: number; failed: number; skipped: number; errors: string[] }> {
  let done = 0, failed = 0, skipped = 0;
  const errors: string[] = [];
  for (const id of ids) {
    if (Date.now() > deadline) { skipped++; continue; }
    try {
      if (on) { await applyCaptionToDesign(supabase, id); done++; }
      else if (await removeCaptionFromDesign(supabase, id)) done++;
    } catch (e: any) {
      if (/^Run db\/migrations/.test(e?.message)) throw e;
      failed++; errors.push(String(e?.message || e).slice(0, 200));
    }
  }
  return { done, failed, skipped, errors: Array.from(new Set(errors)).slice(0, 3) };
}

/** A version just saved, when the admin asked for the plate (the frame for zodiac and tarot designs). Never throws. */
export async function captionForNewVersion(supabase: SupabaseClient, versionId: string): Promise<{ text?: string; error?: string } | null> {
  try {
    if (await designRow(supabase, versionId, ['zodiac', 'tarot'])) {
      const { applyFrameToDesign } = await import('@/lib/frames/server');
      const f = await applyFrameToDesign(supabase, versionId);
      return { text: f.tagline ? `${f.title} — ${f.tagline}` : f.title };
    }
    const c = await applyCaptionToDesign(supabase, versionId);
    return { text: c.tagline ? `${c.title} — ${c.tagline}` : c.title };
  } catch (e: any) {
    console.error('caption for new version failed', versionId, e);
    return { error: String(e?.message || e).slice(0, 200) };
  }
}

/** Does the design show the plate now? (null before the migration) */
export async function captionApplied(supabase: SupabaseClient, imageId: string): Promise<boolean | null> {
  const { data, error } = await supabase.from('image_catalog').select('caption_overlay').eq('id', imageId).maybeSingle();
  if (error) return null;
  return !!readCaptionOverlay((data as any)?.caption_overlay)?.applied;
}

/**
 * The picture AI should paint from: the words' text-free copy, else the picture without the
 * plate or frame, else the design's picture. Works before the captions migration.
 */
export async function cleanPictureId(supabase: SupabaseClient, imageId: string, current: string | null | undefined): Promise<string | null> {
  const { data: w } = await supabase.from('image_catalog').select('text_overlay').eq('id', imageId).maybeSingle();
  const words = readWords((w as any)?.text_overlay);
  if (words?.clean_public_id) return words.clean_public_id;
  const { data: c, error } = await supabase.from('image_catalog').select('caption_overlay').eq('id', imageId).maybeSingle();
  if (!error) {
    const o = readCaptionOverlay((c as any)?.caption_overlay);
    if (o?.applied) return o.clean_public_id;
  }
  const f = await frameOverlayOf(supabase, imageId);
  if (f?.applied) return f.clean_public_id;
  return current ?? null;
}

/** The words were redrawn (new picture underneath): put the plate back on top if it was on */
export async function reapplyCaptionAfterWords(supabase: SupabaseClient, imageId: string, newClean: string): Promise<void> {
  const { data, error } = await supabase.from('image_catalog').select('caption_overlay').eq('id', imageId).maybeSingle();
  if (error) return;
  const o = readCaptionOverlay((data as any)?.caption_overlay);
  if (!o?.applied) return;
  const { at: _at, ...caption } = o.applied;
  const baked = await bakeCaption(newClean, caption);
  await setPicture(supabase, imageId, baked.public_id, baked.secure_url, { clean_public_id: newClean, applied: { ...caption, at: new Date().toISOString() } });
}
