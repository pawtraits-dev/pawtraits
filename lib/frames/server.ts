/**
 * Framed cards, server side (see lib/frames/frame.ts).
 *   ensureFrameAssets()      the frame images and fonts on Cloudinary (uploaded once, from public/frames)
 *   designCard()             the card for a design: its zodiac sign or tarot card, same wording as captions
 *   bakeFrame()              a stored 2:3 copy of a picture with the frame drawn on
 *   applyFrameToDesign() / removeFrameFromDesign() / frameMany()   on catalogue designs
 *   reapplyFrameAfterWords() the words were redrawn: put the frame back on top
 * A design has the caption plate or a frame, never both; the frame is always drawn from the clean picture.
 */
import { promises as fs } from 'fs';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cloudinaryService } from '@/lib/cloudinary';
import { captionRows, designRow, ensureSymbols, rowCaption, setDesignPicture, type CaptionRow } from '@/lib/captions/server';
import { readCaptionOverlay, type CaptionAnimal } from '@/lib/captions/caption';
import { zodiacSymbolSvg } from '@/lib/captions/zodiac-symbols';
import { DEFAULT_FRAME_STYLE, FRAME_SHAPES, frameAssetIds, frameBase, frameBaseForWidth, frameCrop, frameLayers, readFrameOverlay, sameCard, type FrameCard, type FrameShape } from './frame';
import { FRAMED_PRINTS_ONLY, framedProductAllowed, isFramed } from './rules';

export const FRAME_MIGRATION = 'Run db/migrations/2026-11-13-framed-cards.sql first';
const missing = (m?: string) => /frame_overlay/.test(m || '');

function configure() {
  if (!cloudinary.config().cloud_name) {
    cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });
  }
}

// ---------------------------------------------------------------------------------------------
// Frame files on Cloudinary

/** Where each Cloudinary id comes from on this site: public/frames/<file> */
const sourceFile = (publicId: string) => publicId.replace(/^pawtraits\/frames\//, '');
const ext = (f: string) => f.split('.').pop();

async function exists(publicId: string, raw: boolean): Promise<boolean> {
  try {
    await cloudinary.api.resource(publicId, raw ? { resource_type: 'raw', type: 'authenticated' } : { resource_type: 'image', type: 'upload' });
    return true;
  } catch (e: any) {
    if (e?.http_code === 404 || e?.error?.http_code === 404) return false;
    throw e;
  }
}

/** The file as a data URI from public/frames (disk), else the site's own URL */
async function sourceOf(file: string, mime: string): Promise<string> {
  try {
    const buf = await fs.readFile(path.join(process.cwd(), 'public', 'frames', file));
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    // On Vercel, files in public/ are served by the site but are not on the function's disk
    const base = (process.env.NEXT_PUBLIC_BASE_URL || 'https://www.pawtraits.pics').replace(/\/$/, '');
    return `${base}/frames/${file}`;
  }
}

let assetsReady: Promise<void> | null = null;
/** Frame images and fonts on Cloudinary, plus the zodiac symbols (each uploaded once, never overwritten) */
export function ensureFrameAssets(): Promise<void> {
  if (!assetsReady) {
    assetsReady = (async () => {
      configure();
      const { images, fonts } = frameAssetIds();
      for (const id of images) {
        if (await exists(id, false)) continue;
        const file = `${sourceFile(id)}.webp`;
        await cloudinary.uploader.upload(await sourceOf(file, 'image/webp'), { public_id: id, overwrite: false, resource_type: 'image', tags: ['frame'] });
      }
      for (const id of fonts) {
        if (await exists(id, true)) continue;
        const file = sourceFile(id);
        await cloudinary.uploader.upload(await sourceOf(file, ext(file) === 'woff2' ? 'font/woff2' : 'application/octet-stream'), { public_id: id, overwrite: false, resource_type: 'raw', type: 'authenticated', tags: ['frame-font'] });
      }
      await ensureSymbols();
    })().catch(e => { assetsReady = null; throw e; });
  }
  return assetsReady;
}

// ---------------------------------------------------------------------------------------------
// Wording

/** The card for a row and animal (the same wording as the caption plate), or null when it has no title or no medallion */
export function cardFromRow(row: Pick<CaptionRow, 'kind' | 'slug' | 'code' | 'defaults' | 'wording'>, animal: CaptionAnimal): FrameCard | null {
  const c = rowCaption(row, animal);
  if (!c) return null;
  if (row.kind === 'zodiac') return zodiacSymbolSvg(row.slug) ? { title: c.title, tagline: c.tagline, medallion: { symbol: row.slug } } : null;
  if (row.kind === 'tarot') return row.code ? { title: c.title, tagline: c.tagline, medallion: { numeral: row.code } } : null;
  return null;
}

/**
 * The card for a design: its Zodiac sign or tarot card, worded for `animal` (the customer's pet),
 * else for the design's own breed's animal. Null for any other design (no frame for it).
 * Titles carry no pet name: use frameTitle(card.title, petName) for that.
 */
export async function designCard(supabase: SupabaseClient, imageId: string, animal?: CaptionAnimal | null): Promise<{ dog: FrameCard | null; cat: FrameCard | null; card: FrameCard | null; designAnimal: CaptionAnimal; kind: 'zodiac' | 'tarot' } | null> {
  const d = await designRow(supabase, imageId, ['zodiac', 'tarot']);
  if (!d) return null;
  const row = (await captionRows(supabase)).find(r => r.id === d.collectionId);
  if (!row || (row.kind !== 'zodiac' && row.kind !== 'tarot')) return null;
  const designAnimal = d.animal ?? 'dog';
  const dog = cardFromRow(row, 'dog'), cat = cardFromRow(row, 'cat');
  return { dog, cat, card: (animal ?? designAnimal) === 'cat' ? cat : dog, designAnimal, kind: row.kind };
}

// ---------------------------------------------------------------------------------------------
// Drawing

/** Store a copy of a Cloudinary picture, cropped to 2:3, with the frame drawn on (full size, PNG) */
export async function bakeFrame(cleanPublicId: string, card: FrameCard, folder = 'pawtraits/catalog-frames'): Promise<{ public_id: string; secure_url: string; width: number; height: number; bytes: number }> {
  configure();
  await ensureFrameAssets();
  // The frame's pixel layout needs a known base: the largest 2:3 inside the clean picture (2000 × 3000 when its size can't be read)
  const dims = await cloudinaryService.getSourceDimensions(cleanPublicId).catch(() => null);
  const base = dims ? frameBase('2:3', dims) : { width: 2000, height: 3000 };
  const url = cloudinary.url(cleanPublicId, { secure: true, raw_transformation: [frameCrop(base), frameLayers(card, '2:3', base)].join('/'), format: 'png' });
  const r = await cloudinary.uploader.upload(url, { folder, resource_type: 'image', tags: ['frame-card'] });
  return { public_id: r.public_id, secure_url: r.secure_url, width: r.width, height: r.height, bytes: r.bytes };
}

async function readRow(supabase: SupabaseClient, imageId: string) {
  const { data, error } = await supabase.from('image_catalog').select('id, cloudinary_public_id, caption_overlay, frame_overlay').eq('id', imageId).maybeSingle();
  if (error) throw new Error(missing(error.message) ? FRAME_MIGRATION : error.message);
  if (!data?.cloudinary_public_id) throw new Error('Design not found');
  return { publicId: data.cloudinary_public_id as string, caption: readCaptionOverlay((data as any).caption_overlay), frame: readFrameOverlay((data as any).frame_overlay) };
}

/** The picture a frame is drawn from: the frame's own clean copy, else the plate's, else the design's picture */
export async function frameSourceOf(supabase: SupabaseClient, imageId: string): Promise<string> {
  const r = await readRow(supabase, imageId);
  return r.frame?.clean_public_id ?? (r.caption?.applied ? r.caption.clean_public_id : r.publicId);
}

/**
 * Draw the frame on a design (worded for its own breed's animal), taking the caption plate off
 * first if it has one. The picture without the frame is kept as frame_overlay.clean_public_id.
 */
export async function applyFrameToDesign(supabase: SupabaseClient, imageId: string, given?: FrameCard | null): Promise<FrameCard> {
  const row = await readRow(supabase, imageId);
  const card = given ?? (await designCard(supabase, imageId))?.card ?? null;
  if (!card) throw new Error('This design is not in a Zodiac sign or tarot card collection');
  const a = row.frame?.applied;
  if (a && sameCard(a, card)) return card;                       // already showing exactly this frame
  const clean = row.frame?.clean_public_id ?? (row.caption?.applied ? row.caption.clean_public_id : row.publicId);
  const baked = await bakeFrame(clean, card);
  await setDesignPicture(supabase, imageId, baked.public_id, baked.secure_url, {
    frame_overlay: { style: DEFAULT_FRAME_STYLE, clean_public_id: clean, applied: { ...card, at: new Date().toISOString() } },
    ...(row.caption ? { caption_overlay: null } : {}),           // the plate is replaced by the frame
  });
  return card;
}

/** Take the frame off: the design goes back to its clean picture */
export async function removeFrameFromDesign(supabase: SupabaseClient, imageId: string): Promise<boolean> {
  const row = await readRow(supabase, imageId);
  if (!row.frame?.applied) return false;
  configure();
  await setDesignPicture(supabase, imageId, row.frame.clean_public_id, cloudinary.url(row.frame.clean_public_id, { secure: true }), { frame_overlay: null });
  return true;
}

type Tally = { done: number; failed: number; skipped: number; errors: string[] };

/** Frame on (or off) a design and every breed / coat version made from it */
export async function frameDesignAndVersions(supabase: SupabaseClient, imageId: string, on: boolean, opts: { versions?: boolean; deadline?: number } = {}): Promise<Tally> {
  const ids = [imageId];
  if (opts.versions) {
    const { data } = await supabase.from('image_catalog').select('id').eq('variation_of', imageId).limit(500);
    ids.push(...(data ?? []).map((v: any) => v.id));
  }
  return frameMany(supabase, ids, on, opts.deadline);
}

/** Frame on (or off) many designs, stopping politely at the deadline (the rest are "skipped") */
export async function frameMany(supabase: SupabaseClient, ids: string[], on: boolean, deadline = Date.now() + 270_000): Promise<Tally> {
  let done = 0, failed = 0, skipped = 0;
  const errors: string[] = [];
  for (const id of ids) {
    if (Date.now() > deadline) { skipped++; continue; }
    try {
      if (on) { await applyFrameToDesign(supabase, id); done++; }
      else if (await removeFrameFromDesign(supabase, id)) done++;
    } catch (e: any) {
      if (/^Run db\/migrations/.test(e?.message)) throw e;
      failed++; errors.push(String(e?.message || e).slice(0, 200));
    }
  }
  return { done, failed, skipped, errors: Array.from(new Set(errors)).slice(0, 3) };
}

/** A version just saved from a framed design is framed too (as words are drawn on versions). Never throws. */
export async function frameForNewVersion(supabase: SupabaseClient, versionId: string, parentId: string): Promise<{ text?: string; error?: string } | null> {
  try {
    if (!(await frameApplied(supabase, parentId))) return null;
    const c = await applyFrameToDesign(supabase, versionId);
    return { text: c.tagline ? `${c.title} — ${c.tagline}` : c.title };
  } catch (e: any) {
    console.error('frame for new version failed', versionId, e);
    return { error: String(e?.message || e).slice(0, 200) };
  }
}

/** Does the design show a frame now? (null before the migration) */
export async function frameApplied(supabase: SupabaseClient, imageId: string): Promise<boolean | null> {
  const { data, error } = await supabase.from('image_catalog').select('frame_overlay').eq('id', imageId).maybeSingle();
  if (error) return null;
  return !!readFrameOverlay((data as any)?.frame_overlay)?.applied;
}

/** The words were redrawn (new picture underneath): put the frame back on top if it was on */
export async function reapplyFrameAfterWords(supabase: SupabaseClient, imageId: string, newClean: string): Promise<void> {
  const { data, error } = await supabase.from('image_catalog').select('frame_overlay').eq('id', imageId).maybeSingle();
  if (error) return;
  const o = readFrameOverlay((data as any)?.frame_overlay);
  if (!o?.applied) return;
  const { at: _at, ...card } = o.applied;
  const baked = await bakeFrame(newClean, card);
  await setDesignPicture(supabase, imageId, baked.public_id, baked.secure_url, { frame_overlay: { style: o.style, clean_public_id: newClean, applied: { ...card, at: new Date().toISOString() } } });
}

// ---------------------------------------------------------------------------------------------
// Customers: previews, thumbnails, and the prints-only rule

/** Watermarked previews of a card on a clean picture, one per print shape (the picture is cropped to the shape first) */
export function frameShapeUrls(cleanPublicId: string, card: FrameCard, width = 400): Record<FrameShape, string> {
  return Object.fromEntries(FRAME_SHAPES.map(s => [s, cloudinaryService.getPublicVariantUrl(cleanPublicId, 'catalog_watermarked', { pre: frameCrop(frameBaseForWidth(s, width)), overlay: frameLayers(card, s, frameBaseForWidth(s, width)), format: 'jpg', width })])) as Record<FrameShape, string>;
}

/** What a customer's portrait shows: generation_metadata.frame → the card, or null */
export function customFrameCard(meta: any): (FrameCard & { petName: string | null }) | null {
  const f = meta?.frame;
  if (!f || typeof f.title !== 'string' || !f.title) return null;
  const m = f.medallion;
  return { title: f.title, tagline: typeof f.tagline === 'string' && f.tagline ? f.tagline : null, medallion: m && typeof m.symbol === 'string' ? { symbol: m.symbol } : m && typeof m.numeral === 'string' ? { numeral: m.numeral } : null, petName: typeof f.pet_name === 'string' ? f.pet_name : null };
}

/**
 * The message to refuse a basket or order with, or null: framed designs are prints only. Checks
 * each line's product and whether its image (catalogue design or customer portrait) is framed.
 */
export async function framedLineProblem(supabase: SupabaseClient, lines: { imageId?: string | null; productId?: string | null; product?: any }[]): Promise<string | null> {
  // The product as the database has it, as well as the one the browser sent
  const productIds = Array.from(new Set(lines.map(l => l.productId).filter((id): id is string => !!id && /^[0-9a-f-]{36}$/i.test(id))));
  const { data: prods } = productIds.length ? await supabase.from('products').select('*').in('id', productIds) : { data: [] as any[] };
  const byId = new Map((prods ?? []).map((p: any) => [p.id, p]));
  const bad = lines.filter(l => l.imageId && (!framedProductAllowed(l.product) || !framedProductAllowed(l.productId ? byId.get(l.productId) : null)));
  if (!bad.length) return null;
  const ids = Array.from(new Set(bad.map(l => l.imageId as string)));
  const [cat, cust] = await Promise.all([
    supabase.from('image_catalog').select('id, frame_overlay').in('id', ids),
    supabase.from('customer_custom_images').select('id, generation_metadata').in('id', ids),
  ]);
  const framed = new Set<string>();
  for (const r of cat.error ? [] : cat.data ?? []) if (isFramed(r as any)) framed.add((r as any).id);
  for (const r of cust.error ? [] : cust.data ?? []) if (isFramed(r as any)) framed.add((r as any).id);
  return bad.some(l => framed.has(l.imageId as string)) ? FRAMED_PRINTS_ONLY : null;
}

/** The ids of these catalogue designs that show a frame (empty before the migration) */
export async function framedIds(supabase: SupabaseClient, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const { data, error } = await supabase.from('image_catalog').select('id, frame_overlay').in('id', ids);
  return new Set(error ? [] : (data ?? []).filter((r: any) => isFramed(r)).map((r: any) => r.id));
}
