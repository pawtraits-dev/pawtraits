/**
 * Framed prints (client-safe, pure): the Cloudinary transformation for one framed print file.
 *
 * Order: centre crop to the product's shape → (AI upscale when the picture is too small for the
 * print) → scale to the exact print size → the frame and lettering drawn at that final size. The
 * frame is therefore never upscaled or cropped, and it is always fitted to the trim size. A
 * self-print file gets its bleed afterwards, by padding the finished framed image with black
 * (the frame's own ground colour) (never by scaling the frame past the trim).
 */
import { frameLayers, frameShapeFor, type FrameCard, type FrameShape, type FrameStyleId } from './frame';

/** How far a product's shape may be from 2:3 or 3:4 and still be framed (3%) */
export const FRAME_SHAPE_TOLERANCE = 0.03;
/**
 * Bleed padding: black, the frame's ground colour. (b_blurred is not available on this account:
 * Cloudinary answers 400 "Invalid color name", which broke the first framed self-print files.)
 */
export const BLEED_BACKGROUND = 'b_black';

export interface FramedPlan {
  size: { widthMm: number; heightMm: number; orientation: string };
  crop: { x: number; y: number; width: number; height: number };
  outputPx: { width: number; height: number };
}

/** The frame shape for a print size, or null when it isn't a portrait 2:3 / 3:4 (within 3%) */
export function framedPrintShape(size: { widthMm: number; heightMm: number }): FrameShape | null {
  if (!(size.widthMm > 0 && size.heightMm > 0) || size.widthMm >= size.heightMm) return null;
  const aspect = size.widthMm / size.heightMm;
  const shape = frameShapeFor(aspect);
  const target = shape === '2:3' ? 2 / 3 : 3 / 4;
  return Math.abs(aspect - target) / target <= FRAME_SHAPE_TOLERANCE ? shape : null;
}

/** Cloudinary transformation for the framed print file (no bleed) or, with `bleedPx`, its self-print version */
export function framedPrintTransformation(
  plan: FramedPlan,
  upscale: { pre: { width: number; height: number } } | null | undefined,
  card: FrameCard,
  shape: FrameShape,
  opts: { bleedOutputPx?: { width: number; height: number }; style?: FrameStyleId } = {},
): string {
  const c = plan.crop, o = plan.outputPx;
  const parts = [`c_crop,x_${c.x},y_${c.y},w_${c.width},h_${c.height}`];
  if (upscale) parts.push(`c_scale,w_${upscale.pre.width},h_${upscale.pre.height}`, 'e_upscale');   // before the frame, so it is never upscaled
  parts.push(`c_scale,w_${o.width},h_${o.height},q_100`, frameLayers(card, shape, { width: o.width, height: o.height }, opts.style));
  if (opts.bleedOutputPx) parts.push(`c_pad,w_${opts.bleedOutputPx.width},h_${opts.bleedOutputPx.height},${BLEED_BACKGROUND}`);
  return parts.join('/');
}
