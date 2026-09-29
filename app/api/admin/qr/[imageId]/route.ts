/**
 * GET /api/admin/qr/[imageId]?format=svg|png|json&size=S|M|L&loc=CAMDEN
 * Sticker QR for one catalogue image. The QR is derived from image_catalog.stock_ref.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { buildStickerUrl, normaliseLocationCode, STICKER_SIZES, StickerSize } from '@/lib/qr/sticker-url';
import { renderQrPng, renderQrSvg } from '@/lib/qr/render';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ imageId: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { imageId } = await params;
  const sp = request.nextUrl.searchParams;
  const format = (sp.get('format') || 'json').toLowerCase();
  const sizeParam = sp.get('size')?.toUpperCase() || null;
  const size = sizeParam && STICKER_SIZES.includes(sizeParam as StickerSize) ? (sizeParam as StickerSize) : null;
  const locRaw = sp.get('loc');
  const locationCode = locRaw ? normaliseLocationCode(locRaw) : null;
  if (locRaw && !locationCode) {
    return NextResponse.json({ error: 'Invalid location code' }, { status: 400 });
  }

  const { data: image, error } = await serviceClient()
    .from('image_catalog')
    .select('id, stock_ref')
    .eq('id', imageId)
    .maybeSingle();

  if (error) {
    console.error('QR lookup failed:', error);
    return NextResponse.json({ error: 'Lookup failed — has the qr-stickers migration been run?' }, { status: 500 });
  }
  if (!image?.stock_ref) return NextResponse.json({ error: 'Image not found or has no stock ref' }, { status: 404 });

  const url = buildStickerUrl({ stockRef: image.stock_ref, size, locationCode });
  const filename = `pawtraits-qr-${image.stock_ref}${size ?? ''}${locationCode ? `-${locationCode}` : ''}`;

  if (format === 'svg') {
    return new NextResponse(await renderQrSvg(url), {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'private, max-age=300',
        ...(sp.get('download') ? { 'Content-Disposition': `attachment; filename="${filename}.svg"` } : {}),
      },
    });
  }
  if (format === 'png') {
    const png = await renderQrPng(url, 1024);
    return new NextResponse(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'private, max-age=300',
        ...(sp.get('download') ? { 'Content-Disposition': `attachment; filename="${filename}.png"` } : {}),
      },
    });
  }
  return NextResponse.json({ imageId: image.id, stockRef: image.stock_ref, size, locationCode, url });
}
