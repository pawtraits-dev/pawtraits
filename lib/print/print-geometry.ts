/**
 * Print geometry — how one reference image becomes every print size.
 *
 * House rule (2026-09-30):
 *  - Reference images are generated in exactly one of four aspect ratios:
 *      1:1 (square) · 2:3 (portrait) · 3:2 (landscape) · 2:1 (wide, mugs)
 *  - A 2:3 / 3:2 reference prints M (200×300) edge to edge; S (150×200) and L (300×400) are
 *    3:4 / 4:3 and are centre-cropped from it — about 11% off the long edge, 5.5% each end.
 *  - The print is always in the reference image's orientation; product dimensions only give
 *    the shape, so it doesn't matter whether a product row stores 20×30 or 30×20.
 *
 * Pure functions only — safe to import from client components.
 */

export const ALLOWED_ASPECT_RATIOS = ['1:1', '2:3', '3:2', '2:1'] as const;
export type AllowedAspectRatio = (typeof ALLOWED_ASPECT_RATIOS)[number];

/** Default print resolution and the bleed added to self-print files (pre-cut blanks). */
export const PRINT_DPI = 300;
export const SELF_PRINT_BLEED_MM = 1.5;

/** Effective-DPI thresholds for warnings. */
export const DPI_OK = 250;
export const DPI_MIN = 150;

export function parseRatio(ratio?: string | null): number | null {
  if (!ratio) return null;
  const m = ratio.trim().match(/^(\d+(?:\.\d+)?)\s*[:/x×]\s*(\d+(?:\.\d+)?)$/i);
  if (!m) return null;
  const w = Number(m[1]), h = Number(m[2]);
  return w > 0 && h > 0 ? w / h : null;
}

export function isAllowedAspectRatio(ratio?: string | null): ratio is AllowedAspectRatio {
  return !!ratio && (ALLOWED_ASPECT_RATIOS as readonly string[]).includes(ratio.trim().replace('/', ':'));
}

/** Nearest allowed ratio to a width/height, with how far off it is (0.02 = 2%). */
export function nearestAllowedRatio(width: number, height: number): { ratio: AllowedAspectRatio; offBy: number } {
  const r = width / height;
  let best: { ratio: AllowedAspectRatio; offBy: number } = { ratio: '1:1', offBy: Infinity };
  for (const candidate of ALLOWED_ASPECT_RATIOS) {
    const c = parseRatio(candidate)!;
    const offBy = Math.abs(r - c) / c;
    if (offBy < best.offBy) best = { ratio: candidate, offBy };
  }
  return best;
}

/** CSS aspect-ratio value ("2 / 3") from "2:3"; falls back to square. */
export function cssAspectRatio(ratio?: string | null): string {
  const m = ratio?.trim().match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/);
  return m ? `${m[1]} / ${m[2]}` : '1 / 1';
}

export type Orientation = 'portrait' | 'landscape' | 'square';

export function orientationOf(width: number, height: number, tolerance = 0.02): Orientation {
  const r = width / height;
  if (Math.abs(r - 1) <= tolerance) return 'square';
  return r < 1 ? 'portrait' : 'landscape';
}

export interface PrintSize {
  widthMm: number;
  heightMm: number;
  orientation: Orientation;
}

/**
 * The finished print size for a product, turned to match the source image's orientation.
 * `productWidthCm/HeightCm` come from `products.width_cm/height_cm`.
 */
export function printSizeFor(productWidthCm: number, productHeightCm: number, source: { width: number; height: number } | Orientation): PrintSize {
  const shortMm = Math.min(productWidthCm, productHeightCm) * 10;
  const longMm = Math.max(productWidthCm, productHeightCm) * 10;
  const sourceOrientation = typeof source === 'string' ? source : orientationOf(source.width, source.height);
  const productSquare = Math.abs(shortMm - longMm) < 0.5;
  if (productSquare) return { widthMm: shortMm, heightMm: shortMm, orientation: 'square' };
  return sourceOrientation === 'landscape'
    ? { widthMm: longMm, heightMm: shortMm, orientation: 'landscape' }
    : { widthMm: shortMm, heightMm: longMm, orientation: 'portrait' };
}

export interface CropBox {
  /** Crop of the source, in source pixels (centred) */
  x: number; y: number; width: number; height: number;
  /** Share of the source area that survives the crop (1 = no crop) */
  kept: number;
  /** Which edges get trimmed */
  trims: 'none' | 'top_bottom' | 'left_right';
}

/** Centre crop of a width×height source to the target aspect (targetW/targetH). */
export function centreCrop(sourceW: number, sourceH: number, targetW: number, targetH: number): CropBox {
  const src = sourceW / sourceH;
  const tgt = targetW / targetH;
  if (Math.abs(src - tgt) / tgt < 0.002) return { x: 0, y: 0, width: sourceW, height: sourceH, kept: 1, trims: 'none' };
  if (src > tgt) {
    const w = Math.round(sourceH * tgt);
    return { x: Math.round((sourceW - w) / 2), y: 0, width: w, height: sourceH, kept: w / sourceW, trims: 'left_right' };
  }
  const h = Math.round(sourceW / tgt);
  return { x: 0, y: Math.round((sourceH - h) / 2), width: sourceW, height: h, kept: h / sourceH, trims: 'top_bottom' };
}

export const mmToPx = (mm: number, dpi = PRINT_DPI) => Math.round((mm / 25.4) * dpi);

export interface PrintPlan {
  size: PrintSize;
  bleedMm: number;
  /** Output file size in pixels (print size + bleed at PRINT_DPI) */
  outputPx: { width: number; height: number };
  /** Source crop feeding the output */
  crop: CropBox;
  /** Resolution the source actually delivers at this size */
  effectiveDpi: number;
  quality: 'good' | 'ok' | 'low';
  /** Orientation or shape mismatch (e.g. square image on a rectangular product) */
  mismatch: string | null;
}

/**
 * Plan the print file for one product from one source image.
 */
export function planPrint(source: { width: number; height: number }, productWidthCm: number, productHeightCm: number, opts: { bleedMm?: number; dpi?: number } = {}): PrintPlan {
  const dpi = opts.dpi ?? PRINT_DPI;
  const bleedMm = opts.bleedMm ?? 0;
  const size = printSizeFor(productWidthCm, productHeightCm, source);
  const outW = size.widthMm + 2 * bleedMm;
  const outH = size.heightMm + 2 * bleedMm;
  const crop = centreCrop(source.width, source.height, outW, outH);
  const effectiveDpi = Math.round(Math.min(crop.width / (outW / 25.4), crop.height / (outH / 25.4)));

  const srcOrientation = orientationOf(source.width, source.height);
  let mismatch: string | null = null;
  if (srcOrientation === 'square' && size.orientation !== 'square') mismatch = 'Square image on a rectangular product — a lot will be cropped';
  else if (srcOrientation !== 'square' && size.orientation === 'square') mismatch = 'Rectangular image on a square product — a lot will be cropped';
  else if (crop.kept < 0.8) mismatch = `Only ${Math.round(crop.kept * 100)}% of the image fits this size`;

  return {
    size,
    bleedMm,
    outputPx: { width: mmToPx(outW, dpi), height: mmToPx(outH, dpi) },
    crop,
    effectiveDpi,
    quality: effectiveDpi >= DPI_OK ? 'good' : effectiveDpi >= DPI_MIN ? 'ok' : 'low',
    mismatch,
  };
}

/** Short customer-facing note about the crop for a size, or null when it prints edge to edge. */
export function cropNote(sourceOrientation: Orientation, productWidthCm?: number | null, productHeightCm?: number | null): string | null {
  if (!productWidthCm || !productHeightCm || sourceOrientation === 'square') return null;
  const size = printSizeFor(productWidthCm, productHeightCm, sourceOrientation);
  const nominal = sourceOrientation === 'portrait' ? { w: 2, h: 3 } : { w: 3, h: 2 };
  const crop = centreCrop(nominal.w * 1000, nominal.h * 1000, size.widthMm, size.heightMm);
  if (crop.kept > 0.97) return null;
  return crop.trims === 'top_bottom' ? 'Trimmed slightly top and bottom to fit' : 'Trimmed slightly at the sides to fit';
}

// ---------------------------------------------------------------------------------
// AI upscaling (Cloudinary e_upscale) for print files
// ---------------------------------------------------------------------------------

/** Cloudinary's AI upscale takes inputs under 4.2 MP and multiplies each side by 4. */
export const AI_UPSCALE_MAX_INPUT_MP = 4.1;
export const AI_UPSCALE_FACTOR = 4;

/** A print below this effective dpi gets the AI upscale; above it a plain resize is sharp enough. */
export const UPSCALE_BELOW_DPI = DPI_OK;

/** Below this effective dpi from the preview, a custom portrait gets a 4K print master re-render. */
export const PRINT_MASTER_BELOW_DPI = 200;

export interface UpscaleStep {
  /** Size the crop is scaled to before the AI upscale (≤ 4.1 MP, ≤ the crop itself) */
  pre: { width: number; height: number };
  /** Size straight after the 4× upscale */
  upscaled: { width: number; height: number };
}

/**
 * Whether (and how) to AI-upscale for this print. `maxIntermediateMp` is the largest image the
 * Cloudinary plan will transform (25 MP on Free; paid plans allow more) — the 4× output must fit.
 */
export function planUpscale(plan: PrintPlan, maxIntermediateMp = 25): UpscaleStep | null {
  if (plan.effectiveDpi >= UPSCALE_BELOW_DPI) return null;
  const cw = plan.crop.width, ch = plan.crop.height;
  const f = Math.min(
    1,
    Math.sqrt((AI_UPSCALE_MAX_INPUT_MP * 1e6) / (cw * ch)),
    Math.sqrt((maxIntermediateMp * 1e6) / (AI_UPSCALE_FACTOR ** 2) / (cw * ch)),
  );
  const pre = { width: Math.floor(cw * f), height: Math.floor(ch * f) };
  if (pre.width < 64 || pre.height < 64) return null;
  return { pre, upscaled: { width: pre.width * AI_UPSCALE_FACTOR, height: pre.height * AI_UPSCALE_FACTOR } };
}
