/**
 * Admin → Stock & Stalls → Trade print orders.
 * GET  → { orders: [...] } newest first, with line and print counts
 * POST { printer? } → { order } a new draft
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { nextRef } from '@/lib/stock/trade-prints';

export const dynamic = 'force-dynamic';

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const supabase = serviceClient();
  const { data: orders, error } = await supabase.from('trade_print_orders').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: error.message.includes('trade_print') ? 'Run the 2026-10-22-trade-print-orders migration first' : error.message }, { status: 500 });
  const ids = (orders ?? []).map(o => o.id);
  const { data: lines } = ids.length ? await supabase.from('trade_print_order_lines').select('order_id, quantity').in('order_id', ids) : { data: [] as any[] };
  return NextResponse.json({
    orders: (orders ?? []).map(o => {
      const ls = (lines ?? []).filter((l: any) => l.order_id === o.id);
      return { ...o, lines: ls.length, prints: ls.reduce((n: number, l: any) => n + l.quantity, 0) };
    }),
  });
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  const supabase = serviceClient();
  const { data, error } = await supabase.from('trade_print_orders')
    .insert({ ref: await nextRef(supabase), printer: String(body.printer || 'Trade printer').slice(0, 60) })
    .select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ order: data });
}
