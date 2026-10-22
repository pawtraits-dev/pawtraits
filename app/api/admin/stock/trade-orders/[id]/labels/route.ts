/**
 * POST /api/admin/stock/trade-orders/[id]/labels → PDF of print labels (A4, 21 per sheet,
 * 63.5 × 38.1 mm, template CL2163): one label per print in the order, in the same order as the
 * print files. body: { locationCode?: string, startPosition?: 1–21, showGuides?: boolean, cta?: string }
 * The QR is the stall sticker link for the design and size (and the stall, when given).
 */
import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { buildStickerUrl, getShortLinkBase, normaliseLocationCode, STICKER_SIZES, type StickerSize } from '@/lib/qr/sticker-url';
import { generatePrintLabels, type PrintLabel } from '@/lib/stock/print-labels';
import { designInfo, isTradeSize, linePrint, sourcePx, TRADE_SIZES } from '@/lib/stock/trade-prints';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;
const MAX_LABELS = 630;   // 30 sheets

cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });

async function thumbnail(publicId: string | null): Promise<Uint8Array | null> {
  if (!publicId) return null;
  try {
    const url = cloudinary.url(publicId, { width: 300, height: 400, crop: 'fill', gravity: 'auto', quality: 85, format: 'jpg' });
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
  } catch { return null; }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const supabase = serviceClient();

  let locationCode: string | null = null;
  if (body.locationCode) {
    locationCode = normaliseLocationCode(body.locationCode);
    if (!locationCode) return NextResponse.json({ error: 'Invalid stall code' }, { status: 400 });
  }

  const { data: order } = await supabase.from('trade_print_orders').select('id, ref').eq('id', id).maybeSingle();
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // Same order as the print files
  const { data: lines } = await supabase.from('trade_print_order_lines').select('*').eq('order_id', id).order('size').order('created_at');
  if (!lines?.length) return NextResponse.json({ error: 'Add some prints first' }, { status: 400 });

  const ids = Array.from(new Set(lines.map(l => l.image_id)));
  const [info, { data: refs }] = await Promise.all([
    designInfo(supabase, ids),
    supabase.from('image_catalog').select('id, stock_ref').in('id', ids),
  ]);
  const refOf = new Map((refs ?? []).map(r => [r.id, r.stock_ref as number]));
  const thumbs = new Map<string, Uint8Array>();
  await Promise.all(ids.map(async i => { const b = await thumbnail(info.get(i)?.publicId ?? null); if (b) thumbs.set(i, b); }));

  const base = getShortLinkBase();
  const labels: PrintLabel[] = [];
  for (const l of lines) {
    const size = l.size;
    if (!isTradeSize(size) || !refOf.get(l.image_id)) continue;
    const d = info.get(l.image_id);
    // Size on the label as it's printed (turned to the design's orientation)
    const dims = d?.publicId ? await sourcePx(supabase, l, d.publicId) : null;
    const p = dims && d?.publicId ? linePrint(d.publicId, dims, size) : null;
    const sizeText = p ? `${p.widthMm / 10}×${p.heightMm / 10} cm` : `${TRADE_SIZES[size].w}×${TRADE_SIZES[size].h} cm`;
    // Stall links know S / M / L; an XL links to the design without a size
    const linkSize = (STICKER_SIZES as string[]).includes(size) ? (size as StickerSize) : null;
    const qrUrl = buildStickerUrl({ stockRef: refOf.get(l.image_id)!, size: linkSize, locationCode }, base);
    for (let n = 0; n < l.quantity; n++) labels.push({ title: d?.title ?? 'Pawtraits', sizeCode: size, sizeText, qrUrl, thumbnailKey: thumbs.has(l.image_id) ? l.image_id : null });
  }
  if (labels.length > MAX_LABELS) return NextResponse.json({ error: `Too many labels (${labels.length}); max ${MAX_LABELS}` }, { status: 400 });

  const pdf = await generatePrintLabels(labels, {
    startPosition: Number(body.startPosition) || 1,
    showGuides: !!body.showGuides,
    cta: typeof body.cta === 'string' && body.cta.trim() ? body.cta.trim().slice(0, 60) : undefined,
    thumbnails: thumbs,
  });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${order.ref}-labels${locationCode ? `-${locationCode}` : ''}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
