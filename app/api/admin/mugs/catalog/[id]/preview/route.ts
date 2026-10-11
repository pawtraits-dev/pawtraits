import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { v2 as cloudinary } from 'cloudinary';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { buildMugPreviewUrl, buildMugPrintUrl } from '@/lib/cloudinary-mug';
import { compositeParams } from '@/lib/mugs/server';
import { mugMockups } from '@/lib/mugs/mockup';
import type { MugCatalogEntry, MugColour } from '@/lib/product-types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PREVIEW_NAME = 'Daisy';

/**
 * GET /api/admin/mugs/catalog/[id]/preview?colour=<slug>
 * What a mug from this design looks like, using the design's own scene and the name "Daisy".
 * The wrap is stored once per design + colour + text (re-made automatically when any of them change),
 * because the mockup photos need it as a stored image.
 * Returns { colours, colour, name, flat, mockups: { pet?, text? } }.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { id } = await params;
    const supabase = serviceClient();
    const [{ data: entry }, { data: colours }] = await Promise.all([
      supabase.from('mug_catalog').select('*').eq('id', id).maybeSingle(),
      supabase.from('mug_colours').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
    ]);
    if (!entry) return NextResponse.json({ error: 'Design not found' }, { status: 404 });
    const list = (colours ?? []) as MugColour[];
    if (!list.length) return NextResponse.json({ error: 'Add a mug colour first' }, { status: 400 });
    const wanted = new URL(request.url).searchParams.get('colour');
    const colour = list.find((c) => c.slug === wanted) ?? list[0];
    const design = entry as MugCatalogEntry;
    if (!design.catalog_image_public_id) return NextResponse.json({ error: 'This design has no scene image yet' }, { status: 400 });

    const p = compositeParams(design.catalog_image_public_id, PREVIEW_NAME, colour, design);
    const printUrl = buildMugPrintUrl(p);
    const hash = createHash('sha1').update(printUrl).digest('hex').slice(0, 10);

    if (!cloudinary.config().cloud_name) {
      cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });
    }
    // Same text, colour and layout = same id, so repeat views reuse the stored wrap
    const stored = await cloudinary.uploader.upload(printUrl, {
      public_id: `pawtraits/mugs/admin-previews/${design.slug}-${colour.slug}-${hash}`,
      overwrite: false,
      resource_type: 'image',
      tags: ['mug-admin-preview'],
    });

    return NextResponse.json({
      colours: list.map((c) => ({ slug: c.slug, name: c.name, hex: c.hex })),
      colour: colour.slug,
      name: PREVIEW_NAME,
      flat: buildMugPreviewUrl(p),
      mockups: await mugMockups(stored.public_id, colour.hex),
    });
  } catch (error) {
    console.error('Mug catalogue preview failed:', error);
    return NextResponse.json({ error: 'Could not build the preview' }, { status: 500 });
  }
}
