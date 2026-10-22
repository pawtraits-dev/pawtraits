/**
 * POST /api/admin/stock/trade-orders/[id]/files
 *   → { ref, files: [{ name, url, widthMm, heightMm, quantity, size, title, finalDpi, quality }] }
 * The print-ready file for every line (exact finished size, 300 dpi, no bleed, JPG). The admin's
 * browser fetches each one, wraps it in a PDF of the exact page size and saves them all, with an
 * order sheet, into a folder (or a ZIP). Marks the order as downloaded.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { designInfo, fileStem, isTradeSize, linePrint, sourcePx } from '@/lib/stock/trade-prints';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(_r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const supabase = serviceClient();
  const { data: order } = await supabase.from('trade_print_orders').select('*').eq('id', id).maybeSingle();
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { data: lines } = await supabase.from('trade_print_order_lines').select('*').eq('order_id', id).order('size').order('created_at');
  if (!lines?.length) return NextResponse.json({ error: 'Add some prints first' }, { status: 400 });
  const info = await designInfo(supabase, lines.map(l => l.image_id));

  const files = [];
  const problems: string[] = [];
  let n = 0;
  for (const l of lines) {
    const d = info.get(l.image_id);
    const dims = d?.publicId && isTradeSize(l.size) ? await sourcePx(supabase, l, d.publicId) : null;
    if (!d?.publicId || !dims || !isTradeSize(l.size)) { problems.push(`${d?.title ?? l.image_id} (${l.size}): no print source`); continue; }
    const p = linePrint(d.publicId, dims, l.size);
    files.push({ name: fileStem(++n, d.title, l.size, p, l.quantity), url: p.url, widthMm: p.widthMm, heightMm: p.heightMm, quantity: l.quantity, size: l.size, title: d.title, finalDpi: p.finalDpi, quality: p.quality });
  }
  if (order.status === 'draft') {
    await supabase.from('trade_print_orders').update({ status: 'downloaded', downloaded_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id);
  } else {
    await supabase.from('trade_print_orders').update({ downloaded_at: new Date().toISOString() }).eq('id', id);
  }
  return NextResponse.json({ ref: order.ref, printer: order.printer, files, problems });
}
