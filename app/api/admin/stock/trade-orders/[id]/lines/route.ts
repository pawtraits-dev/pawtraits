/**
 * PUT /api/admin/stock/trade-orders/[id]/lines
 *   { lines: [{ image_id, size, quantity, source?, sold? }], sales?: { from, to, location_ids } }
 * Replaces the order's lines (drafts and downloaded orders; downloading again after a change
 * gives the new files). Same design and size twice are added together.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { isTradeSize } from '@/lib/stock/trade-prints';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f-]{36}$/i;

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (!UUID.test(id) || !Array.isArray(body.lines)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const supabase = serviceClient();
  const { data: order } = await supabase.from('trade_print_orders').select('id, status').eq('id', id).maybeSingle();
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!['draft', 'downloaded'].includes(order.status)) return NextResponse.json({ error: 'This order has been placed; start a new one' }, { status: 400 });

  const merged = new Map<string, any>();
  for (const l of body.lines) {
    const qty = Math.round(Number(l.quantity));
    if (!UUID.test(String(l.image_id)) || !isTradeSize(l.size) || !(qty >= 1 && qty <= 999)) continue;
    const key = `${l.image_id}|${l.size}`;
    const cur = merged.get(key);
    merged.set(key, cur
      ? { ...cur, quantity: Math.min(999, cur.quantity + qty), sold: (cur.sold ?? 0) + (Number(l.sold) || 0) || null }
      : { order_id: id, image_id: l.image_id, size: l.size, quantity: qty, source: l.source === 'sales' ? 'sales' : 'manual', sold: Number(l.sold) || null, source_px: Array.isArray(l.source_px) ? l.source_px : null });
  }

  // Keep cached image sizes for lines that stay
  const { data: old } = await supabase.from('trade_print_order_lines').select('image_id, size, source_px').eq('order_id', id);
  for (const o of old ?? []) { const m = merged.get(`${o.image_id}|${o.size}`); if (m && !m.source_px) m.source_px = o.source_px; }

  await supabase.from('trade_print_order_lines').delete().eq('order_id', id);
  if (merged.size) {
    const { error } = await supabase.from('trade_print_order_lines').insert(Array.from(merged.values()));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const sales = body.sales && typeof body.sales === 'object' ? body.sales : null;
  await supabase.from('trade_print_orders').update({
    updated_at: new Date().toISOString(),
    ...(sales ? { sales_from: sales.from || null, sales_to: sales.to || null, sales_location_ids: Array.isArray(sales.location_ids) && sales.location_ids.length ? sales.location_ids : null } : {}),
  }).eq('id', id);
  return NextResponse.json({ ok: true, lines: merged.size });
}
