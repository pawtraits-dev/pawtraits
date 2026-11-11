/**
 * A customer's phone case: their customised painting dropped into the design's approved case art.
 * The painting comes from the main customisation (same prompt and pipeline as every Pawtrait), so
 * this step never calls Gemini. Geometry is locked: the painting is scaled to exactly the slot and
 * pasted at the slot, after a small alignment check (Gemini can drift a few pixels): the best
 * shift within ±1.5% of the width, judged on the painting's border (background, not the pet).
 * Cached per layout group on customer_custom_images.metadata.case_composite.
 */
import { v2 as cloudinary } from 'cloudinary';
import { createCanvas, loadImage, type Image } from 'canvas';
import type { SupabaseClient } from '@supabase/supabase-js';
import { configure, featheredPainting, sourceUrl } from './case-art';
import type { CaseArtEntry } from './geometry';

export interface CaseComposite { public_id: string; group: string; shift: { x: number; y: number }; flagged: boolean; created_at: string }

const MAX_SHIFT = 0.015;

function grey(img: Image, w: number, h: number) {
  const c = createCanvas(w, h); const g = c.getContext('2d');
  g.drawImage(img, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data; const out = new Float32Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114;
  return out;
}

/** Best (dx, dy) as a fraction of the width that moves `moved` back onto `original`, using the outer border only */
export function alignmentShift(original: Image, moved: Image): { x: number; y: number; error: number } {
  const W = 120, H = 180, R = Math.ceil(W * MAX_SHIFT) + 1, band = Math.round(W * 0.16);
  const a = grey(original, W, H), b = grey(moved, W, H);
  let best = { x: 0, y: 0, error: Infinity };
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    let sum = 0, n = 0;
    for (let y = R; y < H - R; y++) for (let x = R; x < W - R; x++) {
      if (x >= band && x < W - band && y >= band && y < H - band) continue; // skip the middle (the pet)
      sum += Math.abs(a[y * W + x] - b[(y + dy) * W + (x + dx)]); n++;
    }
    const e = sum / n;
    if (e < best.error) best = { x: dx, y: dy, error: e };
  }
  // b(x+dx) ≈ a(x): the painting drifted by (dx, dy); draw it shifted by (−dx, −dy)
  return { x: -best.x / W, y: -best.y / W, error: Math.round(best.error * 10) / 10 };
}

export async function buildCaseComposite(db: SupabaseClient, customImageId: string, group: string, opts: { requireApproved?: boolean } = {}): Promise<CaseComposite> {
  const { data: custom } = await db.from('customer_custom_images').select('id, status, catalog_image_id, generated_cloudinary_id, metadata').eq('id', customImageId).maybeSingle();
  if (!custom || custom.status !== 'complete' || !custom.generated_cloudinary_id || !custom.catalog_image_id) throw new Error('That picture isn’t ready yet');
  const cached = (custom.metadata as any)?.case_composite?.[group] as CaseComposite | undefined;
  if (cached?.public_id) return cached;

  const { data: design } = await db.from('image_catalog').select('cloudinary_public_id, case_art').eq('id', custom.catalog_image_id).maybeSingle();
  const art = (design?.case_art as Record<string, CaseArtEntry> | null)?.[group];
  if (!design?.cloudinary_public_id || !art) throw new Error('This design isn’t available as a phone case for that phone');
  if (opts.requireApproved !== false && art.status !== 'approved') throw new Error('This design isn’t available as a phone case for that phone yet');

  const L = art.layout, px = art.width / L.cw;
  const slot = { x: L.slot.x * px, y: L.slot.y * px, w: L.slot.w * px, h: L.slot.h * px };
  configure();
  const [base, original, painted] = await Promise.all([
    loadImage(cloudinary.url(art.public_id, { secure: true, type: 'upload', format: 'png' })),
    loadImage(sourceUrl(design.cloudinary_public_id, 240)),
    loadImage(sourceUrl(custom.generated_cloudinary_id, slot.w)),
  ]);
  const shift = alignmentShift(original, painted);
  const flagged = Math.max(Math.abs(shift.x), Math.abs(shift.y)) >= MAX_SHIFT || shift.error > 40;

  const out = createCanvas(base.width, base.height);
  const g = out.getContext('2d');
  g.drawImage(base, 0, 0);
  g.drawImage(featheredPainting(painted, slot.w, slot.h), Math.round(slot.x + shift.x * slot.w), Math.round(slot.y + shift.y * slot.w));

  const uploaded = await cloudinary.uploader.upload(`data:image/jpeg;base64,${out.toBuffer('image/jpeg', { quality: 0.93 }).toString('base64')}`, {
    folder: 'pawtraits/phone-cases/composites', public_id: `${customImageId}-${group}`, overwrite: true, resource_type: 'image', tags: ['phone-case-composite'],
  });
  const result: CaseComposite = { public_id: uploaded.public_id, group, shift: { x: shift.x, y: shift.y }, flagged, created_at: new Date().toISOString() };
  const metadata = { ...((custom.metadata as any) || {}) };
  metadata.case_composite = { ...(metadata.case_composite || {}), [group]: result };
  await db.from('customer_custom_images').update({ metadata }).eq('id', customImageId);
  return result;
}
