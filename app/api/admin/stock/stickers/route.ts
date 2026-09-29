/**
 * POST /api/admin/stock/stickers → A4 PDF of rear stickers
 * body: {
 *   items: [{ imageId, size?: 'S'|'M'|'L', quantity }],
 *   locationCode?: string,         // printed into every QR on the sheet (optional)
 *   startPosition?: number,        // 1–8, to finish a part-used sheet
 *   cta?: string, subCta?: string,
 *   showGuides?: boolean,
 *   includeThumbnails?: boolean    // default true — small picture of the design on each sticker
 * }
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { buildStickerUrl, getShortLinkBase, normaliseLocationCode, STICKER_SIZES, StickerSize } from '@/lib/qr/sticker-url';
import { generateStickerSheet, StickerLabel } from '@/lib/qr/sticker-sheet';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/** Small, un-watermarked JPEG of the design for the sticker (~27 mm tall ≈ 320 px @300dpi). */
async function fetchThumbnail(img: { cloudinary_public_id: string | null; public_url: string | null }): Promise<Uint8Array | null> {
  const url = img.cloudinary_public_id
    ? cloudinary.url(img.cloudinary_public_id, { width: 500, height: 500, crop: 'limit', quality: 85, format: 'jpg' })
    : img.public_url;
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) { console.warn(`Sticker thumbnail ${res.status}: ${url}`); return null; }
    const ct = res.headers.get('content-type') || '';
    if (!/jpe?g|png/.test(ct)) { console.warn(`Sticker thumbnail unsupported type ${ct}: ${url}`); return null; }
    return new Uint8Array(await res.arrayBuffer());
  } catch (e) {
    console.warn('Sticker thumbnail fetch failed', url, e);
    return null;
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_LABELS = 400;

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await request.json();
  const items: Array<{ imageId: string; size?: string; quantity?: number }> = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return NextResponse.json({ error: 'Add at least one image' }, { status: 400 });

  let locationCode: string | null = null;
  if (body.locationCode) {
    locationCode = normaliseLocationCode(body.locationCode);
    if (!locationCode) return NextResponse.json({ error: 'Invalid location code' }, { status: 400 });
  }

  const supabase = serviceClient();

  if (locationCode) {
    const { data: loc } = await supabase.from('stock_locations').select('id, is_active').eq('code', locationCode).maybeSingle();
    if (!loc) return NextResponse.json({ error: `Unknown location ${locationCode} — create it first` }, { status: 400 });
    if (!loc.is_active) return NextResponse.json({ error: `Location ${locationCode} is inactive` }, { status: 400 });
  }

  const ids = Array.from(new Set(items.map(i => i.imageId)));
  const { data: images, error } = await supabase
    .from('image_catalog')
    .select('id, stock_ref, cloudinary_public_id, public_url')
    .in('id', ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const refById = new Map((images ?? []).map(i => [i.id, i.stock_ref as number]));

  const missing = ids.filter(id => !refById.get(id));
  if (missing.length) return NextResponse.json({ error: `Images not found: ${missing.join(', ')}` }, { status: 400 });

  // Thumbnails on by default (helps match stickers to prints during production runs)
  const includeThumbnails = body.includeThumbnails !== false;
  const thumbnails = new Map<string, Uint8Array>();
  if (includeThumbnails) {
    const fetched = await Promise.all((images ?? []).map(async img => [img.id, await fetchThumbnail(img)] as const));
    for (const [id, bytes] of fetched) if (bytes) thumbnails.set(id, bytes);
  }

  const base = getShortLinkBase();
  const displayBase = base.replace(/^https?:\/\//, '');
  const expanded: Omit<StickerLabel, 'sequence'>[] = [];

  for (const item of items) {
    const size = item.size ? (item.size.toUpperCase() as StickerSize) : null;
    if (size && !STICKER_SIZES.includes(size)) return NextResponse.json({ error: `Invalid size ${item.size}` }, { status: 400 });
    const qty = Math.max(1, Math.min(100, Math.floor(Number(item.quantity) || 1)));
    const stockRef = refById.get(item.imageId)!;
    const url = buildStickerUrl({ stockRef, size, locationCode }, base);
    const path = url.slice(base.length); // "/S/1123M/CAMDEN"
    for (let n = 0; n < qty; n++) {
      expanded.push({
        url,
        displayUrl: `${displayBase}${path}`,
        refText: `Ref ${stockRef}${size ? `-${size}` : ''}`,
        locationCode,
        thumbnailKey: thumbnails.has(item.imageId) ? item.imageId : null,
      });
    }
  }

  if (expanded.length > MAX_LABELS) {
    return NextResponse.json({ error: `Too many labels (${expanded.length}); max ${MAX_LABELS} per sheet run` }, { status: 400 });
  }

  const labels: StickerLabel[] = expanded.map((l, i) => ({ ...l, sequence: `${i + 1}/${expanded.length}` }));

  const pdf = await generateStickerSheet(labels, {
    startPosition: Number(body.startPosition) || 1,
    cta: body.cta?.trim() || undefined,
    subCta: body.subCta?.trim() || undefined,
    showGuides: !!body.showGuides,
    thumbnails,
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="pawtraits-stickers-${locationCode ?? 'NOLOC'}-${stamp}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * GET /api/admin/stock/stickers?refs=1123,1124&ids=<uuid>,<uuid>
 * Resolve images for the sticker builder (by stock ref and/or id).
 */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const sp = request.nextUrl.searchParams;
  const refs = (sp.get('refs') || '').split(',').map(s => parseInt(s.trim(), 10)).filter(n => Number.isSafeInteger(n) && n > 0).slice(0, 200);
  const ids = (sp.get('ids') || '').split(',').map(s => s.trim()).filter(s => /^[0-9a-f-]{36}$/i.test(s)).slice(0, 200);
  if (!refs.length && !ids.length) return NextResponse.json([]);

  const supabase = serviceClient();
  const cols = 'id, stock_ref, description, public_url, is_public';
  const results: any[] = [];
  if (refs.length) {
    const { data, error } = await supabase.from('image_catalog').select(cols).in('stock_ref', refs);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    results.push(...(data ?? []));
  }
  if (ids.length) {
    const { data, error } = await supabase.from('image_catalog').select(cols).in('id', ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    results.push(...(data ?? []));
  }
  const unique = Array.from(new Map(results.map(r => [r.id, r])).values());
  return NextResponse.json(unique);
}
