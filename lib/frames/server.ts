/**
 * Framed cards, server side (see lib/frames/frame.ts).
 *   ensureFrameAssets()      the frame images and fonts on Cloudinary (uploaded once, from public/frames)
 *   designCard()             the card for a design: its zodiac sign or tarot card, same wording as captions
 *   bakeFrame()              a stored 2:3 copy of a picture with the frame drawn on
 *   applyFrameToDesign() / removeFrameFromDesign() / frameMany()   on catalogue designs
 *   frameIfCard()            keep a design's frame in step with its sign or card (called wherever its collections change)
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
import { DEFAULT_FRAME_STYLE, FRAME_MAX, FRAME_SHAPES, frameTitle, frameAssetIds, frameBase, frameBaseForWidth, frameCrop, frameLayers, readFrameOverlay, sameCard, type FrameCard, type FrameShape } from './frame';
import { FRAMED_PRINTS_ONLY, framedProductAllowed, isFramed } from './rules';
import { metaWithFrame, metaWithoutFrame, switchBlocked, unframedBaseId, type FrameChoice } from './switch';
import { cleanPetName } from '@/lib/picture-words';

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

/** What frameIfCard did: 'framed' (put on), 'redrawn' (new sign, card or wording), 'unframed' (taken off), 'unchanged', 'skipped' (customer or quiz picture, or before the migration), 'failed' */
export type FrameSync = 'framed' | 'redrawn' | 'unframed' | 'unchanged' | 'skipped' | 'failed';

/** Is this row one the frame never touches? Customer portraits and quiz breed pictures are not catalogue designs */
export function frameExempt(row: { is_customer_generated?: boolean | null; tags?: string[] | null }): boolean {
  return !!row.is_customer_generated || (row.tags ?? []).includes('quiz-generated');
}

/**
 * Make a catalogue design's picture match its collections: in a Zodiac sign or tarot card (its own
 * link, else its parent design's) it shows that card's frame; in none it shows no frame. Moving it
 * to another sign or card, or changing the wording, redraws it. Cheap when nothing needs doing (a
 * row read and the links), best-effort, and never throws: it logs and returns 'failed'.
 * `versions` does the same for the breed / coat versions made from the design, until `deadline`.
 */
export async function frameIfCard(supabase: SupabaseClient, imageId: string | null | undefined, opts: { versions?: boolean; deadline?: number } = {}): Promise<FrameSync> {
  if (!imageId) return 'skipped';
  try {
    const { data, error } = await supabase.from('image_catalog').select('id, is_customer_generated, tags, frame_overlay').eq('id', imageId).maybeSingle();
    if (error || !data || frameExempt(data as any)) return 'skipped';
    const applied = readFrameOverlay((data as any).frame_overlay)?.applied ?? null;
    const card = (await designCard(supabase, imageId))?.card ?? null;
    let result: FrameSync = 'unchanged';
    if (card) {
      if (!applied) { await applyFrameToDesign(supabase, imageId, card); result = 'framed'; }
      else if (!sameCard(applied, card)) { await applyFrameToDesign(supabase, imageId, card); result = 'redrawn'; }
    } else if (applied) {
      await removeFrameFromDesign(supabase, imageId);
      result = 'unframed';
    }
    if (opts.versions) {
      const { data: kids } = await supabase.from('image_catalog').select('id').eq('variation_of', imageId).limit(500);
      const deadline = opts.deadline ?? Date.now() + 40_000;
      for (const k of kids ?? []) { if (Date.now() > deadline) break; await frameIfCard(supabase, (k as any).id); }
    }
    return result;
  } catch (e) {
    console.error('frameIfCard failed', imageId, e);
    return 'failed';
  }
}

/**
 * Backfill: put the frame on every catalogue design in these collections (all signs, or all cards)
 * that has none yet, stopping politely at the deadline. Designs that already show a frame are not
 * touched, so pressing again carries on; `left` is how many are still to do.
 */
export async function frameAllInCollections(supabase: SupabaseClient, collectionIds: string[], deadline = Date.now() + 270_000): Promise<{ total: number; done: number; failed: number; left: number; errors: string[] }> {
  const { data: links, error } = await supabase.from('design_collections').select('image_id').in('collection_id', collectionIds).eq('excluded', false).limit(5000);
  if (error) throw new Error(error.message);
  const ids = Array.from(new Set((links ?? []).map((l: any) => l.image_id as string)));
  const todo: string[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error: e2 } = await supabase.from('image_catalog').select('id, is_customer_generated, tags, frame_overlay').in('id', ids.slice(i, i + 200));
    if (e2) throw new Error(missing(e2.message) ? FRAME_MIGRATION : e2.message);
    for (const r of data ?? []) if (!frameExempt(r as any) && !readFrameOverlay((r as any).frame_overlay)?.applied) todo.push((r as any).id);
  }
  let done = 0, failed = 0, left = 0;
  const errors: string[] = [];
  for (const id of todo) {
    if (Date.now() > deadline) { left++; continue; }
    try { await applyFrameToDesign(supabase, id); done++; }
    catch (e: any) {
      if (/^Run db\/migrations/.test(e?.message)) throw e;
      failed++; errors.push(String(e?.message || e).slice(0, 200));
    }
  }
  return { total: ids.length, done, failed, left, errors: Array.from(new Set(errors)).slice(0, 3) };
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

// ---------------------------------------------------------------------------------------------
// Customers: framed or not, without a new generation

export type SwitchResult =
  | { ok: true; state: FrameChoice; petName: string | null; generatedImageUrl: string; changed: boolean }
  | { ok: false; status: number; error: string };

/**
 * Switch a customer's portrait between framed and unframed (no AI): the clean painting is stored and
 * the frame is only layers. The caller has already checked that the requester owns it.
 *   off → the displayed picture becomes the painting without the frame; the card is kept as metadata.frame_off
 *   on  → the card (from the design, worded for the pet, with `petName` on the banner) is drawn on the painting
 * Refused (with a short message) for a portrait that has been ordered, and for switching on while a
 * download, mug or case of it is in the signed-in basket. Prints in the basket follow the state at ordering.
 */
export async function switchCustomFrame(supabase: SupabaseClient, imageId: string, to: FrameChoice, petNameRaw?: unknown): Promise<SwitchResult> {
  const { data: row, error } = await supabase.from('customer_custom_images').select('id, catalog_image_id, status, generated_cloudinary_id, generation_metadata, metadata, pet_name').eq('id', imageId).maybeSingle();
  if (error || !row) return { ok: false, status: 404, error: 'Picture not found' };
  const meta: any = (row as any).generation_metadata ?? {};
  if ((row as any).status !== 'complete' || !(row as any).generated_cloudinary_id) return { ok: false, status: 409, error: 'Your picture is not ready yet' };
  const cur = isFramed({ generation_metadata: meta });
  const petGiven = petNameRaw !== undefined && petNameRaw !== null && String(petNameRaw).trim() !== '';
  const petName = !petGiven ? null : (cleanPetName(petNameRaw) ?? '').slice(0, FRAME_MAX.pet).trim() || null;
  if (petGiven && !petName) return { ok: false, status: 400, error: 'Please check the name for the card: letters only (spaces, hyphens and apostrophes are fine), up to 14, and nothing rude.' };
  const keepName: string | null = petGiven ? petName : (meta.frame?.pet_name ?? meta.frame_off?.pet_name ?? (row as any).metadata?.frame?.pet_name ?? null);
  if (to === 'off' && !cur) return { ok: true, state: 'off', petName: keepName, generatedImageUrl: '', changed: false };
  if (to === 'on' && cur && keepName === (meta.frame?.pet_name ?? null)) return { ok: true, state: 'on', petName: keepName, generatedImageUrl: '', changed: false };

  // Order lines keep what was bought, so an ordered picture is left alone; a basket with a download, mug or case blocks "with frame"
  const { data: ordered, error: oErr } = await supabase.from('order_items').select('id').eq('image_id', imageId).limit(1);
  if (oErr) return { ok: false, status: 500, error: 'Could not check your orders just now. Please try again.' };
  const { data: basket } = await supabase.from('cart_items').select('product_data').eq('image_id', imageId).limit(50);
  const blocked = switchBlocked(to, { ordered: (ordered ?? []).length > 0, basketProducts: (basket ?? []).map((b: any) => b.product_data) }, framedProductAllowed);
  if (blocked) return { ok: false, status: 409, error: blocked };

  const baseId = unframedBaseId(meta, (row as any).generated_cloudinary_id);
  if (!baseId) return { ok: false, status: 409, error: 'This picture cannot be changed' };
  const watermarked = (id: string) => cloudinaryService.getPublicVariantUrl(id, 'catalog_watermarked', { format: process.env.CUSTOMER_PREVIEW_FORMAT || 'webp' });
  let update: Record<string, unknown>;

  if (to === 'off') {
    configure();
    update = { generated_cloudinary_id: baseId, generated_image_url: watermarked(baseId), generation_metadata: { ...metaWithoutFrame(meta)!, full_size_url: cloudinary.url(baseId, { secure: true }) } };
  } else {
    // The card: this design's sign or card, worded for their pet's animal (as when it was made), else the one set aside
    const dc = (row as any).catalog_image_id ? await designCard(supabase, (row as any).catalog_image_id).catch(() => null) : null;
    const animal = (meta.frame?.animal ?? meta.frame_off?.animal ?? (row as any).metadata?.detected_breed?.animal ?? null) as 'dog' | 'cat' | null;
    const designBase = dc ? ((animal === 'cat' ? dc.cat : animal === 'dog' ? dc.dog : dc.card) ?? dc.dog ?? dc.cat) : null;
    const kept = meta.frame_off ?? meta.frame;
    const card = designBase
      ? { ...designBase, title: frameTitle(designBase.title, keepName) }
      : kept && !petGiven ? { title: kept.title as string, tagline: (kept.tagline ?? null) as string | null, medallion: kept.medallion ?? null } : null;
    if (!card) return { ok: false, status: 409, error: 'This design no longer has a card frame' };
    const baked = await bakeFrame(baseId, card, 'customer-custom-images');
    update = {
      generated_cloudinary_id: baked.public_id, generated_image_url: watermarked(baked.public_id),
      generation_metadata: metaWithFrame(meta, { card, petName: keepName, animal, baseId, framedUrl: baked.secure_url }),
    };
  }
  const { error: uErr } = await supabase.from('customer_custom_images').update(update).eq('id', imageId);
  if (uErr) return { ok: false, status: 500, error: 'Could not save the change' };
  return { ok: true, state: to, petName: keepName, generatedImageUrl: update.generated_image_url as string, changed: true };
}
