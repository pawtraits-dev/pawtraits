/**
 * Framed prints (client-safe, pure): the Cloudinary transformation for one framed print file.
 *
 * Order: centre crop to the product's shape → (AI upscale when the picture is too small for the
 * print) → scale to the exact print size → the frame and lettering drawn at that final size. The
 * frame is therefore never upscaled or cropped, and it is always fitted to the trim size. A
 * self-print file gets its bleed afterwards, by padding the finished framed image with black
 * (the frame's own ground colour) (never by scaling the frame past the trim).
 */
import { frameBase, frameCrop, frameLayers, frameShapeFor, type FrameBase, type FrameCard, type FrameShape, type FrameStyleId } from './frame';
import { MASTER_4K_PX, planUpscale, type UpscaleStep } from '@/lib/print/print-geometry';

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

/**
 * The one implementation of "a picture with the frame drawn at its final size", used by print
 * files and by framed downloads: `crop` (a Cloudinary crop step to the shape) → (AI upscale when the
 * picture is too small) → scale to the exact output size → frame and lettering at that size →
 * (optional bleed padding).
 */
export function framedImageTransformation(
  crop: string,
  upscale: { pre: { width: number; height: number } } | null | undefined,
  output: { width: number; height: number },
  card: FrameCard,
  shape: FrameShape,
  opts: { bleedOutputPx?: { width: number; height: number }; style?: FrameStyleId } = {},
): string {
  const parts = [crop];
  if (upscale) parts.push(`c_scale,w_${upscale.pre.width},h_${upscale.pre.height}`, 'e_upscale');   // before the frame, so it is never upscaled
  parts.push(`c_scale,w_${output.width},h_${output.height},q_100`, frameLayers(card, shape, { width: output.width, height: output.height }, opts.style));
  if (opts.bleedOutputPx) parts.push(`c_pad,w_${opts.bleedOutputPx.width},h_${opts.bleedOutputPx.height},${BLEED_BACKGROUND}`);
  return parts.join('/');
}

/** Cloudinary transformation for the framed print file (no bleed) or, with `bleedOutputPx`, its self-print version */
export function framedPrintTransformation(
  plan: FramedPlan,
  upscale: { pre: { width: number; height: number } } | null | undefined,
  card: FrameCard,
  shape: FrameShape,
  opts: { bleedOutputPx?: { width: number; height: number }; style?: FrameStyleId } = {},
): string {
  const c = plan.crop;
  return framedImageTransformation(`c_crop,x_${c.x},y_${c.y},w_${c.width},h_${c.height}`, upscale, plan.outputPx, card, shape, opts);
}

/** A framed download's output: 2:3 portrait, whole pixels */
export interface FramedDownloadPlan {
  crop: FrameBase;                                   // the centred 2:3 crop of the source (c_fill to exactly this)
  output: FrameBase;                                 // final size, frame drawn at this size
  upscale: UpscaleStep | null;                       // AI upscale between crop and output, when the source is smaller than the output
}

/** The 4K 2:3 size a framed download is brought up to (3370 × 5055: the largest exact 2:3 inside MASTER_4K_PX) */
export const FRAMED_DOWNLOAD_4K: FrameBase = frameBase('2:3', MASTER_4K_PX);

/**
 * Size and steps for a framed download, from the source's pixel size (null when it can't be read).
 *  - a 4K master (`isMaster`): its own size, as an unframed download delivers it (never upscaled);
 *  - a smaller source: brought up to FRAMED_DOWNLOAD_4K with the same AI upscale prints use (planUpscale);
 *  - a source already larger than 4K: kept at its own size;
 *  - size unknown: plain scale to FRAMED_DOWNLOAD_4K, no AI upscale (its input size can't be planned).
 */
export function planFramedDownload(source: { width: number; height: number } | null, isMaster: boolean, maxIntermediateMp = 25): FramedDownloadPlan {
  if (!source || !(source.width > 0 && source.height > 0)) return { crop: FRAMED_DOWNLOAD_4K, output: FRAMED_DOWNLOAD_4K, upscale: null };
  const crop = frameBase('2:3', source);
  if (isMaster || crop.height >= FRAMED_DOWNLOAD_4K.height) return { crop, output: crop, upscale: null };
  // effectiveDpi 0: this path only runs when the source is smaller than the output, so an upscale is wanted
  return { crop, output: FRAMED_DOWNLOAD_4K, upscale: planUpscale({ crop: { width: crop.width, height: crop.height }, effectiveDpi: 0 }, maxIntermediateMp) };
}

/** Cloudinary transformation for a framed download (2:3, frame drawn at the output size, as in the print files) */
export function framedDownloadTransformation(plan: FramedDownloadPlan, card: FrameCard, style?: FrameStyleId): string {
  return framedImageTransformation(frameCrop(plan.crop), plan.upscale, plan.output, card, '2:3', { style });
}
