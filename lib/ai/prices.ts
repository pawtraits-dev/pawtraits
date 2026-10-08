/**
 * AI prices in USD, used to work out the cost of each call when it happens (stored on the
 * ai_usage row, so later price changes never rewrite history).
 *
 * Sources (checked 2026-10-08):
 *   Gemini: https://ai.google.dev/gemini-api/docs/pricing  (paid tier; batch = 50%)
 *   Claude: https://www.anthropic.com/pricing#api
 * Update PRICES_AS_OF and the numbers here when providers change prices.
 */
export const PRICES_AS_OF = '2026-10-08';

export interface ModelPrice {
  provider: 'gemini' | 'anthropic';
  label: string;
  /** per 1M input tokens (text and images) */
  input: number;
  /** per 1M output text + thinking tokens */
  outputText: number;
  /** per 1M output image tokens (image models) */
  outputImage?: number;
  /** output tokens per generated image, when the response doesn't split tokens by modality */
  imageTokens?: Record<string, number>;
  /** per 1M cached input tokens (Claude cache reads / Gemini context cache) */
  cachedInput?: number;
  /** per 1M tokens written to the Claude prompt cache */
  cacheWrite?: number;
}

const BATCH_FACTOR = 0.5;

export const MODEL_PRICES: Record<string, ModelPrice> = {
  'gemini-nano-banana-2.1': {
    provider: 'gemini', label: 'Nano Banana 2.1',
    input: 1.5, outputText: 7.5, outputImage: 30,
    imageTokens: { '1K': 1120, '2K': 1680, '4K': 3780 },
  },
  'gemini-3-pro-image': {
    provider: 'gemini', label: 'Nano Banana Pro',
    input: 2, outputText: 12, outputImage: 120,
    imageTokens: { '1K': 1120, '2K': 1120, '4K': 2000 },
  },
  'gemini-3.1-flash-image': {
    provider: 'gemini', label: 'Nano Banana 2',
    input: 0.5, outputText: 3, outputImage: 60,
    imageTokens: { '0.5K': 747, '1K': 1120, '2K': 1680, '4K': 2520 },
  },
  'claude-haiku-4-5-20251001': {
    provider: 'anthropic', label: 'Claude Haiku 4.5',
    input: 1, outputText: 5, cachedInput: 0.1, cacheWrite: 1.25,
  },
  'claude-sonnet-4-5-20250929': {
    provider: 'anthropic', label: 'Claude Sonnet 4.5',
    input: 3, outputText: 15, cachedInput: 0.3, cacheWrite: 3.75,
  },
};

/** Matches dated/preview variants too ("gemini-3-pro-image-preview" → "gemini-3-pro-image") */
export function priceFor(model: string): ModelPrice | null {
  if (MODEL_PRICES[model]) return MODEL_PRICES[model];
  const key = Object.keys(MODEL_PRICES)
    .filter((k) => model.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return key ? MODEL_PRICES[key] : null;
}

export interface TokenCounts {
  inputTokens: number;
  cachedInputTokens?: number;
  cacheWriteTokens?: number;
  outputTextTokens: number;   // text answer
  thinkingTokens: number;
  outputImageTokens: number;
}

export interface CostBreakdown { input: number; thinking: number; outputText: number; outputImage: number; total: number }

/** Cost in USD, or null when the model has no price in the table */
export function costOf(model: string, t: TokenCounts, batch = false): CostBreakdown | null {
  const p = priceFor(model);
  if (!p) return null;
  const f = (batch ? BATCH_FACTOR : 1) / 1_000_000;
  const cached = t.cachedInputTokens ?? 0;
  const input = (Math.max(0, t.inputTokens - cached) * p.input
    + cached * (p.cachedInput ?? p.input)
    + (t.cacheWriteTokens ?? 0) * (p.cacheWrite ?? p.input)) * f;
  const thinking = t.thinkingTokens * p.outputText * f;
  const outputText = t.outputTextTokens * p.outputText * f;
  const outputImage = t.outputImageTokens * (p.outputImage ?? p.outputText) * f;
  const round = (n: number) => Math.round(n * 1e6) / 1e6;
  return { input: round(input), thinking: round(thinking), outputText: round(outputText), outputImage: round(outputImage), total: round(input + thinking + outputText + outputImage) };
}
