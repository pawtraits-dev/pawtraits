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

/** Normalise "16/9" or "16:9" to the API's "16:9" form; undefined if unsupported. */
export function toGeminiAspectRatio(ratio?: string | null): string | undefined {
  if (!ratio) return undefined;
  const normalised = ratio.trim().replace('/', ':');
  return SUPPORTED_ASPECT_RATIOS.has(normalised) ? normalised : undefined;
}
