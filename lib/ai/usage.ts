import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { GenerateContentResponse } from '@google/genai';
import type Anthropic from '@anthropic-ai/sdk';
import { costOf, PRICES_AS_OF, priceFor, type TokenCounts } from '@/lib/ai/prices';

/**
 * AI usage and cost tracking. Wrap every Gemini and Claude call:
 *
 *   const response = await trackGemini({ feature: 'customer-painting', customerImageId }, () =>
 *     ai.models.generateContent(request), request);
 *
 * Each call writes one ai_usage row (tokens by type, cost in USD, what it was for, how long it
 * took, success or error). Logging never blocks or breaks the call: failures are swallowed.
 */

export type AiFeature =
  | 'customer-painting'     // customer custom image (customise page)
  | 'customer-variation'    // customer breed/coat/outfit variation
  | 'public-variation'      // public try-it variation
  | 'admin-variation'       // admin catalogue variations
  | 'admin-preview'         // admin upload page "Test variation"
  | 'team-version'          // sports team recolour
  | 'print-master'          // 4K print file
  | 'mug'                   // mug artwork
  | 'quiz-image'            // Pawsonality quiz type pictures
  | 'gemini-test'
  | 'auto-tag'
  | 'photo-check'
  | 'pet-count'
  | 'description'
  | 'composition-analysis'
  | 'theme-from-image'
  | 'social-message'
  | 'progress-messages'
  | 'other';

export interface UsageContext {
  feature: AiFeature;
  imageId?: string | null;          // catalogue design
  customerImageId?: string | null;  // customer's generated image
  batchJobId?: string | null;
  batch?: boolean;                  // Gemini Batch API pricing
  meta?: Record<string, unknown>;
}

let client: SupabaseClient | null = null;
function db(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  client ??= createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  return client;
}

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Pull token counts from a Gemini response's usageMetadata */
export function geminiTokens(response: any, imageSize?: string): TokenCounts & { outputImages: number } {
  const u = response?.usageMetadata ?? {};
  const parts: any[] = response?.candidates?.flatMap((c: any) => c?.content?.parts ?? []) ?? [];
  const outputImages = parts.filter((p) => p?.inlineData?.data).length;
  const details: any[] = u.candidatesTokensDetails ?? [];
  const byModality = (m: string) => details.filter((d) => d?.modality === m).reduce((s, d) => s + n(d.tokenCount), 0);
  const candidates = n(u.candidatesTokenCount);
  let outputImageTokens = byModality('IMAGE');
  let outputTextTokens = byModality('TEXT');
  if (!details.length && candidates) {
    // No split by modality: treat the image share as the table's tokens per image
    const perImage = (response?.modelVersion && imageSize && priceFor(response.modelVersion)?.imageTokens?.[imageSize]) || 0;
    outputImageTokens = Math.min(candidates, perImage * outputImages);
    outputTextTokens = candidates - outputImageTokens;
  }
  return {
    inputTokens: n(u.promptTokenCount) + n(u.toolUsePromptTokenCount),
    cachedInputTokens: n(u.cachedContentTokenCount),
    outputTextTokens,
    thinkingTokens: n(u.thoughtsTokenCount),
    outputImageTokens,
    outputImages,
  };
}

/** Pull token counts from a Claude message's usage */
export function claudeTokens(message: any): TokenCounts {
  const u = message?.usage ?? {};
  const cacheRead = n(u.cache_read_input_tokens);
  const cacheWrite = n(u.cache_creation_input_tokens);
  return {
    inputTokens: n(u.input_tokens) + cacheRead,
    cachedInputTokens: cacheRead,
    cacheWriteTokens: cacheWrite,
    outputTextTokens: n(u.output_tokens),
    thinkingTokens: 0,
    outputImageTokens: 0,
  };
}

interface Row {
  ctx: UsageContext;
  provider: 'gemini' | 'anthropic';
  model: string;
  imageSize?: string | null;
  tokens?: TokenCounts & { outputImages?: number };
  durationMs: number;
  error?: unknown;
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e)).slice(0, 500);

export async function recordUsage({ ctx, provider, model, imageSize, tokens, durationMs, error }: Row): Promise<void> {
  if (process.env.AI_USAGE_TRACKING === 'off') return;
  try {
    const cost = tokens ? costOf(model, tokens, !!ctx.batch) : null;
    const row = {
      provider,
      model,
      feature: ctx.feature,
      is_batch: !!ctx.batch,
      image_size: imageSize ?? null,
      input_tokens: tokens?.inputTokens ?? 0,
      cached_input_tokens: tokens?.cachedInputTokens ?? 0,
      thinking_tokens: tokens?.thinkingTokens ?? 0,
      output_text_tokens: tokens?.outputTextTokens ?? 0,
      output_image_tokens: tokens?.outputImageTokens ?? 0,
      output_images: tokens?.outputImages ?? 0,
      cost_input_usd: cost?.input ?? null,
      cost_thinking_usd: cost?.thinking ?? null,
      cost_output_usd: cost ? cost.outputText + cost.outputImage : null,
      cost_usd: cost?.total ?? null,
      prices_as_of: cost ? PRICES_AS_OF : null,
      success: !error,
      error: error ? errorText(error) : null,
      duration_ms: Math.round(durationMs),
      image_id: ctx.imageId ?? null,
      customer_image_id: ctx.customerImageId ?? null,
      batch_job_id: ctx.batchJobId ?? null,
      meta: ctx.meta ?? {},
    };
    const supabase = db();
    if (!supabase) return;
    const insert = supabase.from('ai_usage').insert(row);
    // Never hold the caller up for long
    const result: any = await Promise.race([insert, new Promise((r) => setTimeout(() => r({ error: { message: 'timeout' } }), 3000))]);
    if (result?.error) console.warn('ai_usage insert failed:', result.error.message ?? result.error.code ?? result.error);
  } catch (e) {
    console.warn('ai_usage logging failed:', e);
  }
}

/**
 * Run a Gemini generateContent call and log its usage. `request` is the object passed to
 * generateContent (used for model and image size); the response is returned unchanged.
 */
export async function trackGemini<T>(ctx: UsageContext, call: () => Promise<T>, request: { model: string; config?: any }): Promise<T> {
  const started = Date.now();
  const imageSize: string | undefined = request.config?.imageConfig?.imageSize;
  try {
    const response = await call();
    await recordUsage({ ctx, provider: 'gemini', model: request.model, imageSize, tokens: geminiTokens({ ...(response as any), modelVersion: request.model }, imageSize), durationMs: Date.now() - started });
    return response;
  } catch (e) {
    await recordUsage({ ctx, provider: 'gemini', model: request.model, imageSize, durationMs: Date.now() - started, error: e });
    throw e;
  }
}

/** Run a Claude messages.create call and log its usage; the message is returned unchanged. */
export async function trackClaude<T>(ctx: UsageContext, call: () => Promise<T>, request: { model: string }): Promise<T> {
  const started = Date.now();
  try {
    const message = await call();
    await recordUsage({ ctx, provider: 'anthropic', model: request.model, tokens: claudeTokens(message), durationMs: Date.now() - started });
    return message;
  } catch (e) {
    await recordUsage({ ctx, provider: 'anthropic', model: request.model, durationMs: Date.now() - started, error: e });
    throw e;
  }
}

/** `ai.models.generateContent(request)` with usage logging (drop-in: same request, same response) */
export function generateWithUsage<R = GenerateContentResponse>(ai: { models: { generateContent: (req: any) => Promise<R> } }, ctx: UsageContext, request: { model: string; config?: any; [k: string]: any }): Promise<R> {
  return trackGemini(ctx, () => ai.models.generateContent(request), request);
}

/** `anthropic.messages.create(request)` with usage logging (drop-in) */
export function createWithUsage<R = Anthropic.Messages.Message>(client: { messages: { create: (req: any) => any } }, ctx: UsageContext, request: { model: string; [k: string]: any }): Promise<R> {
  return trackClaude(ctx, () => client.messages.create(request) as Promise<R>, request);
}
