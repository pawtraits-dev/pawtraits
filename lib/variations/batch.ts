import { GoogleGenAI } from '@google/genai';
import type { SupabaseClient } from '@supabase/supabase-js';
import { v2 as cloudinary } from 'cloudinary';
import { GeminiVariationService } from '@/lib/gemini-variation-service';
import { GEMINI_IMAGE_MODELS, toGeminiAspectRatio } from '@/lib/gemini-models';
import { loadCatalogImageBase64, uploadVariationPreview, promoteVariationPreview } from '@/lib/catalog/variation-previews';
import { registerCloudinaryImage } from '@/lib/catalog/register-image';
import { geminiTokens, recordUsage } from '@/lib/ai/usage';
import { plainTitle, chunk, combosFor, estimateBatchImageCost, jobStateFromGemini, plan, TAKEN_ITEM_STATES, type Recipe } from '@/lib/variations/combos';

/**
 * Saved variation batches run through the Gemini Batch API.
 *
 *   createRun   expand the recipe for each reference, skip combinations the reference already
 *               has, write one item per image and split them into jobs of ~20.
 *   tick        (every 2 min from cron, or "Check now") submits queued jobs, checks running
 *               ones and reads finished results: each image goes to Cloudinary as a preview
 *               and the item waits for review. Safe to repeat: finished items are skipped.
 *   approve     moves previews into the catalogue (no re-upload) as public or hidden designs.
 */

export const JOB_SIZE = Number(process.env.VARIATION_BATCH_JOB_SIZE) || 20;
const REFERENCE_FILE_MAX_AGE_MS = 40 * 3600_000; // Gemini keeps uploaded files 48 h
const LOCK_MS = 6 * 60_000;

let client: GoogleGenAI | null = null;
function gemini(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API key not configured');
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);

// ---------------------------------------------------------------------------------------------
// Planning

export interface ReferencePlan {
  id: string;
  title: string;
  thumb: string | null;
  make: number;
  skipped: number;
  excluded?: string;
}

const REF_FIELDS = 'id, description, prompt_text, public_url, image_variants, cloudinary_public_id, breed_id, coat_id, theme_id, style_id, format_id, subject_count, is_multi_subject';

async function loadReferences(supabase: SupabaseClient, ids: string[]) {
  const { data, error } = await supabase.from('image_catalog').select(REF_FIELDS).in('id', ids);
  if (error) throw new Error(error.message);
  const byId = new Map((data ?? []).map((r: any) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter(Boolean) as any[];
}

/** Keys each reference already has: saved variations, plus items queued or waiting for review */
export async function takenKeys(supabase: SupabaseClient, refIds: string[]): Promise<Map<string, Set<string>>> {
  const taken = new Map<string, Set<string>>(refIds.map((id) => [id, new Set<string>()]));
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase.from('image_catalog').select('variation_of, variation_key')
      .in('variation_of', refIds).not('variation_key', 'is', null).range(from, from + page - 1);
    if (error) { if (/variation_of/.test(error.message)) break; throw new Error(error.message); }
    for (const r of data ?? []) taken.get(r.variation_of)?.add(r.variation_key);
    if (!data || data.length < page) break;
  }
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase.from('variation_run_items').select('reference_image_id, variation_key')
      .in('reference_image_id', refIds).in('status', [...TAKEN_ITEM_STATES]).range(from, from + page - 1);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) taken.get(r.reference_image_id)?.add(r.variation_key);
    if (!data || data.length < page) break;
  }
  return taken;
}

const isMultiPet = (r: any) => (r.subject_count ?? 1) > 1 || r.is_multi_subject;

export async function planRun(supabase: SupabaseClient, recipe: Recipe, refIds: string[], imageSize: string) {
  const refs = await loadReferences(supabase, refIds);
  const combos = combosFor(recipe);
  const taken = await takenKeys(supabase, refs.map((r) => r.id));
  const references: ReferencePlan[] = refs.map((r) => {
    const base = { id: r.id, title: plainTitle(r.description), thumb: r.image_variants?.thumbnail?.url || r.public_url || null };
    if (recipe.breedCoats.length && isMultiPet(r)) return { ...base, make: 0, skipped: 0, excluded: 'Has more than one pet: breed/coat changes need a single-pet design' };
    if (!r.prompt_text) return { ...base, make: 0, skipped: 0, excluded: 'No prompt stored for this design' };
    const p = plan(combos, taken.get(r.id) ?? new Set());
    return { ...base, make: p.make.length, skipped: p.skipped };
  });
  const total = references.reduce((s, r) => s + r.make, 0);
  const model = GEMINI_IMAGE_MODELS.pro;
  return { references, perReference: combos.length, total, model, estimatedCostUsd: Math.round(total * estimateBatchImageCost(model, imageSize) * 100) / 100 };
}

// ---------------------------------------------------------------------------------------------
// Creating a run

export async function createRun(supabase: SupabaseClient, opts: { recipe: Recipe; recipeId?: string | null; name: string; refIds: string[]; imageSize: string; targetAge?: string }) {
  const { recipe, refIds, imageSize } = opts;
  const planned = await planRun(supabase, recipe, refIds, imageSize);
  if (planned.total === 0) return { run: null, planned };

  const refs = await loadReferences(supabase, planned.references.filter((r) => r.make > 0).map((r) => r.id));
  const combos = combosFor(recipe);
  const taken = await takenKeys(supabase, refs.map((r) => r.id));

  // Data for prompts
  const breedIds = Array.from(new Set([...recipe.breedCoats.map((b) => b.breedId), ...refs.map((r) => r.breed_id).filter(Boolean)]));
  const coatIds = Array.from(new Set(recipe.breedCoats.map((b) => b.coatId)));
  const [breedsR, coatsR, bcR, outfitsR, themesR, stylesR, formatsR] = await Promise.all([
    breedIds.length ? supabase.from('breeds').select('*').in('id', breedIds) : Promise.resolve({ data: [] as any[] }),
    supabase.from('coats').select('id, name, slug, hex_color, pattern_type, rarity').in('id', Array.from(new Set([...coatIds, ...refs.map((r) => r.coat_id).filter(Boolean)]))),
    coatIds.length ? supabase.from('breed_coats').select('id, breed_id, coat_id').in('coat_id', coatIds) : Promise.resolve({ data: [] as any[] }),
    recipe.outfitIds.length ? supabase.from('outfits').select('*').in('id', recipe.outfitIds) : Promise.resolve({ data: [] as any[] }),
    supabase.from('themes').select('*').in('id', refs.map((r) => r.theme_id).filter(Boolean)),
    supabase.from('styles').select('*').in('id', refs.map((r) => r.style_id).filter(Boolean)),
    supabase.from('formats').select('*').in('id', refs.map((r) => r.format_id).filter(Boolean)),
  ]);
  const byId = (rows: any[] | null | undefined) => new Map((rows ?? []).map((r: any) => [r.id, r]));
  const breeds = byId(breedsR.data), coats = byId(coatsR.data), outfits = byId(outfitsR.data);
  const themes = byId(themesR.data), styles = byId(stylesR.data), formats = byId(formatsR.data);
  const breedCoatId = new Map((bcR.data ?? []).map((r: any) => [`${r.breed_id}:${r.coat_id}`, r.id]));
  const coatFor = (breedId: string, coatId: string) => {
    const c = coats.get(coatId);
    return c && { id: c.id, breed_coat_id: breedCoatId.get(`${breedId}:${coatId}`) ?? null, coat_name: c.name, coat_slug: c.slug, hex_color: c.hex_color, pattern_type: c.pattern_type, rarity: c.rarity };
  };

  const service = new GeminiVariationService();
  const model = GEMINI_IMAGE_MODELS.pro;
  const { data: run, error: runError } = await supabase.from('variation_runs').insert({
    recipe_id: opts.recipeId ?? null,
    name: opts.name,
    recipe_snapshot: recipe,
    reference_ids: refs.map((r) => r.id),
    image_size: imageSize,
    model,
    status: 'queued',
    estimated_cost_usd: planned.estimatedCostUsd,
  }).select().single();
  if (runError || !run) throw new Error(runError?.message || 'Could not create the run');

  const items: any[] = [];
  for (const ref of refs) {
    const theme = themes.get(ref.theme_id), style = styles.get(ref.style_id), format = formats.get(ref.format_id);
    const originalBreed = breeds.get(ref.breed_id) ?? null;
    const originalCoat = ref.coat_id ? coatFor(ref.breed_id, ref.coat_id) : null;
    const aspect = toGeminiAspectRatio(service.aspectRatioFor(ref.prompt_text, format));
    for (const combo of plan(combos, taken.get(ref.id) ?? new Set()).make) {
      const breed = combo.breedId ? breeds.get(combo.breedId) : null;
      const coat = combo.breedId && combo.coatId ? coatFor(combo.breedId, combo.coatId) : null;
      const outfit = combo.outfitId ? outfits.get(combo.outfitId) : null;
      if ((combo.breedId && (!breed || !coat)) || (combo.outfitId && !outfit)) continue; // deleted since saved
      const label = [breed?.name, coat?.coat_name, outfit?.name].filter(Boolean).join(' · ');
      const p = service.promptsFor({ originalPrompt: ref.prompt_text, targetBreed: breed, coat, outfit, theme, style, originalBreed, originalCoat, format, targetAge: opts.targetAge });
      items.push({
        run_id: run.id,
        reference_image_id: ref.id,
        variation_key: combo.key,
        label,
        breed_id: combo.breedId,
        coat_id: combo.coatId,
        outfit_id: combo.outfitId,
        status: 'queued',
        gemini_prompt: p.geminiPrompt,
        metadata: {
          catalog_prompt: p.catalogPrompt,
          variation_type: p.variationType,
          tags: [...p.tags, 'batch-generated'],
          aspect_ratio: aspect ?? null,
          breed_id: combo.breedId ?? ref.breed_id ?? null,
          coat_id: combo.coatId ?? ref.coat_id ?? null,
          outfit_id: combo.outfitId ?? null,
          format_id: ref.format_id ?? null,
          theme_id: ref.theme_id ?? null,
          style_id: ref.style_id ?? null,
          breed_name: breed?.name ?? originalBreed?.name ?? null,
          filename: `batch-${slug(label)}-${String(run.id).slice(0, 8)}`,
        },
      });
    }
  }

  // Jobs of JOB_SIZE, items written in pages
  const jobChunks = chunk(items, JOB_SIZE);
  const { data: jobs, error: jobError } = await supabase.from('variation_run_jobs')
    .insert(jobChunks.map((c) => ({ run_id: run.id, item_count: c.length, state: 'queued' }))).select('id');
  if (jobError || !jobs) throw new Error(jobError?.message || 'Could not create jobs');
  jobChunks.forEach((c, i) => c.forEach((it) => { it.job_id = jobs[i].id; }));
  for (const page of chunk(items, 500)) {
    const { error } = await supabase.from('variation_run_items').insert(page);
    if (error) throw new Error(error.message);
  }
  if (opts.recipeId) await supabase.from('variation_recipes').update({ last_run_at: new Date().toISOString() }).eq('id', opts.recipeId);
  return { run: { ...run, total: items.length, jobs: jobs.length }, planned };
}

// ---------------------------------------------------------------------------------------------
// Tick: submit → check → read results

/** Injection points for tests (default: real Gemini, Cloudinary and image download) */
export interface Deps {
  ai?: Pick<GoogleGenAI, 'files' | 'batches'> | any;
  fetchResults?: ResultsFetcher;
  uploadPreview?: typeof uploadVariationPreview;
  loadReference?: (ref: { cloudinary_public_id?: string | null; public_url?: string | null }) => Promise<string>;
  describe?: (imageUrl: string, breedName?: string) => Promise<string>;
}

// ---------------------------------------------------------------------------------------------
// Descriptions: written by Claude from each preview as soon as it's back, before review

const defaultDescribe = async (imageUrl: string, breedName?: string) => {
  const { ImageDescriptionGenerator } = await import('@/lib/image-description-generator');
  return new ImageDescriptionGenerator().generateDescription(imageUrl, breedName);
};

/** One item's description (the 768 px PNG preview: small, and a format Claude accepts) */
export async function describeItem(supabase: SupabaseClient, item: { id: string; preview_thumb_url: string | null; preview_url: string | null; metadata: any }, deps: Deps = {}): Promise<string | null> {
  const url = item.preview_thumb_url || item.preview_url;
  if (!url) return null;
  try {
    const text = (await (deps.describe ?? defaultDescribe)(url, item.metadata?.breed_name ?? undefined))?.trim();
    if (!text || /^Unable to generate/i.test(text)) throw new Error('No description returned');
    await supabase.from('variation_run_items').update({ description: text, description_error: null, updated_at: new Date().toISOString() }).eq('id', item.id);
    return text;
  } catch (e: any) {
    await supabase.from('variation_run_items').update({ description_error: String(e?.message || e).slice(0, 300) }).eq('id', item.id);
    return null;
  }
}

/** Describe images waiting for review that don't have one yet, 4 at a time, until the deadline */
export async function describePending(supabase: SupabaseClient, deadline: number, deps: Deps = {}): Promise<number> {
  const { data: items, error } = await supabase.from('variation_run_items')
    .select('id, preview_thumb_url, preview_url, metadata')
    .eq('status', 'generated').is('description', null).is('description_error', null)
    .order('created_at').limit(60);
  if (error) { if (/description/.test(error.message)) return 0; throw new Error(error.message); } // migration not run yet
  const queue = [...(items ?? [])];
  let done = 0;
  const worker = async () => {
    while (queue.length && Date.now() < deadline) {
      const item = queue.shift()!;
      if (await describeItem(supabase, item, deps)) done++;
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return done;
}

async function referenceFile(supabase: SupabaseClient, run: any, refId: string, deps: Deps = {}): Promise<{ uri: string; mimeType: string }> {
  const existing = run.reference_files?.[refId];
  if (existing?.uri && Date.now() - new Date(existing.uploadedAt).getTime() < REFERENCE_FILE_MAX_AGE_MS) return existing;
  const { data: ref } = await supabase.from('image_catalog').select('cloudinary_public_id, public_url').eq('id', refId).maybeSingle();
  if (!ref) throw new Error('Reference design no longer exists');
  const base64 = await (deps.loadReference ?? loadCatalogImageBase64)(ref);
  const file = await (deps.ai ?? gemini()).files.upload({ file: new Blob([Buffer.from(base64, 'base64')], { type: 'image/png' }), config: { mimeType: 'image/png', displayName: `ref-${refId}` } });
  if (!file.uri) throw new Error('Gemini did not return a file uri');
  const entry = { uri: file.uri, mimeType: file.mimeType || 'image/png', uploadedAt: new Date().toISOString() };
  run.reference_files = { ...(run.reference_files ?? {}), [refId]: entry };
  await supabase.from('variation_runs').update({ reference_files: run.reference_files }).eq('id', run.id);
  return entry;
}

/** One JSONL line per item: prompt + the reference image (uploaded once per run) */
export function batchRequestLine(item: { id: string; gemini_prompt: string; metadata: any }, file: { uri: string; mimeType: string }, imageSize: string): string {
  const imageConfig: Record<string, string> = { imageSize };
  if (item.metadata?.aspect_ratio) imageConfig.aspectRatio = item.metadata.aspect_ratio;
  return JSON.stringify({
    key: item.id,
    request: {
      contents: [{ role: 'user', parts: [{ text: item.gemini_prompt }, { fileData: { fileUri: file.uri, mimeType: file.mimeType } }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig },
    },
  });
}

async function submitJob(supabase: SupabaseClient, job: any, deps: Deps = {}): Promise<void> {
  const { data: run } = await supabase.from('variation_runs').select('*').eq('id', job.run_id).single();
  if (!run || run.status === 'cancelled') { await supabase.from('variation_run_jobs').update({ state: 'cancelled' }).eq('id', job.id); return; }
  const { data: items } = await supabase.from('variation_run_items').select('id, reference_image_id, gemini_prompt, metadata').eq('job_id', job.id).eq('status', 'queued');
  if (!items?.length) { await supabase.from('variation_run_jobs').update({ state: 'processed', processed_at: new Date().toISOString() }).eq('id', job.id); return; }
  try {
    const lines: string[] = [];
    for (const it of items) lines.push(batchRequestLine(it, await referenceFile(supabase, run, it.reference_image_id, deps), run.image_size));
    const ai = deps.ai ?? gemini();
    const src = await ai.files.upload({ file: new Blob([lines.join('\n')], { type: 'application/jsonl' }), config: { mimeType: 'jsonl', displayName: `pawtraits-${job.id}` } });
    const batch = await ai.batches.create({ model: run.model, src: src.name!, config: { displayName: `pawtraits-${run.id.slice(0, 8)}-${job.id.slice(0, 8)}` } });
    await supabase.from('variation_run_jobs').update({ state: 'submitted', gemini_name: batch.name, submitted_at: new Date().toISOString(), attempts: job.attempts + 1, error: null, item_count: items.length }).eq('id', job.id);
    await supabase.from('variation_run_items').update({ status: 'submitted', updated_at: new Date().toISOString() }).in('id', items.map((i) => i.id));
    if (run.status === 'queued') await supabase.from('variation_runs').update({ status: 'running' }).eq('id', run.id);
  } catch (e: any) {
    const error = String(e?.message || e).slice(0, 500);
    const attempts = job.attempts + 1;
    console.error('Batch submit failed:', job.id, error);
    // Rate limits and hiccups: try again next tick; give up after 5 attempts
    await supabase.from('variation_run_jobs').update({ attempts, error, state: attempts >= 5 ? 'failed' : 'queued' }).eq('id', job.id);
    if (attempts >= 5) await supabase.from('variation_run_items').update({ status: 'failed', error: `Couldn't submit to Gemini: ${error}` }).eq('job_id', job.id).eq('status', 'queued');
  }
}

async function pollJob(supabase: SupabaseClient, job: any, deps: Deps = {}): Promise<void> {
  const b: any = await (deps.ai ?? gemini()).batches.get({ name: job.gemini_name });
  const state = jobStateFromGemini(b.state);
  if (state === 'running') {
    if (job.state !== 'running' && b.state === 'JOB_STATE_RUNNING') await supabase.from('variation_run_jobs').update({ state: 'running' }).eq('id', job.id);
    return;
  }
  if (state === 'succeeded') {
    await supabase.from('variation_run_jobs').update({ state: 'succeeded', result_file: b.dest?.fileName ?? null, finished_at: new Date().toISOString() }).eq('id', job.id);
    return;
  }
  const reason = state === 'expired' ? 'Gemini didn’t finish within 48 hours' : state === 'cancelled' ? 'Cancelled' : `Gemini batch failed${b.error?.message ? `: ${b.error.message}` : ''}`;
  await supabase.from('variation_run_jobs').update({ state, error: reason, finished_at: new Date().toISOString() }).eq('id', job.id);
  await supabase.from('variation_run_items').update({ status: state === 'cancelled' ? 'cancelled' : 'failed', error: reason }).eq('job_id', job.id).in('status', ['queued', 'submitted']);
}

/** Read a JSONL results file line by line without holding it all in memory */
export async function* jsonlLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  let parts: Buffer[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    let buf = Buffer.from(value);
    let nl: number;
    while ((nl = buf.indexOf(0x0a)) !== -1) {
      parts.push(buf.subarray(0, nl));
      const line = Buffer.concat(parts).toString('utf8').trim();
      parts = [];
      if (line) yield line;
      buf = buf.subarray(nl + 1);
    }
    if (buf.length) parts.push(buf);
  }
  const last = Buffer.concat(parts).toString('utf8').trim();
  if (last) yield last;
}

export type ResultsFetcher = (fileName: string) => Promise<ReadableStream<Uint8Array>>;
const fetchResults: ResultsFetcher = async (fileName) => {
  const res = await fetch(`https://generativelanguage.googleapis.com/download/v1beta/${fileName}:download?alt=media`, { headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY! } });
  if (!res.ok || !res.body) throw new Error(`Couldn't download Gemini results (${res.status})`);
  return res.body;
};


/** Turn one finished job's results into previews. Stops early (resumable) when out of time. */
async function processJob(supabase: SupabaseClient, job: any, deadline: number, deps: Deps): Promise<'done' | 'partial' | 'locked'> {
  const staleBefore = new Date(Date.now() - LOCK_MS).toISOString();
  // Take the lock: free, or held by a run that died more than LOCK_MS ago (two atomic updates)
  const now = new Date().toISOString();
  let { data: locked } = await supabase.from('variation_run_jobs').update({ processing_started_at: now })
    .eq('id', job.id).eq('state', 'succeeded').is('processing_started_at', null).select('id');
  if (!locked?.length) {
    ({ data: locked } = await supabase.from('variation_run_jobs').update({ processing_started_at: now })
      .eq('id', job.id).eq('state', 'succeeded').lt('processing_started_at', staleBefore).select('id'));
  }
  if (!locked?.length) return 'locked';

  const { data: run } = await supabase.from('variation_runs').select('id, image_size, model').eq('id', job.run_id).single();
  const { data: items } = await supabase.from('variation_run_items').select('id, status, reference_image_id, label, metadata').eq('job_id', job.id);
  const byId = new Map((items ?? []).map((i: any) => [i.id, i]));
  const upload = deps.uploadPreview ?? uploadVariationPreview;
  const seen = new Set<string>();
  let outOfTime = false;
  try {
    if (!job.result_file) throw new Error('Gemini reported success but no results file');
    for await (const line of jsonlLines(await (deps.fetchResults ?? fetchResults)(job.result_file))) {
      let parsed: any;
      try { parsed = JSON.parse(line); } catch { continue; }
      const item = byId.get(parsed.key);
      if (!item) continue;
      seen.add(item.id);
      if (item.status !== 'submitted' && item.status !== 'queued') continue; // done on an earlier pass
      if (Date.now() > deadline) { outOfTime = true; break; }
      const response = parsed.response;
      const ctx = { feature: 'admin-variation' as const, batch: true, batchJobId: run!.id, imageId: item.reference_image_id, meta: { item: item.id } };
      const imagePart = response?.candidates?.[0]?.content?.parts?.find((p: any) => p?.inlineData?.data);
      if (parsed.error || !imagePart) {
        const reason = parsed.error?.message || `No image (${response?.candidates?.[0]?.finishReason || response?.promptFeedback?.blockReason || 'no reason given'})`;
        await recordUsage({ ctx, provider: 'gemini', model: run!.model, imageSize: run!.image_size, tokens: response ? geminiTokens(response, run!.image_size) : undefined, durationMs: 0, error: reason });
        await supabase.from('variation_run_items').update({ status: 'failed', error: String(reason).slice(0, 500), updated_at: new Date().toISOString() }).eq('id', item.id);
        continue;
      }
      try {
        const buffer = Buffer.from(imagePart.inlineData.data, 'base64');
        const preview = await upload(buffer, `${item.metadata?.filename || 'batch'}-${item.id.slice(0, 8)}.png`);
        await recordUsage({ ctx, provider: 'gemini', model: run!.model, imageSize: run!.image_size, tokens: geminiTokens({ ...response, modelVersion: run!.model }, run!.image_size), durationMs: 0 });
        await supabase.from('variation_run_items').update({
          status: 'generated', error: null, updated_at: new Date().toISOString(),
          preview_public_id: preview.preview_public_id, preview_url: preview.preview_url, preview_thumb_url: preview.preview_thumb_url,
          width: preview.width, height: preview.height,
        }).eq('id', item.id);
      } catch (e: any) {
        await supabase.from('variation_run_items').update({ status: 'failed', error: `Couldn't store the image: ${String(e?.message || e).slice(0, 300)}` }).eq('id', item.id);
      }
    }
    if (outOfTime) {
      await supabase.from('variation_run_jobs').update({ processing_started_at: null }).eq('id', job.id);
      return 'partial';
    }
    // Anything Gemini never answered
    const missing = (items ?? []).filter((i: any) => !seen.has(i.id) && (i.status === 'submitted' || i.status === 'queued')).map((i: any) => i.id);
    if (missing.length) await supabase.from('variation_run_items').update({ status: 'failed', error: 'Missing from Gemini results' }).in('id', missing);
    await supabase.from('variation_run_jobs').update({ state: 'processed', processed_at: new Date().toISOString(), processing_started_at: null }).eq('id', job.id);
    return 'done';
  } catch (e: any) {
    await supabase.from('variation_run_jobs').update({ processing_started_at: null, error: String(e?.message || e).slice(0, 500), attempts: (job.attempts ?? 0) + 1 }).eq('id', job.id);
    throw e;
  }
}

/** Move each run to review / done once nothing is waiting */
export async function refreshRunStatuses(supabase: SupabaseClient, runIds?: string[]): Promise<void> {
  let q = supabase.from('variation_runs').select('id, status').in('status', ['queued', 'running', 'review']);
  if (runIds?.length) q = q.in('id', runIds);
  const { data: runs } = await q;
  for (const run of runs ?? []) {
    const { data: c } = await supabase.from('variation_run_counts').select('*').eq('run_id', run.id).maybeSingle();
    if (!c) continue;
    const next = c.waiting > 0 ? (run.status === 'queued' ? 'queued' : 'running') : c.to_review > 0 ? 'review' : 'done';
    if (next !== run.status) await supabase.from('variation_runs').update({ status: next, completed_at: next === 'done' ? new Date().toISOString() : null }).eq('id', run.id);
  }
}

export async function tick(supabase: SupabaseClient, budgetMs = 240_000, deps: Deps = {}) {
  const deadline = Date.now() + budgetMs;
  const summary = { submitted: 0, checked: 0, processed: 0, partial: 0, described: 0, errors: [] as string[] };

  const { data: queued } = await supabase.from('variation_run_jobs').select('*').eq('state', 'queued').order('created_at').limit(25);
  for (const job of queued ?? []) {
    if (Date.now() > deadline - 60_000) break;
    await submitJob(supabase, job, deps);
    summary.submitted++;
  }

  const { data: active } = await supabase.from('variation_run_jobs').select('*').in('state', ['submitted', 'running']).order('submitted_at').limit(100);
  for (const job of active ?? []) {
    if (Date.now() > deadline - 30_000) break;
    try { await pollJob(supabase, job, deps); summary.checked++; } catch (e: any) { summary.errors.push(`check ${job.id}: ${e?.message || e}`); }
  }

  const { data: done } = await supabase.from('variation_run_jobs').select('*').eq('state', 'succeeded').order('finished_at').limit(20);
  for (const job of done ?? []) {
    if (Date.now() > deadline - 20_000) break;
    try {
      const r = await processJob(supabase, job, deadline - 15_000, deps);
      if (r === 'done') summary.processed++;
      if (r === 'partial') { summary.partial++; break; }
    } catch (e: any) { summary.errors.push(`results ${job.id}: ${e?.message || e}`); }
  }

  // Descriptions for whatever is back (also picks up any left over from earlier ticks)
  try { summary.described = await describePending(supabase, deadline - 10_000, deps); } catch (e: any) { summary.errors.push(`describe: ${e?.message || e}`); }

  await refreshRunStatuses(supabase);
  return summary;
}

// ---------------------------------------------------------------------------------------------
// Review

export async function approveItems(supabase: SupabaseClient, runId: string, ids: string[], visibility: 'public' | 'hidden', deps: Deps = {}) {
  const { data: items } = await supabase.from('variation_run_items').select('*').eq('run_id', runId).in('id', ids).eq('status', 'generated');
  const results: { id: string; ok: boolean; imageId?: string; error?: string }[] = [];
  for (const item of items ?? []) {
    try {
      const m = item.metadata ?? {};
      // The description written (and maybe edited) before review; write one now if it's missing
      const description = item.description || await describeItem(supabase, item, deps) || '';
      const moved = await promoteVariationPreview(item.preview_public_id, `${m.filename || 'batch'}-${item.id.slice(0, 8)}.png`);
      const saved = await registerCloudinaryImage(supabase, {
        cloudinary_public_id: moved.public_id,
        cloudinary_secure_url: moved.secure_url,
        original_filename: `${moved.public_id.split('/').pop()}.${moved.format}`,
        file_size: moved.bytes,
        mime_type: `image/${moved.format === 'jpg' ? 'jpeg' : moved.format}`,
        prompt_text: m.catalog_prompt || '',
        description,
        tags: m.tags || ['variation', 'batch-generated'],
        breed_id: m.breed_id, coat_id: m.coat_id, format_id: m.format_id, theme_id: m.theme_id, style_id: m.style_id,
        rating: 4,
        is_featured: false,
        is_public: visibility === 'public',
        variation_of: item.reference_image_id,
        variation_key: item.variation_key,
      });
      await supabase.from('variation_run_items').update({ status: 'approved', saved_image_id: saved.id, preview_public_id: moved.public_id, preview_url: moved.secure_url, updated_at: new Date().toISOString() }).eq('id', item.id);
      results.push({ id: item.id, ok: true, imageId: saved.id });
    } catch (e: any) {
      results.push({ id: item.id, ok: false, error: e?.message || 'Save failed' });
    }
  }
  await refreshRunStatuses(supabase, [runId]);
  return results;
}

export async function rejectItems(supabase: SupabaseClient, runId: string, ids: string[]) {
  const { data: items } = await supabase.from('variation_run_items').select('id, preview_public_id').eq('run_id', runId).in('id', ids).in('status', ['generated', 'failed']);
  const publicIds = (items ?? []).map((i: any) => i.preview_public_id).filter(Boolean);
  if (publicIds.length) {
    try {
      cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });
      for (const page of chunk(publicIds, 100)) await cloudinary.api.delete_resources(page);
    } catch (e) { console.warn('Preview delete failed (left for clean-up):', e); }
  }
  await supabase.from('variation_run_items').update({ status: 'rejected', updated_at: new Date().toISOString() }).in('id', (items ?? []).map((i: any) => i.id));
  await refreshRunStatuses(supabase, [runId]);
  return (items ?? []).length;
}

export async function cancelRun(supabase: SupabaseClient, runId: string, deps: Deps = {}) {
  const { data: jobs } = await supabase.from('variation_run_jobs').select('*').eq('run_id', runId).in('state', ['queued', 'submitted', 'running']);
  for (const job of jobs ?? []) {
    if (job.gemini_name) { try { await (deps.ai ?? gemini()).batches.cancel({ name: job.gemini_name }); } catch (e) { console.warn('Gemini cancel failed:', e); } }
    await supabase.from('variation_run_jobs').update({ state: 'cancelled', finished_at: new Date().toISOString() }).eq('id', job.id);
  }
  await supabase.from('variation_run_items').update({ status: 'cancelled', error: 'Cancelled' }).eq('run_id', runId).in('status', ['queued', 'submitted']);
  await supabase.from('variation_runs').update({ status: 'cancelled', completed_at: new Date().toISOString() }).eq('id', runId);
}

/** Queue failed items again in new jobs */
export async function retryFailed(supabase: SupabaseClient, runId: string): Promise<number> {
  const { data: failed } = await supabase.from('variation_run_items').select('id').eq('run_id', runId).eq('status', 'failed');
  if (!failed?.length) return 0;
  const chunks = chunk(failed.map((f: any) => f.id), JOB_SIZE);
  const { data: jobs, error } = await supabase.from('variation_run_jobs').insert(chunks.map((c) => ({ run_id: runId, item_count: c.length, state: 'queued' }))).select('id');
  if (error || !jobs) throw new Error(error?.message || 'Could not queue');
  for (let i = 0; i < chunks.length; i++) {
    await supabase.from('variation_run_items').update({ status: 'queued', error: null, job_id: jobs[i].id, updated_at: new Date().toISOString() }).in('id', chunks[i]);
  }
  await supabase.from('variation_runs').update({ status: 'running', completed_at: null }).eq('id', runId);
  return failed.length;
}
