import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { v2 as cloudinary } from 'cloudinary';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { buildPaintingPrompt, paintingRequest, imageFrom, CUSTOMER_PREVIEW_SIZE } from '@/lib/customise/painting';
import { renderPrintMaster } from '@/lib/print/print-master';
import { generateWithUsage, geminiTokens } from '@/lib/ai/usage';
import { costOf } from '@/lib/ai/prices';
import { buildSizeInstruction } from '@/lib/breed-size-mapping';
import { loadSlots, subjectsOf } from '@/lib/catalog/slots-server';
import { slotNow } from '@/lib/catalog/slots';
import { GEMINI_IMAGE_MODELS } from '@/lib/gemini-models';

export const maxDuration = 300;

/**
 * Admin size test: the customer painting for one design and uploaded pet photo(s), made at
 * several sizes from the same prompt and inputs, plus (optionally) the 4K print master made
 * from the 1K result, which is what a buyer gets if previews are 1K. Nothing is saved to the
 * catalogue or shown to customers; images go to Cloudinary under pawtraits/size-tests.
 */
const SIZES = ['1K', '2K', '4K'];
const FOLDER = 'pawtraits/size-tests';

function configure() {
  cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });
}

async function upload(data: Buffer | string, publicId: string, transformation?: any[]): Promise<any> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream({ public_id: `${FOLDER}/${publicId}`, resource_type: 'image', tags: ['size-test'], overwrite: true, ...(transformation ? { transformation } : {}) },
      (e, r) => (e ? reject(e) : resolve(r))).end(typeof data === 'string' ? Buffer.from(data, 'base64') : data);
  });
}

async function fetchBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't load ${url.slice(0, 80)} (${res.status})`);
  return Buffer.from(await res.arrayBuffer()).toString('base64');
}

/** The size customer previews are made at now */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json({ customerPreviewSize: CUSTOMER_PREVIEW_SIZE });
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });

  const form = await request.formData();
  const catalogImageId = String(form.get('catalogImageId') || '');
  const photos = form.getAll('photos').filter((f): f is File => typeof f === 'object' && 'arrayBuffer' in f).slice(0, 5);
  const sizes = String(form.get('sizes') || '1K,4K').split(',').filter((s) => SIZES.includes(s));
  const withMaster = form.get('master') === '1';
  if (!catalogImageId || !photos.length) return NextResponse.json({ error: 'Choose a design and add a pet photo' }, { status: 400 });
  if (!sizes.length && !withMaster) return NextResponse.json({ error: 'Choose at least one size' }, { status: 400 });

  const supabase = serviceClient();
  const { data: design } = await supabase.from('image_catalog')
    .select('id, cloudinary_public_id, public_url, prompt_text, generation_parameters, subjects, description, breeds (id, name), themes (id, name), styles (id, name), formats (id, name, aspect_ratio)')
    .eq('id', catalogImageId).maybeSingle();
  if (!design) return NextResponse.json({ error: 'Design not found' }, { status: 404 });
  const d: any = design;
  const testId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  try {
    configure();
    // Same inputs as the customise page: pet photos stored at most 1024 px, design at its catalogue URL
    const petUrls: string[] = [];
    for (let i = 0; i < photos.length; i++) {
      const up = await upload(Buffer.from(await photos[i].arrayBuffer()), `${testId}/pet-${i + 1}`, [{ width: 1024, height: 1024, crop: 'limit' }, { quality: 'auto', fetch_format: 'auto' }]);
      petUrls.push(up.secure_url);
    }
    const catalogUrl = d.public_url;
    if (!catalogUrl) throw new Error('Design has no image URL');
    const [catalogImageData, ...petImageData] = await Promise.all([fetchBase64(catalogUrl), ...petUrls.map(fetchBase64)]);

    // Same prompt as the customise page
    let slotPlan;
    if (petUrls.length > 1) {
      const slots = await loadSlots(supabase, subjectsOf(d));
      if (slots.length === petUrls.length) slotPlan = slots.map((slot) => ({ label: slot.label, now: slotNow(slot) }));
    }
    const sizeInstruction = petUrls.length > 1 ? buildSizeInstruction(petUrls.map(() => ({ name: 'Pet', animalType: 'dog' as const }))) : undefined;
    const aspectRatio = d.formats?.aspect_ratio ?? undefined;
    const prompt = buildPaintingPrompt({
      variationPromptTemplate: d.generation_parameters?.variation_prompt_template,
      aspectRatio, sizeInstruction, slotPlan,
      petCount: petUrls.length,
      themeName: d.themes?.name || 'Custom', styleName: d.styles?.name || 'Portrait', breedName: d.breeds?.name || 'Pet',
    });

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const model = GEMINI_IMAGE_MODELS.pro;
    const run = async (label: string, size: string, make: () => Promise<{ base64: string; response?: any }>) => {
      const started = Date.now();
      try {
        const { base64, response } = await make();
        const seconds = (Date.now() - started) / 1000;
        const up = await upload(base64, `${testId}/${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`);
        const tokens = response ? geminiTokens({ ...response, modelVersion: model }, size) : null;
        return {
          label, size, ok: true as const, seconds: Math.round(seconds * 10) / 10,
          url: up.secure_url, publicId: up.public_id, width: up.width, height: up.height, bytes: up.bytes,
          costUsd: tokens ? costOf(model, tokens)?.total ?? null : null,
          tokens: tokens ? { input: tokens.inputTokens, thinking: tokens.thinkingTokens, image: tokens.outputImageTokens } : null,
          base64,
        };
      } catch (e: any) {
        return { label, size, ok: false as const, seconds: Math.round((Date.now() - started) / 100) / 10, error: e?.message || 'Failed' };
      }
    };

    const generate = (size: string) => run(`${size} preview`, size, async () => {
      const response = await generateWithUsage(ai, { feature: 'size-test', imageId: d.id, meta: { testId, size } },
        paintingRequest({ prompt, catalogImageData, petImageData, aspectRatio, imageSize: size }));
      const base64 = imageFrom(response);
      if (!base64) throw new Error(`No image (${(response as any)?.candidates?.[0]?.finishReason || 'no reason given'})`);
      return { base64, response };
    });

    const wanted = withMaster && !sizes.includes('1K') ? ['1K', ...sizes] : sizes;
    const jobs = wanted.map((size) => generate(size));
    const results: any[] = await Promise.all(jobs.map(async (job, i) => {
      const r = await job;
      if (wanted[i] === '1K' && withMaster && r.ok) {
        const master = await run('4K master from the 1K', '4K', async () => {
          // renderPrintMaster records its own usage; time and size come from here
          return { base64: await renderPrintMaster(ai, r.base64, { feature: 'size-test', imageId: d.id, meta: { testId, size: '4K-master' } }) };
        });
        return [r, master];
      }
      return [r];
    }));
    const flat = results.flat().map(({ base64, ...rest }: any) => rest);
    // Master cost isn't in its response here: estimate from the 4K image price + input
    for (const r of flat) if (r.ok && r.costUsd == null && r.label.includes('master')) r.costUsd = costOf(model, { inputTokens: 1800, outputTextTokens: 0, thinkingTokens: 800, outputImageTokens: 3780 })?.total ?? null;

    return NextResponse.json({
      testId,
      design: { id: d.id, title: (d.description || '').replace(/\*\*/g, '').slice(0, 80), aspectRatio: aspectRatio ?? null },
      customerPreviewSize: CUSTOMER_PREVIEW_SIZE,
      prompt,
      petUrls,
      results: flat,
    });
  } catch (e: any) {
    console.error('Size test failed:', e);
    return NextResponse.json({ error: e?.message || 'Size test failed' }, { status: 500 });
  }
}
