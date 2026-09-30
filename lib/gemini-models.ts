/**
 * Central registry of Gemini ("Nano Banana") image model IDs.
 *
 * Change models here (or via env vars) — never hardcode model IDs in routes.
 * Current GA models: https://ai.google.dev/gemini-api/docs/models
 *
 *   pro   → Nano Banana Pro    (gemini-3-pro-image)          highest fidelity, customer-facing
 *   flash → Nano Banana 2      (gemini-3.1-flash-image)      fast, production-scale
 *   lite  → Nano Banana 2 Lite (gemini-3.1-flash-lite-image) cheapest/fastest, 1K only
 */
export const GEMINI_IMAGE_MODELS = {
  pro: process.env.GEMINI_IMAGE_MODEL_PRO || 'gemini-3-pro-image',
  flash: process.env.GEMINI_IMAGE_MODEL_FLASH || 'gemini-3.1-flash-image',
  lite: process.env.GEMINI_IMAGE_MODEL_LITE || 'gemini-3.1-flash-lite-image',
} as const;

export type GeminiImageTier = keyof typeof GEMINI_IMAGE_MODELS;

/** Aspect ratios accepted by imageConfig.aspectRatio */
const SUPPORTED_ASPECT_RATIOS = new Set([
  '1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9',
]);

/**
 * Our reference shapes that Gemini can't generate directly, and what to ask for instead.
 * 2:1 (mugs) → 21:9, the nearest wider shape; the mug/print step centre-crops it to 2:1.
 */
const GEMINI_SUBSTITUTE_RATIOS: Record<string, string> = { '2:1': '21:9' };

/** Normalise "16/9" or "16:9" to the API's "16:9" form; undefined if unsupported. */
export function toGeminiAspectRatio(ratio?: string | null): string | undefined {
  if (!ratio) return undefined;
  const normalised = ratio.trim().replace('/', ':');
  if (GEMINI_SUBSTITUTE_RATIOS[normalised]) return GEMINI_SUBSTITUTE_RATIOS[normalised];
  return SUPPORTED_ASPECT_RATIOS.has(normalised) ? normalised : undefined;
}

/**
 * Output resolution. Previews (customer + admin) are generated at 2K — on Nano Banana Pro
 * 1K and 2K cost the same — and the 4K print master is made only when a Large is ordered.
 */
export const GEMINI_IMAGE_SIZES = {
  preview: process.env.GEMINI_PREVIEW_IMAGE_SIZE || '2K',
  print: process.env.GEMINI_PRINT_IMAGE_SIZE || '4K',
} as const;

/** `config` for generateContent: pins the output shape (when known) and resolution. */
export function geminiImageConfig(ratio?: string | null, imageSize: string = GEMINI_IMAGE_SIZES.preview): { imageConfig: { aspectRatio?: string; imageSize: string } } {
  const aspectRatio = toGeminiAspectRatio(ratio);
  return { imageConfig: { imageSize, ...(aspectRatio ? { aspectRatio } : {}) } };
}

/** Pixel size of a PNG / JPEG / WEBP from its bytes (no decoding); null if unknown. */
export function imageDimensions(input: string | Uint8Array): { width: number; height: number } | null {
  let b: Uint8Array;
  if (typeof input === 'string') {
    const base64 = input.startsWith('data:') ? input.slice(input.indexOf(',') + 1) : input;
    b = Uint8Array.from(Buffer.from(base64.slice(0, 350_000), 'base64'));
  } else b = input;
  const u16 = (i: number) => (b[i] << 8) | b[i + 1];
  const u32 = (i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
  // PNG
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { width: u32(16), height: u32(20) };
  // JPEG: walk segments to the first SOFn
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      const len = u16(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { width: u16(i + 7), height: u16(i + 5) };
      i += 2 + len;
    }
    return null;
  }
  // WEBP
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) {
    const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (chunk === 'VP8X') return { width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
    if (chunk === 'VP8 ') return { width: (b[26] | (b[27] << 8)) & 0x3fff, height: (b[28] | (b[29] << 8)) & 0x3fff };
    if (chunk === 'VP8L') {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  return null;
}

/**
 * Aspect ratio to ask Gemini for when editing a reference image: the reference's own shape,
 * snapped to our allowed shapes (1:1, 2:3, 3:2, 2:1). Undefined if it can't be read.
 */
export function ratioOfImage(input?: string | Uint8Array | null): string | undefined {
  if (!input) return undefined;
  const dims = imageDimensions(input);
  if (!dims || !dims.width || !dims.height) return undefined;
  const r = dims.width / dims.height;
  const allowed: Array<[string, number]> = [['1:1', 1], ['2:3', 2 / 3], ['3:2', 3 / 2], ['2:1', 2]];
  let best = allowed[0];
  for (const a of allowed) if (Math.abs(r - a[1]) / a[1] < Math.abs(r - best[1]) / best[1]) best = a;
  return best[0];
}
