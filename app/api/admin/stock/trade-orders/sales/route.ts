/**
 * GET /api/admin/stock/trade-orders/sales?from=YYYY-MM-DD&to=YYYY-MM-DD&locations=<id,id>
 *   → { from, to, suggestions: [{ image_id, size, sold, title, thumb }], locations, lastOrderedTo }
 * Stall sales to replace. Without dates: from the day after the last order's sales period (or
 * 30 days ago) to today.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { designInfo, stallSales } from '@/lib/stock/trade-prints';

export const dynamic = 'force-dynamic';
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const p = request.nextUrl.searchParams;
  const supabase = serviceClient();
  const { data: last } = await supabase.from('trade_print_orders').select('sales_to').not('sales_to', 'is', null).neq('status', 'cancelled').order('sales_to', { ascending: false }).limit(1).maybeSingle();
  const today = new Date().toISOString().slice(0, 10);
  const dayAfter = (d: string) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };
  const from = DATE.test(p.get('from') || '') ? p.get('from')! : last?.sales_to ? dayAfter(last.sales_to) : new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const to = DATE.test(p.get('to') || '') ? p.get('to')! : today;
  const locationIds = (p.get('locations') || '').split(',').filter(x => /^[0-9a-f-]{36}$/i.test(x));

  try {
    const [sales, { data: locations }] = await Promise.all([
      stallSales(supabase, from, to, locationIds),
      supabase.from('stock_locations').select('id, code, name, location_type').eq('is_active', true).order('name'),
    ]);
    const info = await designInfo(supabase, sales.map(s => s.image_id));
    return NextResponse.json({
      from, to, lastOrderedTo: last?.sales_to ?? null,
      locations: (locations ?? []).filter((l: any) => l.location_type === 'stall'),
      suggestions: sales.map(s => ({ ...s, title: info.get(s.image_id)?.title ?? 'Missing design', thumb: info.get(s.image_id)?.thumb ?? null })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not read stall sales' }, { status: 500 });
  }
}
