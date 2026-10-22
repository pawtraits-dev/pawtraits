/**
 * One trade print order.
 * GET    → { order, lines: [{ ..., title, thumb, print: { widthMm, heightMm, finalDpi, quality, cropNote, upscaled } }] }
 * PATCH  { status?, notes?, printer?, printer_order_ref? }
 * DELETE (draft orders only)
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { designInfo, linePrint, sourcePx, isTradeSize } from '@/lib/stock/trade-prints';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const UUID = /^[0-9a-f-]{36}$/i;
const STATUSES = ['draft', 'downloaded', 'ordered', 'received', 'cancelled'];

export async function GET(_r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const supabase = serviceClient();
  const { data: order } = await supabase.from('trade_print_orders').select('*').eq('id', id).maybeSingle();
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { data: lines } = await supabase.from('trade_print_order_lines').select('*').eq('order_id', id).order('created_at');
  const info = await designInfo(supabase, (lines ?? []).map(l => l.image_id));
  const out = await Promise.all((lines ?? []).map(async l => {
    const d = info.get(l.image_id);
    const dims = d?.publicId && isTradeSize(l.size) ? await sourcePx(supabase, l, d.publicId) : null;
    const p = dims && d?.publicId && isTradeSize(l.size) ? linePrint(d.publicId, dims, l.size) : null;
    return {
      ...l, title: d?.title ?? 'Missing design', thumb: d?.thumb ?? null,
      print: p ? { widthMm: p.widthMm, heightMm: p.heightMm, finalDpi: p.finalDpi, effectiveDpi: p.effectiveDpi, quality: p.quality, cropNote: p.cropNote, upscaled: p.upscaled } : null,
    };
  }));
  return NextResponse.json({ order, lines: out });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const fields: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.status === 'string') {
    if (!STATUSES.includes(body.status)) return NextResponse.json({ error: 'Unknown status' }, { status: 400 });
    fields.status = body.status;
    if (body.status === 'ordered') fields.ordered_at = new Date().toISOString();
    if (body.status === 'received') fields.received_at = new Date().toISOString();
  }
  for (const k of ['notes', 'printer', 'printer_order_ref']) if (typeof body[k] === 'string') fields[k] = body[k].slice(0, 2000);
  const { data, error } = await serviceClient().from('trade_print_orders').update(fields).eq('id', id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ order: data });
}

export async function DELETE(_r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const { error } = await serviceClient().from('trade_print_orders').delete().eq('id', id).eq('status', 'draft');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
