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

  // "Email me this preview" requests that carried a stall scan, by location (skipped quietly before the preview-emails migration)
  const previewByCode = new Map<string, { requested: number; opened: number }>();
  const { data: reqs, error: reqErr } = await supabase.from('preview_email_requests').select('pos_location_id, opened_at')
    .not('pos_location_id', 'is', null).gte('created_at', fromTs).lt('created_at', toTs).limit(20000);
  if (!reqErr && reqs?.length) {
    const { data: locs } = await supabase.from('stock_locations').select('id, code').in('id', Array.from(new Set(reqs.map((r: any) => r.pos_location_id))));
    const codeOf = new Map((locs ?? []).map((l: any) => [l.id, l.code]));
    for (const r of reqs as any[]) {
      const code = codeOf.get(r.pos_location_id);
      if (!code) continue;
      const agg = previewByCode.get(code) ?? { requested: 0, opened: 0 };
      agg.requested++; if (r.opened_at) agg.opened++;
      previewByCode.set(code, agg);
    }
  }
  const locations = Array.from(byLocation.values()).sort((a, b) => b.scans - a.scans)
    .map(l => ({ ...l, preview_emails: previewByCode.get(l.location_code)?.requested ?? 0, preview_emails_opened: previewByCode.get(l.location_code)?.opened ?? 0 }));

  return NextResponse.json({
    from, to,
    locations,
    daily: daily ?? [],
    topImages,
  });
}
