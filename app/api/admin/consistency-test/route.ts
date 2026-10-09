import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { v2 as cloudinary } from 'cloudinary';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { buildPaintingPrompt, paintingRequest, imageFrom, CUSTOMER_PREVIEW_SIZE } from '@/lib/customise/painting';
import { buildFocusedPaintingPrompt } from '@/lib/customise/focused-prompt';
import { generateWithUsage, geminiTokens } from '@/lib/ai/usage';
import { costOf } from '@/lib/ai/prices';

export const maxDuration = 300;

/**
 * Admin consistency test: one design and one pet photo, painted several times with each of a few
 * set-ups (model, design image, prompt), side by side. Shows whether a change makes the swap more
 * faithful and more repeatable before it goes near customers. Results go to pawtraits/consistency-tests.
 */
const FOLDER = 'pawtraits/consistency-tests';
const LIVE_MODEL = 'gemini-nano-banana-2.1';
const OLD_MODEL = 'gemini-3-pro-image';

type DesignImage = 'live' | 'clean';
type PromptKind = 'live' | 'focused';
const VARIANTS: Record<string, { label: string; model: string; design: DesignImage; prompt: PromptKind }> = {
  live: { label: 'As live now', model: LIVE_MODEL, design: 'live', prompt: 'live' },
  clean: { label: 'Clean design image', model: LIVE_MODEL, design: 'clean', prompt: 'live' },
  'clean-focused': { label: 'Clean design + focused prompt', model: LIVE_MODEL, design: 'clean', prompt: 'focused' },
  old: { label: 'Old model (3 Pro Image), as live', model: OLD_MODEL, design: 'live', prompt: 'live' },
  'old-clean-focused': { label: 'Old model + clean design + focused prompt', model: OLD_MODEL, design: 'clean', prompt: 'focused' },
};
const MAX_CALLS = 15;
const PARALLEL = 8;

function configure() {
  cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });
}

function upload(data: Buffer, publicId: string, transformation?: any[]): Promise<any> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream({ public_id: `${FOLDER}/${publicId}`, resource_type: 'image', tags: ['consistency-test'], overwrite: true, ...(transformation ? { transformation } : {}) },
      (e, r) => (e ? reject(e) : resolve(r))).end(data);
  });
}

async function fetchBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't load ${url.slice(0, 80)} (${res.status})`);
  return Buffer.from(await res.arrayBuffer()).toString('base64');
}

async function pool<T>(jobs: (() => Promise<T>)[], size: number): Promise<T[]> {
  const out: T[] = new Array(jobs.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, jobs.length) }, async () => {
    while (next < jobs.length) { const i = next++; out[i] = await jobs[i](); }
  }));
  return out;
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json({ variants: Object.entries(VARIANTS).map(([key, v]) => ({ key, ...v })), size: CUSTOMER_PREVIEW_SIZE, maxCalls: MAX_CALLS });
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });

  const form = await request.formData();
  const catalogImageId = String(form.get('catalogImageId') || '');
  const photo = form.get('photo');
  const petUrlIn = String(form.get('petUrl') || '');
  const keys = String(form.get('variants') || '').split(',').filter((k) => VARIANTS[k]);
  const repeats = Math.min(Math.max(Number(form.get('repeats')) || 3, 1), 3);
  if (!catalogImageId) return NextResponse.json({ error: 'Choose a design' }, { status: 400 });
  if (!keys.length) return NextResponse.json({ error: 'Choose at least one set-up' }, { status: 400 });
  if (keys.length * repeats > MAX_CALLS) return NextResponse.json({ error: `At most ${MAX_CALLS} paintings per test` }, { status: 400 });
  const cloudPrefix = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/`;
  if (!(photo && typeof photo === 'object') && !petUrlIn.startsWith(cloudPrefix)) return NextResponse.json({ error: 'Add a pet photo or pick one from a recent customisation' }, { status: 400 });

  const supabase = serviceClient();
  const { data: design } = await supabase.from('image_catalog')
    .select('id, cloudinary_public_id, public_url, description, generation_parameters, breeds (name), themes (name), styles (name), formats (aspect_ratio)')
    .eq('id', catalogImageId).maybeSingle();
  if (!design) return NextResponse.json({ error: 'Design not found' }, { status: 404 });
  const d: any = design;
  const one = (v: any) => (Array.isArray(v) ? v[0] : v);
  const testId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  try {
    configure();
    // Pet photo: an uploaded one is stored exactly as the customise page stores it (≤1024 px)
    let petUrl = petUrlIn;
    if (photo && typeof photo === 'object' && 'arrayBuffer' in photo) {
      const up = await upload(Buffer.from(await (photo as File).arrayBuffer()), `${testId}/pet`, [{ width: 1024, height: 1024, crop: 'limit' }, { quality: 'auto', fetch_format: 'auto' }]);
      petUrl = up.secure_url;
    }

    const designUrls: Record<DesignImage, string> = {
      live: d.public_url,
      // The design's original, no watermark, 1024 px wide
      clean: cloudinary.url(d.cloudinary_public_id, { width: 1024, crop: 'limit', format: 'jpg', quality: 90, secure: true }),
    };
    const needed = new Set(keys.map((k) => VARIANTS[k].design));
    const [petData, ...designData] = await Promise.all([fetchBase64(petUrl), ...Array.from(needed).map((k) => fetchBase64(designUrls[k]))]);
    const designB64 = Object.fromEntries(Array.from(needed).map((k, i) => [k, designData[i]])) as Record<DesignImage, string>;

    const aspectRatio = one(d.formats)?.aspect_ratio ?? undefined;
    const prompts: Record<PromptKind, string> = {
      live: buildPaintingPrompt({
        variationPromptTemplate: d.generation_parameters?.variation_prompt_template, aspectRatio, petCount: 1,
        themeName: one(d.themes)?.name || 'Custom', styleName: one(d.styles)?.name || 'Portrait', breedName: one(d.breeds)?.name || 'Pet',
      }),
      focused: buildFocusedPaintingPrompt({ designAnimal: one(d.breeds)?.name, aspectRatio }),
    };

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const jobs = keys.flatMap((key) => Array.from({ length: repeats }, (_, r) => async () => {
      const v = VARIANTS[key];
      const started = Date.now();
      try {
        const req = { ...paintingRequest({ prompt: prompts[v.prompt], catalogImageData: designB64[v.design], petImageData: [petData], aspectRatio, imageSize: CUSTOMER_PREVIEW_SIZE }), model: v.model };
        const response = await generateWithUsage(ai, { feature: 'consistency-test', imageId: d.id, meta: { testId, variant: key, repeat: r + 1 } }, req);
        const seconds = Math.round((Date.now() - started) / 100) / 10;
        const base64 = imageFrom(response);
        if (!base64) throw new Error(`No image (${(response as any)?.candidates?.[0]?.finishReason || 'no reason given'})`);
        const up = await upload(Buffer.from(base64, 'base64'), `${testId}/${key}-${r + 1}`);
        const tokens = geminiTokens({ ...response, modelVersion: v.model }, CUSTOMER_PREVIEW_SIZE);
        return {
          variant: key, repeat: r + 1, ok: true, seconds, url: up.secure_url, width: up.width, height: up.height,
          thinking: tokens.thinkingTokens, input: tokens.inputTokens, costUsd: costOf(v.model, tokens)?.total ?? null,
        };
      } catch (e: any) {
        return { variant: key, repeat: r + 1, ok: false, seconds: Math.round((Date.now() - started) / 100) / 10, error: e?.message || 'Failed' };
      }
    }));
    const results = await pool(jobs, PARALLEL);

    return NextResponse.json({
      testId,
      design: { id: d.id, title: (d.description || '').replace(/\*\*/g, '').slice(0, 80), aspectRatio: aspectRatio ?? null, animal: one(d.breeds)?.name ?? null },
      size: CUSTOMER_PREVIEW_SIZE,
      petUrl,
      designUrls,
      prompts,
      variants: keys.map((key) => ({ key, ...VARIANTS[key] })),
      results,
    });
  } catch (e: any) {
    console.error('Consistency test failed:', e);
    return NextResponse.json({ error: e?.message || 'Consistency test failed' }, { status: 500 });
  }
}
