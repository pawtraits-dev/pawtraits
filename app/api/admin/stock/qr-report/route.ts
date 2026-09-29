/**
 * GET /api/admin/stock/qr-report?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Sticker scan → order performance by location, plus top scanned images.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const sp = request.nextUrl.searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const defaultFrom = new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
  const from = DATE_RE.test(sp.get('from') || '') ? sp.get('from')! : defaultFrom;
  const to = DATE_RE.test(sp.get('to') || '') ? sp.get('to')! : today;

  const supabase = serviceClient();

  // Per-location daily rows from the view, rolled up here
  const { data: daily, error } = await supabase
    .from('qr_location_daily')
    .select('*')
    .gte('day', from)
    .lte('day', to);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byLocation = new Map<string, { location_code: string; scans: number; unique_visitors: number; orders: number; revenue_pence: number }>();
  for (const r of daily ?? []) {
    const key = r.location_code;
    const agg = byLocation.get(key) ?? { location_code: key, scans: 0, unique_visitors: 0, orders: 0, revenue_pence: 0 };
    agg.scans += r.scans; agg.unique_visitors += r.unique_visitors; agg.orders += r.orders; agg.revenue_pence += Number(r.revenue_pence) || 0;
    byLocation.set(key, agg);
  }

  // Top scanned images in range (non-bot)
  const fromTs = `${from}T00:00:00Z`;
  const toTs = new Date(new Date(`${to}T00:00:00Z`).getTime() + 864e5).toISOString();
  const { data: scans, error: scanErr } = await supabase
    .from('qr_scans')
    .select('stock_ref, image_id, order_id, location_code')
    .eq('is_bot', false)
    .gte('created_at', fromTs)
    .lt('created_at', toTs)
    .limit(20000);
  if (scanErr) return NextResponse.json({ error: scanErr.message }, { status: 500 });

  const byImage = new Map<number, { stock_ref: number; image_id: string | null; scans: number; orders: number }>();
  for (const s of scans ?? []) {
    const agg = byImage.get(s.stock_ref) ?? { stock_ref: s.stock_ref, image_id: s.image_id, scans: 0, orders: 0 };
    agg.scans++; if (s.order_id) agg.orders++;
    byImage.set(s.stock_ref, agg);
  }
  const topImages = Array.from(byImage.values()).sort((a, b) => b.scans - a.scans).slice(0, 25);

  return NextResponse.json({
    from, to,
    locations: Array.from(byLocation.values()).sort((a, b) => b.scans - a.scans),
    daily: daily ?? [],
    topImages,
  });
}
