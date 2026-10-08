/**
 * AI usage and cost tracking: price maths and token extraction (no network).
 * Run: npm run test:ai-usage
 */
import { costOf, priceFor } from '../lib/ai/prices';
import { geminiTokens, claudeTokens } from '../lib/ai/usage';

let pass = 0, fail = 0;
const ok = (name: string, cond: unknown) => { if (cond) pass++; else { fail++; console.log('FAIL', name); } };
const near = (a: number | undefined, b: number) => a !== undefined && Math.abs(a - b) < 1e-6;

// Prices
ok('price: exact model', priceFor('gemini-nano-banana-2.1')?.label === 'Nano Banana 2.1');
ok('price: preview suffix matches base', priceFor('gemini-3-pro-image-preview')?.label === 'Nano Banana Pro');
ok('price: unknown model', priceFor('gemini-9-mystery') === null && costOf('gemini-9-mystery', { inputTokens: 1, outputTextTokens: 0, thinkingTokens: 0, outputImageTokens: 0 }) === null);

// One 2K image on Nano Banana 2.1 = $0.0504 (1,680 image tokens × $30/M)
const img2k = costOf('gemini-nano-banana-2.1', { inputTokens: 0, outputTextTokens: 0, thinkingTokens: 0, outputImageTokens: 1680 })!;
ok('2.1: 2K image $0.0504', near(img2k.total, 0.0504));
const img4k = costOf('gemini-nano-banana-2.1', { inputTokens: 0, outputTextTokens: 0, thinkingTokens: 0, outputImageTokens: 3780 })!;
ok('2.1: 4K image $0.1134', near(img4k.total, 0.1134));
ok('2.1: 4K batch half', near(costOf('gemini-nano-banana-2.1', { inputTokens: 0, outputTextTokens: 0, thinkingTokens: 0, outputImageTokens: 3780 }, true)!.total, 0.0567));
const full = costOf('gemini-nano-banana-2.1', { inputTokens: 2600, outputTextTokens: 20, thinkingTokens: 1000, outputImageTokens: 1680 })!;
ok('2.1: parts add up', near(full.input, 0.0039) && near(full.thinking, 0.0075) && near(full.outputImage, 0.0504) && near(full.outputText, 0.00015) && near(full.total, 0.06195));
ok('pro: 2K image $0.1344', near(costOf('gemini-3-pro-image', { inputTokens: 0, outputTextTokens: 0, thinkingTokens: 0, outputImageTokens: 1120 })!.total, 0.1344));
const haiku = costOf('claude-haiku-4-5-20251001', { inputTokens: 1500, cachedInputTokens: 500, cacheWriteTokens: 0, outputTextTokens: 200, thinkingTokens: 0, outputImageTokens: 0 })!;
ok('haiku: cache reads at 10%', near(haiku.input, (1000 * 1 + 500 * 0.1) / 1e6) && near(haiku.outputText, 0.001));

// Gemini usageMetadata split by modality
const g = geminiTokens({
  usageMetadata: { promptTokenCount: 2617, candidatesTokenCount: 1702, thoughtsTokenCount: 845,
    candidatesTokensDetails: [{ modality: 'IMAGE', tokenCount: 1680 }, { modality: 'TEXT', tokenCount: 22 }] },
  candidates: [{ content: { parts: [{ text: 'here' }, { inlineData: { data: 'AAAA' } }] } }],
}, '2K');
ok('gemini: tokens by modality', g.inputTokens === 2617 && g.outputImageTokens === 1680 && g.outputTextTokens === 22 && g.thinkingTokens === 845 && g.outputImages === 1);
// No modality split: image share estimated from the price table
const g2 = geminiTokens({ modelVersion: 'gemini-nano-banana-2.1', usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 1700 }, candidates: [{ content: { parts: [{ inlineData: { data: 'x' } }] } }] }, '2K');
ok('gemini: no split → table image tokens', g2.outputImageTokens === 1680 && g2.outputTextTokens === 20);
ok('gemini: empty response', geminiTokens({}).inputTokens === 0 && geminiTokens(undefined).outputImages === 0);

// Claude usage
const c = claudeTokens({ usage: { input_tokens: 1000, output_tokens: 150, cache_read_input_tokens: 400, cache_creation_input_tokens: 50 } });
ok('claude: tokens', c.inputTokens === 1400 && c.cachedInputTokens === 400 && c.cacheWriteTokens === 50 && c.outputTextTokens === 150);

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
