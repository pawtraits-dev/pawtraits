/**
 * Breed versions of quiz pictures, made in bulk with the Gemini Batch API (half price, results
 * usually within minutes to a few hours, at most 24 h). Server only.
 *
 *   question pictures → 1K, stored as Cloudinary images in quiz_question_breed_images and shown on
 *                       the quiz cards when the quiz taker picked that breed
 *   result type designs → 2K, saved to the catalogue (like on-the-spot breed pictures) and linked
 *                       in quiz_breed_images, so the result page uses them straight away
 *
 * planBreedRun   what a request would make (skipping versions that exist or are on their way) + cost
 * createBreedRun writes the run, one item per picture, split into Gemini jobs of ~20
 * quizImageTick  (cron every 2 min, or "Check now") submits jobs, checks them, stores results
 */
import { GoogleGenAI } from '@google/genai';
import { v2 as cloudinary } from 'cloudinary';
import type { SupabaseClient } from '@supabase/supabase-js';
import { GEMINI_IMAGE_MODELS, imageDimensions, toGeminiAspectRatio } from '@/lib/gemini-models';
import { nearestAllowedRatio } from '@/lib/print/print-geometry';
import { chunk, estimateBatchImageCost, jobStateFromGemini } from '@/lib/variations/combos';
import { jsonlLines } from '@/lib/variations/batch';
import { geminiTokens, recordUsage } from '@/lib/ai/usage';
import { loadTypeDesign, saveBreedDesign } from '@/lib/quiz/breed-images';

export type BreedRunKind = 'question' | 'type';
export const SIZE_FOR: Record<BreedRunKind, '1K' | '2K'> = { question: '1K', type: '2K' };
const JOB_SIZE = 20;
const LOCK_MS = 6 * 60_000;
const REFERENCE_FILE_MAX_AGE_MS = 40 * 3600_000; // Gemini keeps uploaded files 48 h
const WAITING = ['queued', 'submitted'];

let client: GoogleGenAI | null = null;
function gemini(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) throw new Error('Gemini API key not configured');
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}
function configureCloudinary() {
  if (!cloudinary.config().cloud_name) {
    cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });
  }
}
const cloudName = () => process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
export const thumbUrl = (publicId: string | null | undefined, w = 200) =>
  publicId && cloudName() ? `https://res.cloudinary.com/${cloudName()}/image/upload/c_limit,w_${w}/f_auto,q_auto/${publicId}` : null;

export const perImageCost = (kind: BreedRunKind) => estimateBatchImageCost(GEMINI_IMAGE_MODELS.pro, SIZE_FOR[kind]);

// ---------------------------------------------------------------------------------------------
// What can be made

export interface BreedSource { key: string; label: string; publicId: string; questionId?: string; typeCode?: string; sourceImageId?: string }

/** Pictures that can get breed versions: active questions with a picture, or types with a main design */
export async function sourcesFor(supabase: SupabaseClient, quizId: string, kind: BreedRunKind): Promise<BreedSource[]> {
  if (kind === 'question') {
    const { data } = await supabase.from('quiz_questions').select('id, statement, image_public_id, sort_order')
      .eq('quiz_id', quizId).eq('is_active', true).not('image_public_id', 'is', null).order('sort_order');
    return (data ?? []).map((q: any) => ({ key: q.id, label: q.statement, publicId: q.image_public_id, questionId: q.id }));
  }
  const { data: types } = await supabase.from('quiz_result_types').select('code, name, design_image_id')
    .eq('quiz_id', quizId).not('design_image_id', 'is', null).order('code');
  const ids = (types ?? []).map((t: any) => t.design_image_id);
  const { data: imgs } = ids.length ? await supabase.from('image_catalog').select('id, cloudinary_public_id').in('id', ids) : { data: [] as any[] };
  const pid = new Map((imgs ?? []).map((i: any) => [i.id, i.cloudinary_public_id]));
  return (types ?? []).filter((t: any) => pid.get(t.design_image_id))
    .map((t: any) => ({ key: t.code, label: `${t.code} · ${t.name}`, publicId: pid.get(t.design_image_id)!, typeCode: t.code, sourceImageId: t.design_image_id }));
}

/** `${sourceKey}:${breedId}` for versions that exist (for the current picture) or are on their way */
export async function takenKeys(supabase: SupabaseClient, kind: BreedRunKind, sources: BreedSource[], breedIds: string[]): Promise<Set<string>> {
  const taken = new Set<string>();
  if (!sources.length || !breedIds.length) return taken;
  if (kind === 'question') {
    const { data } = await supabase.from('quiz_question_breed_images').select('question_id, breed_id, source_public_id')
      .in('question_id', sources.map(s => s.questionId!)).in('breed_id', breedIds);
    const current = new Map(sources.map(s => [s.questionId, s.publicId]));
    for (const r of data ?? []) if (current.get(r.question_id) === r.source_public_id) taken.add(`${r.question_id}:${r.breed_id}`);
    const { data: items } = await supabase.from('quiz_image_run_items').select('question_id, breed_id, source_public_id')
      .in('question_id', sources.map(s => s.questionId!)).in('breed_id', breedIds).in('status', WAITING);
    for (const r of items ?? []) if (current.get(r.question_id) === r.source_public_id) taken.add(`${r.question_id}:${r.breed_id}`);
  } else {
    const byImage = new Map(sources.map(s => [s.sourceImageId, s.key]));
    const ids = sources.map(s => s.sourceImageId!);
    const { data } = await supabase.from('quiz_breed_images').select('source_image_id, breed_id, status')
      .in('source_image_id', ids).in('breed_id', breedIds).in('status', ['done', 'running']);
    for (const r of data ?? []) taken.add(`${byImage.get(r.source_image_id)}:${r.breed_id}`);
    const { data: items } = await supabase.from('quiz_image_run_items').select('source_image_id, breed_id')
      .in('source_image_id', ids).in('breed_id', breedIds).in('status', WAITING);
    for (const r of items ?? []) taken.add(`${byImage.get(r.source_image_id)}:${r.breed_id}`);
  }
  return taken;
}

export async function planBreedRun(supabase: SupabaseClient, quizId: string, kind: BreedRunKind, breedIds: string[]) {
  const sources = await sourcesFor(supabase, quizId, kind);
  const taken = await takenKeys(supabase, kind, sources, breedIds);
  const make: { source: BreedSource; breedId: string }[] = [];
  for (const breedId of breedIds) for (const source of sources) if (!taken.has(`${source.key}:${breedId}`)) make.push({ source, breedId });
  const each = perImageCost(kind);
  return {
    kind, imageSize: SIZE_FOR[kind], model: GEMINI_IMAGE_MODELS.pro,
    sources: sources.length, breeds: breedIds.length,
    total: sources.length * breedIds.length, make, skipped: sources.length * breedIds.length - make.length,
    perImageUsd: each, estimatedCostUsd: Math.round(make.length * each * 100) / 100,
  };
}

// ---------------------------------------------------------------------------------------------
// Prompt

export function breedPrompt(animal: 'dog' | 'cat', breed: { name: string }, coat?: string | null): string {
  const coatText = coat ? ` with a ${coat.toLowerCase()} coat` : ' with a typical coat colour for the breed';
  return `Repaint the ${animal} in this picture as a ${breed.name}${coatText}. Give it the ${breed.name}'s true head shape, muzzle, ears, eyes, body build, proportions, coat length, texture and markings, so an owner would recognise their own breed.
Keep everything else exactly the same: the pose and expression, any clothing and accessories, props, people, background, framing and composition, and the art style (line work, shading, colours and level of detail).
Do not add any text, signature or border.`;
}

/** Each breed's most common coat name, for the prompt */
async function commonCoats(supabase: SupabaseClient, breedIds: string[]): Promise<Map<string, string>> {
  const { data } = await supabase.from('breed_coats').select('breed_id, is_common, is_standard, coats:coat_id (name)').in('breed_id', breedIds);
  const out = new Map<string, string>();
  const rank = (r: any) => (r.is_common ? 2 : 0) + (r.is_standard ? 1 : 0);
  for (const r of (data ?? []).sort((a: any, b: any) => rank(b) - rank(a))) {
    if (!out.has(r.breed_id) && (r as any).coats?.name) out.set(r.breed_id, (r as any).coats.name);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Creating a run

export async function createBreedRun(supabase: SupabaseClient, quizId: string, kind: BreedRunKind, breedIds: string[]) {
  const planned = await planBreedRun(supabase, quizId, kind, breedIds);
  if (!planned.make.length) return { run: null, planned };
  const { data: quiz } = await supabase.from('quizzes').select('animal_type').eq('id', quizId).single();
  const ids = Array.from(new Set(planned.make.map(m => m.breedId)));
  const [{ data: breeds }, coats] = await Promise.all([
    supabase.from('breeds').select('id, name').in('id', ids),
    commonCoats(supabase, ids),
  ]);
  const breedById = new Map((breeds ?? []).map((b: any) => [b.id, b]));

  const { data: run, error } = await supabase.from('quiz_image_runs').insert({
    quiz_id: quizId, kind, image_size: planned.imageSize, model: planned.model, status: 'queued',
    item_count: planned.make.length, estimated_cost_usd: planned.estimatedCostUsd,
  }).select().single();
  if (error || !run) throw new Error(error?.message || 'Could not create the run');

  const items = planned.make.filter(m => breedById.has(m.breedId)).map(m => ({
    run_id: run.id,
    question_id: m.source.questionId ?? null,
    type_code: m.source.typeCode ?? null,
    source_image_id: m.source.sourceImageId ?? null,
    source_public_id: m.source.publicId,
    breed_id: m.breedId,
    prompt: breedPrompt(quiz!.animal_type, breedById.get(m.breedId), coats.get(m.breedId)),
    status: 'queued',
  }));
  const jobChunks = chunk(items, JOB_SIZE);
  const { data: jobs, error: jobError } = await supabase.from('quiz_image_run_jobs')
    .insert(jobChunks.map(c => ({ run_id: run.id, item_count: c.length, state: 'queued' }))).select('id');
  if (jobError || !jobs) throw new Error(jobError?.message || 'Could not create jobs');
  jobChunks.forEach((c, i) => c.forEach((it: any) => { it.job_id = jobs[i].id; }));
  for (const page of chunk(items, 500)) {
    const { error: e } = await supabase.from('quiz_image_run_items').insert(page);
    if (e) throw new Error(e.message);
  }
  return { run: { ...run, jobs: jobs.length }, planned };
}

// ---------------------------------------------------------------------------------------------
// Tick: submit → check → store results

async function referenceFile(supabase: SupabaseClient, run: any, publicId: string): Promise<{ uri: string; mimeType: string; aspect?: string }> {
  const existing = run.reference_files?.[publicId];
  if (existing?.uri && Date.now() - new Date(existing.uploadedAt).getTime() < REFERENCE_FILE_MAX_AGE_MS) return existing;
  const url = `https://res.cloudinary.com/${cloudName()}/image/upload/c_limit,w_1536,h_1536/f_png/${publicId}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Couldn't fetch the source picture (${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const dims = imageDimensions(bytes);
  const aspect = dims ? toGeminiAspectRatio(nearestAllowedRatio(dims.width, dims.height).ratio) : undefined;
  const file = await gemini().files.upload({ file: new Blob([bytes], { type: 'image/png' }), config: { mimeType: 'image/png', displayName: `quiz-src-${publicId.split('/').slice(-2).join('-')}` } });
  if (!file.uri) throw new Error('Gemini did not return a file uri');
  const entry = { uri: file.uri, mimeType: file.mimeType || 'image/png', aspect, uploadedAt: new Date().toISOString() };
  run.reference_files = { ...(run.reference_files ?? {}), [publicId]: entry };
  await supabase.from('quiz_image_runs').update({ reference_files: run.reference_files }).eq('id', run.id);
  return entry;
}

async function submitJob(supabase: SupabaseClient, job: any) {
  const { data: run } = await supabase.from('quiz_image_runs').select('*').eq('id', job.run_id).single();
  if (!run || run.status === 'cancelled') { await supabase.from('quiz_image_run_jobs').update({ state: 'cancelled' }).eq('id', job.id); return; }
  const { data: items } = await supabase.from('quiz_image_run_items').select('id, source_public_id, prompt').eq('job_id', job.id).eq('status', 'queued');
  if (!items?.length) { await supabase.from('quiz_image_run_jobs').update({ state: 'processed', processed_at: new Date().toISOString() }).eq('id', job.id); return; }
  try {
    const lines: string[] = [];
    for (const it of items) {
      const ref = await referenceFile(supabase, run, it.source_public_id);
      const imageConfig: Record<string, string> = { imageSize: run.image_size };
      if (ref.aspect) imageConfig.aspectRatio = ref.aspect;
      lines.push(JSON.stringify({
        key: it.id,
        request: {
          contents: [{ role: 'user', parts: [{ text: it.prompt }, { fileData: { fileUri: ref.uri, mimeType: ref.mimeType } }] }],
          generationConfig: { responseModalities: ['IMAGE'], imageConfig },
        },
      }));
    }
    const ai = gemini();
    const src = await ai.files.upload({ file: new Blob([lines.join('\n')], { type: 'application/jsonl' }), config: { mimeType: 'jsonl', displayName: `quiz-${job.id}` } });
    const batch = await ai.batches.create({ model: run.model, src: src.name!, config: { displayName: `pawtraits-quiz-${run.id.slice(0, 8)}-${job.id.slice(0, 8)}` } });
    await supabase.from('quiz_image_run_jobs').update({ state: 'submitted', gemini_name: batch.name, submitted_at: new Date().toISOString(), attempts: job.attempts + 1, error: null, item_count: items.length }).eq('id', job.id);
    await supabase.from('quiz_image_run_items').update({ status: 'submitted', updated_at: new Date().toISOString() }).in('id', items.map(i => i.id));
    if (run.status === 'queued') await supabase.from('quiz_image_runs').update({ status: 'running' }).eq('id', run.id);
  } catch (e: any) {
    const error = String(e?.message || e).slice(0, 500);
    const attempts = job.attempts + 1;
    console.error('Quiz batch submit failed:', job.id, error);
    await supabase.from('quiz_image_run_jobs').update({ attempts, error, state: attempts >= 5 ? 'failed' : 'queued' }).eq('id', job.id);
    if (attempts >= 5) await supabase.from('quiz_image_run_items').update({ status: 'failed', error: `Couldn't submit to Gemini: ${error}` }).eq('job_id', job.id).eq('status', 'queued');
  }
}

async function pollJob(supabase: SupabaseClient, job: any) {
  const b: any = await gemini().batches.get({ name: job.gemini_name });
  const state = jobStateFromGemini(b.state);
  if (state === 'running') {
    if (job.state !== 'running' && b.state === 'JOB_STATE_RUNNING') await supabase.from('quiz_image_run_jobs').update({ state: 'running' }).eq('id', job.id);
    return;
  }
  if (state === 'succeeded') {
    await supabase.from('quiz_image_run_jobs').update({ state: 'succeeded', result_file: b.dest?.fileName ?? null, finished_at: new Date().toISOString() }).eq('id', job.id);
    return;
  }
  const reason = state === 'expired' ? 'Gemini didn’t finish within 48 hours' : state === 'cancelled' ? 'Cancelled' : `Gemini batch failed${b.error?.message ? `: ${b.error.message}` : ''}`;
  await supabase.from('quiz_image_run_jobs').update({ state, error: reason, finished_at: new Date().toISOString() }).eq('id', job.id);
  await supabase.from('quiz_image_run_items').update({ status: state === 'cancelled' ? 'cancelled' : 'failed', error: reason }).eq('job_id', job.id).in('status', WAITING);
}

async function fetchResults(fileName: string): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(`https://generativelanguage.googleapis.com/download/v1beta/${fileName}:download?alt=media`, { headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY! } });
  if (!res.ok || !res.body) throw new Error(`Couldn't download Gemini results (${res.status})`);
  return res.body;
}

/** Store one finished picture where the quiz reads it */
async function storeResult(supabase: SupabaseClient, run: any, quiz: any, item: any, buffer: Buffer, breed: any) {
  if (run.kind === 'question') {
    configureCloudinary();
    const uploaded: any = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: `quiz/${quiz.slug}_${quiz.animal_type}/${item.question_id}`, public_id: `breed-${breed?.slug || item.breed_id}-${Date.now()}`, resource_type: 'image', tags: ['quiz', 'quiz-breed', quiz.slug, quiz.animal_type] },
        (err, res) => (err ? reject(err) : resolve(res)),
      ).end(buffer);
    });
    // Only if the question still has the picture this was made from
    const { data: q } = await supabase.from('quiz_questions').select('image_public_id').eq('id', item.question_id).maybeSingle();
    if (q?.image_public_id === item.source_public_id) {
      const { error } = await supabase.from('quiz_question_breed_images').upsert({
        question_id: item.question_id, breed_id: item.breed_id, source_public_id: item.source_public_id,
        image_public_id: uploaded.public_id, updated_at: new Date().toISOString(),
      }, { onConflict: 'question_id,breed_id' });
      if (error) throw new Error(error.message);
    }
    return { result_public_id: uploaded.public_id as string, result_image_id: null };
  }
  const source = await loadTypeDesign(item.source_image_id);
  if (!source) throw new Error('Type design no longer exists');
  const imageId = await saveBreedDesign({ source, breed, code: item.type_code, buffer, prompt: source.prompt_text });
  const now = new Date().toISOString();
  const { error } = await supabase.from('quiz_breed_images').upsert({
    animal_type: quiz.animal_type, type_code: item.type_code, breed_id: item.breed_id, source_image_id: item.source_image_id,
    image_id: imageId, status: 'done', error: null, requested_by: 'admin', updated_at: now,
  }, { onConflict: 'source_image_id,breed_id' });
  if (error) throw new Error(error.message);
  return { result_public_id: null, result_image_id: imageId };
}

async function processJob(supabase: SupabaseClient, job: any, deadline: number): Promise<'done' | 'partial' | 'locked'> {
  const staleBefore = new Date(Date.now() - LOCK_MS).toISOString();
  const now = new Date().toISOString();
  let { data: locked } = await supabase.from('quiz_image_run_jobs').update({ processing_started_at: now })
    .eq('id', job.id).eq('state', 'succeeded').is('processing_started_at', null).select('id');
  if (!locked?.length) {
    ({ data: locked } = await supabase.from('quiz_image_run_jobs').update({ processing_started_at: now })
      .eq('id', job.id).eq('state', 'succeeded').lt('processing_started_at', staleBefore).select('id'));
  }
  if (!locked?.length) return 'locked';

  const { data: run } = await supabase.from('quiz_image_runs').select('*').eq('id', job.run_id).single();
  const { data: quiz } = await supabase.from('quizzes').select('slug, animal_type').eq('id', run!.quiz_id).single();
  const { data: items } = await supabase.from('quiz_image_run_items').select('*').eq('job_id', job.id);
  const breedIds = Array.from(new Set((items ?? []).map((i: any) => i.breed_id)));
  const { data: breeds } = await supabase.from('breeds').select('id, name, slug').in('id', breedIds);
  const breedById = new Map((breeds ?? []).map((b: any) => [b.id, b]));
  const byId = new Map((items ?? []).map((i: any) => [i.id, i]));
  const seen = new Set<string>();
  let outOfTime = false;
  try {
    if (!job.result_file) throw new Error('Gemini reported success but no results file');
    for await (const line of jsonlLines(await fetchResults(job.result_file))) {
      let parsed: any;
      try { parsed = JSON.parse(line); } catch { continue; }
      const item = byId.get(parsed.key);
      if (!item) continue;
      seen.add(item.id);
      if (!WAITING.includes(item.status)) continue; // done on an earlier pass
      if (Date.now() > deadline) { outOfTime = true; break; }
      const response = parsed.response;
      const ctx = { feature: 'quiz-image' as const, batch: true, meta: { quizRun: run!.id, item: item.id, kind: run!.kind } };
      const imagePart = response?.candidates?.[0]?.content?.parts?.find((p: any) => p?.inlineData?.data);
      if (parsed.error || !imagePart) {
        const reason = parsed.error?.message || `No image (${response?.candidates?.[0]?.finishReason || response?.promptFeedback?.blockReason || 'no reason given'})`;
        await recordUsage({ ctx, provider: 'gemini', model: run!.model, imageSize: run!.image_size, tokens: response ? geminiTokens(response, run!.image_size) : undefined, durationMs: 0, error: reason });
        await supabase.from('quiz_image_run_items').update({ status: 'failed', error: String(reason).slice(0, 500), updated_at: new Date().toISOString() }).eq('id', item.id);
        continue;
      }
      try {
        const stored = await storeResult(supabase, run, quiz, item, Buffer.from(imagePart.inlineData.data, 'base64'), breedById.get(item.breed_id));
        await recordUsage({ ctx, provider: 'gemini', model: run!.model, imageSize: run!.image_size, tokens: geminiTokens({ ...response, modelVersion: run!.model }, run!.image_size), durationMs: 0 });
        await supabase.from('quiz_image_run_items').update({ status: 'done', error: null, ...stored, updated_at: new Date().toISOString() }).eq('id', item.id);
      } catch (e: any) {
        await supabase.from('quiz_image_run_items').update({ status: 'failed', error: `Couldn't store the picture: ${String(e?.message || e).slice(0, 300)}` }).eq('id', item.id);
      }
    }
    if (outOfTime) {
      await supabase.from('quiz_image_run_jobs').update({ processing_started_at: null }).eq('id', job.id);
      return 'partial';
    }
    const missing = (items ?? []).filter((i: any) => !seen.has(i.id) && WAITING.includes(i.status)).map((i: any) => i.id);
    if (missing.length) await supabase.from('quiz_image_run_items').update({ status: 'failed', error: 'Missing from Gemini results' }).in('id', missing);
    await supabase.from('quiz_image_run_jobs').update({ state: 'processed', processed_at: new Date().toISOString(), processing_started_at: null }).eq('id', job.id);
    return 'done';
  } catch (e: any) {
    await supabase.from('quiz_image_run_jobs').update({ processing_started_at: null, error: String(e?.message || e).slice(0, 500), attempts: (job.attempts ?? 0) + 1 }).eq('id', job.id);
    throw e;
  }
}

/** Mark runs done once nothing is waiting */
async function refreshRuns(supabase: SupabaseClient) {
  const { data: runs } = await supabase.from('quiz_image_runs').select('id').in('status', ['queued', 'running']);
  for (const run of runs ?? []) {
    const { count } = await supabase.from('quiz_image_run_items').select('id', { count: 'exact', head: true }).eq('run_id', run.id).in('status', WAITING);
    if (!count) await supabase.from('quiz_image_runs').update({ status: 'done', completed_at: new Date().toISOString() }).eq('id', run.id);
  }
}

export async function quizImageTick(supabase: SupabaseClient, budgetMs = 240_000) {
  const deadline = Date.now() + budgetMs;
  const summary = { submitted: 0, checked: 0, processed: 0, partial: 0, errors: [] as string[] };

  const { data: queued } = await supabase.from('quiz_image_run_jobs').select('*').eq('state', 'queued').order('created_at').limit(25);
  for (const job of queued ?? []) {
    if (Date.now() > deadline - 60_000) break;
    await submitJob(supabase, job);
    summary.submitted++;
  }
  const { data: active } = await supabase.from('quiz_image_run_jobs').select('*').in('state', ['submitted', 'running']).order('submitted_at').limit(100);
  for (const job of active ?? []) {
    if (Date.now() > deadline - 30_000) break;
    try { await pollJob(supabase, job); summary.checked++; } catch (e: any) { summary.errors.push(`check ${job.id}: ${e?.message || e}`); }
  }
  const { data: done } = await supabase.from('quiz_image_run_jobs').select('*').eq('state', 'succeeded').order('finished_at').limit(20);
  for (const job of done ?? []) {
    if (Date.now() > deadline - 20_000) break;
    try {
      const r = await processJob(supabase, job, deadline - 15_000);
      if (r === 'done') summary.processed++;
      if (r === 'partial') { summary.partial++; break; }
    } catch (e: any) { summary.errors.push(`results ${job.id}: ${e?.message || e}`); }
  }
  await refreshRuns(supabase);
  return summary;
}

/** Stop a run: queued jobs are dropped; jobs already with Gemini are cancelled there */
export async function cancelBreedRun(supabase: SupabaseClient, runId: string) {
  const { data: jobs } = await supabase.from('quiz_image_run_jobs').select('id, gemini_name, state').eq('run_id', runId).in('state', ['queued', 'submitted', 'running']);
  for (const j of jobs ?? []) {
    if (j.gemini_name) { try { await gemini().batches.cancel({ name: j.gemini_name }); } catch { /* already finished */ } }
  }
  await supabase.from('quiz_image_run_jobs').update({ state: 'cancelled' }).eq('run_id', runId).in('state', ['queued', 'submitted', 'running']);
  await supabase.from('quiz_image_run_items').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('run_id', runId).in('status', WAITING);
  await supabase.from('quiz_image_runs').update({ status: 'cancelled', completed_at: new Date().toISOString() }).eq('id', runId);
}
