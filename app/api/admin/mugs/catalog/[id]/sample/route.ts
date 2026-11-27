import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { v2 as cloudinary } from 'cloudinary';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { buildMugPreviewUrl, buildMugPrintUrl } from '@/lib/cloudinary-mug';
import { compositeParams } from '@/lib/mugs/server';
import { mugPaintingRequest, mugTemplate } from '@/lib/mugs/painting';
import { generateWithUsage } from '@/lib/ai/usage';
import { SAMPLE_PAINTED_FOLDER, sampleWrapPublicId, validateSampleInput } from '@/lib/mugs/sample';
import type { MugCatalogEntry, MugColour } from '@/lib/product-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

/**
 * POST /api/admin/mugs/catalog/[id]/sample
 * Body: { mode: 'reference' | 'photo', colour, name, photo_public_id? }
 * Makes a print file for a Gelato sample: the design's own picture, or a pet painted into the design's
 * scene from an uploaded photo (one AI picture). The file is the same wrap an order's print file is.
 * Nothing is ordered, sent to Gelato, or saved against a customer.
 * Returns { printFileUrl, flatPreviewUrl, paintedUrl?, width, height }.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { id } = await params;
    const parsed = validateSampleInput(await request.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { mode, colour: colourSlug, name, photoPublicId } = parsed.value;

    const supabase = serviceClient();
    const [{ data: entry }, { data: colours }] = await Promise.all([
      supabase.from('mug_catalog').select('*').eq('id', id).maybeSingle(),
      supabase.from('mug_colours').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
    ]);
    if (!entry) return NextResponse.json({ error: 'Design not found' }, { status: 404 });
    const list = (colours ?? []) as MugColour[];
    if (!list.length) return NextResponse.json({ error: 'Add a mug colour first' }, { status: 400 });
    const colour = list.find((c) => c.slug === colourSlug);
    if (!colour) return NextResponse.json({ error: 'Colour not found' }, { status: 404 });
    const design = entry as MugCatalogEntry;
    if (!design.catalog_image_public_id) return NextResponse.json({ error: 'This design has no scene image yet' }, { status: 400 });

    if (!cloudinary.config().cloud_name) {
      cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });
    }

    let pictureId = design.catalog_image_public_id;
    let paintedUrl: string | undefined;

    if (mode === 'photo') {
      // Stage 1, as in the customer route: paint the pet into the design's scene (one AI picture, no retry)
      const petPhotoUrl = cloudinary.url(photoPublicId!, { secure: true });
      const [scene, pet] = await Promise.all([fetchImage(design.catalog_image_url), fetchImage(petPhotoUrl)]);
      const template = await mugTemplate(supabase, design, scene);
      const { request: paintRequest } = mugPaintingRequest({ entry: design, template, scene, pet, colourHex: colour.hex });
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const geminiResponse: any = await generateWithUsage(ai, { feature: 'mug_sample', meta: { design: design.slug, template: !!template } }, paintRequest);
      const painted: string | undefined = geminiResponse.candidates?.[0]?.content?.parts?.find((p: any) => p?.inlineData?.data)?.inlineData?.data;
      if (!painted) return NextResponse.json({ error: 'The painting didn’t come back; please try again' }, { status: 502 });
      const up: any = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          { folder: SAMPLE_PAINTED_FOLDER, resource_type: 'image', tags: ['mug-sample', 'mug-sample-painted'] },
          (e, r) => (e ? reject(e) : resolve(r)),
        ).end(Buffer.from(painted, 'base64'));
      });
      pictureId = up.public_id;
      paintedUrl = up.secure_url;
    }

    const p = compositeParams(pictureId, name, colour, design);
    const printUrl = buildMugPrintUrl(p);
    const hash = createHash('sha1').update(`${printUrl}|${Date.now()}`).digest('hex').slice(0, 10);
    const stored = await cloudinary.uploader.upload(printUrl, {
      public_id: sampleWrapPublicId(design.slug, colour.slug, hash),
      overwrite: false,
      resource_type: 'image',
      tags: ['mug-sample'],
    });

    return NextResponse.json({
      printFileUrl: stored.secure_url,
      flatPreviewUrl: buildMugPreviewUrl(p),
      ...(paintedUrl ? { paintedUrl } : {}),
      width: stored.width,
      height: stored.height,
    });
  } catch (error) {
    console.error('Mug sample print file failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Could not make the sample print file' }, { status: 500 });
  }
}

async function fetchImage(url: string): Promise<{ data: string; mimeType: string }> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch an image (${response.status})`);
  const buf = Buffer.from(await response.arrayBuffer());
  const type = (response.headers.get('content-type') || 'image/jpeg').split(';')[0];
  return { data: buf.toString('base64'), mimeType: ['image/png', 'image/webp', 'image/jpeg'].includes(type) ? type : 'image/jpeg' };
}
