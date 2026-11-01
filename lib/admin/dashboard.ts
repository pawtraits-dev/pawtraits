/**
 * Admin dashboard (server only): how the business is doing and what needs doing, in one call.
 *   kpis       revenue (online / stall), orders, free previews, preview → order conversion,
 *              stall QR scans and AI spend, for the period and the one before it
 *   attention  things waiting on Steve: paid orders not sent for printing after 12 hours, Gelato errors, failed print
 *              masters and previews, batches to review, social posts to approve, trade print orders
 *   trend      the last 30 days, day by day (revenue online / stall, previews)
 *   top        the designs customised and bought most in the period
 *   recent     the latest orders and previews
 *   stalls     each stall's scans and sales in the period
 * Days are London days. Money is in minor units (pence); AI spend is in US dollars.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadCustomisations, loadOutcomes } from '@/lib/admin/customisation-stats';

export type Period = 'today' | '7d' | '30d';
const DAY = 86_400_000;
/** A paid order not sent to the printer after this long needs a look (normally it goes within minutes) */
const UNSENT_HOURS = 12;
const PAID_EXCLUDED = new Set(['cancelled', 'canceled', 'refunded']);
const chunks = <T,>(list: T[], n = 200) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));
const title = (d: string | null | undefined) => (d || '').match(/\*\*(.+?)\*\*/)?.[1]?.trim() || (d || '').replace(/[#*_]/g, '').trim().slice(0, 60) || 'Untitled design';

/** Midnight in London for the day containing `t`, as a Date */
function londonMidnight(t: Date): Date {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(t);
  const get = (k: string) => Number(parts.find(p => p.type === k)?.value);
  const sinceMidnight = (get('hour') * 60 + get('minute')) * 60_000 + t.getUTCSeconds() * 1000 + t.getUTCMilliseconds();
  return new Date(t.getTime() - sinceMidnight);
}
const londonDay = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date(iso));   // YYYY-MM-DD

export function periodRange(period: Period, now = new Date()) {
  const today = londonMidnight(now);
  const start = period === 'today' ? today : new Date(today.getTime() - (period === '7d' ? 6 : 29) * DAY);
  const length = now.getTime() - start.getTime();
  return { start, end: now, prevStart: new Date(start.getTime() - (period === 'today' ? DAY : length)), prevEnd: start };
}

interface OrderRow { id: string; order_number: string; created_at: string; status: string; payment_status: string | null; total_amount: number; currency: string | null; pos_location_id?: string | null; gelato_order_id: string | null; gelato_status: string | null; fulfillment_type: string | null; fulfillment_status: string | null; error_message: string | null; customer_email: string | null }
const isPaid = (o: OrderRow) => o.payment_status === 'paid' && !PAID_EXCLUDED.has(String(o.status || '').toLowerCase());

async function ordersSince(supabase: SupabaseClient, since: Date): Promise<OrderRow[]> {
  const cols = 'id, order_number, created_at, status, payment_status, total_amount, currency, gelato_order_id, gelato_status, fulfillment_type, fulfillment_status, error_message, customer_email';
  const out: OrderRow[] = [];
  for (let from = 0; from < 20_000; from += 1000) {
    // pos_location_id arrived with the 2026-09-28 migration: fall back without it
    let { data, error } = await supabase.from('orders').select(`${cols}, pos_location_id`).gte('created_at', since.toISOString()).order('created_at', { ascending: false }).range(from, from + 999);
    if (error && /pos_location_id/.test(error.message)) ({ data, error } = await supabase.from('orders').select(cols).gte('created_at', since.toISOString()).order('created_at', { ascending: false }).range(from, from + 999) as any);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as OrderRow[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** A count that never throws (a table from a migration not yet run counts as 0) */
async function count(q: PromiseLike<{ count: number | null; error: any }>): Promise<number> {
  try { const r = await q; return r.error ? 0 : r.count ?? 0; } catch { return 0; }
}

function money(orders: OrderRow[]) {
  let total = 0, online = 0, stall = 0;
  for (const o of orders) {
    if ((o.currency || 'GBP').toUpperCase() !== 'GBP') continue;   // the dashboard shows pounds
    total += o.total_amount || 0;
    if (o.pos_location_id) stall += o.total_amount || 0; else online += o.total_amount || 0;
  }
  return { total, online, stall };
}

export async function loadDashboard(supabase: SupabaseClient, period: Period) {
  const { start, end, prevStart, prevEnd } = periodRange(period);
  const trendStart = new Date(londonMidnight(end).getTime() - 29 * DAY);
  const earliest = new Date(Math.min(prevStart.getTime(), trendStart.getTime()));
  const inRange = (iso: string, a: Date, b: Date) => { const t = new Date(iso).getTime(); return t >= a.getTime() && t < b.getTime(); };

  // ---- orders
  const orders = await ordersSince(supabase, earliest);
  const paid = orders.filter(isPaid);
  const cur = paid.filter(o => inRange(o.created_at, start, end));
  const prev = paid.filter(o => inRange(o.created_at, prevStart, prevEnd));
  const curMoney = money(cur), prevMoney = money(prev);

  // ---- previews (customer customisations) and how many became an order
  const previewsAll = await loadCustomisations(supabase, earliest.toISOString(), 30_000).catch(() => []);
  const previewsCur = previewsAll.filter(p => inRange(p.created_at, start, end));
  const previewsPrev = previewsAll.filter(p => inRange(p.created_at, prevStart, prevEnd));
  const outcomes = await loadOutcomes(supabase, [...previewsCur, ...previewsPrev]).catch(() => new Map());
  const bought = (list: typeof previewsAll) => list.filter(p => outcomes.get(p.id)?.purchased).length;
  const okCount = (list: typeof previewsAll) => list.filter(p => p.status === 'complete').length;
  const failedCount = (list: typeof previewsAll) => list.filter(p => p.status === 'failed').length;

  // ---- stall QR scans and AI spend
  const scans = async (a: Date, b: Date) => count(supabase.from('qr_scans').select('id', { count: 'exact', head: true }).gte('created_at', a.toISOString()).lt('created_at', b.toISOString()).eq('is_bot', false).eq('is_repeat', false));
  const aiSpend = async (a: Date, b: Date) => {
    let total = 0;
    for (let from = 0; from < 100_000; from += 1000) {
      const { data, error } = await supabase.from('ai_usage').select('cost_usd').gte('created_at', a.toISOString()).lt('created_at', b.toISOString()).range(from, from + 999);
      if (error) return null;
      for (const r of data ?? []) total += Number(r.cost_usd) || 0;
      if (!data || data.length < 1000) break;
    }
    return Math.round(total * 100) / 100;
  };
  const [scansCur, scansPrev, aiCur, aiPrev] = await Promise.all([scans(start, end), scans(prevStart, prevEnd), aiSpend(start, end), aiSpend(prevStart, prevEnd)]);

  const conv = (list: typeof previewsAll) => (list.length ? Math.round((bought(list) / list.length) * 1000) / 10 : 0);
  const kpis = {
    revenue: { value: curMoney.total, prev: prevMoney.total, online: curMoney.online, stall: curMoney.stall },
    orders: { value: cur.length, prev: prev.length, average: cur.length ? Math.round(curMoney.total / cur.length) : 0 },
    previews: { value: previewsCur.length, prev: previewsPrev.length, ok: okCount(previewsCur), failed: failedCount(previewsCur) },
    conversion: { value: conv(previewsCur), prev: conv(previewsPrev), bought: bought(previewsCur) },
    scans: { value: scansCur, prev: scansPrev },
    ai: { value: aiCur, prev: aiPrev, perOrder: aiCur !== null && cur.length ? Math.round((aiCur / cur.length) * 100) / 100 : null },
  };

  // ---- needs attention
  const now = Date.now();
  const hoursAgo = (h: number) => new Date(now - h * 3600_000).toISOString();
  const unfulfilled = paid.filter(o => !o.pos_location_id && !o.gelato_order_id && !['collected', 'digital'].includes(String(o.fulfillment_type || ''))
    && !['fulfilled', 'shipped', 'delivered'].includes(String(o.fulfillment_status || '')) && new Date(o.created_at).getTime() < now - UNSENT_HOURS * 3600_000);
  const gelatoErrors = paid.filter(o => o.error_message || ['failed', 'error', 'cancelled', 'canceled'].includes(String(o.gelato_status || '').toLowerCase()));
  const [printMastersFailed, toReview, socialPending, teamFailed, tradeDownloaded, tradeOrdered] = await Promise.all([
    count(supabase.from('customer_custom_images').select('id', { count: 'exact', head: true }).eq('print_master_status', 'failed')),
    count(supabase.from('variation_run_items').select('id', { count: 'exact', head: true }).eq('status', 'generated')),
    count(supabase.from('social_items').select('id', { count: 'exact', head: true }).eq('check_status', 'pending')),
    count(supabase.from('design_team_variants').select('id', { count: 'exact', head: true }).eq('status', 'failed')),
    count(supabase.from('trade_print_orders').select('id', { count: 'exact', head: true }).eq('status', 'downloaded').lt('downloaded_at', hoursAgo(48))),
    count(supabase.from('trade_print_orders').select('id', { count: 'exact', head: true }).eq('status', 'ordered').lt('ordered_at', hoursAgo(24 * 10))),
  ]);
  const previews24 = previewsAll.filter(p => new Date(p.created_at).getTime() >= now - DAY);
  const failed24 = failedCount(previews24);
  const attention = [
    { key: 'unfulfilled', label: `Paid orders not yet sent for printing (over ${UNSENT_HOURS} hours old)`, count: unfulfilled.length, href: '/admin/orders', level: 'urgent' },
    { key: 'gelato', label: 'Orders with a printing error', count: gelatoErrors.length, href: '/admin/orders', level: 'urgent' },
    { key: 'print-masters', label: 'Print files that failed to make', count: printMastersFailed, href: '/admin/customisations', level: 'urgent' },
    { key: 'previews', label: `Free previews that failed in the last 24 hours (of ${previews24.length})`, count: failed24, href: '/admin/customisations', level: failed24 / Math.max(1, previews24.length) > 0.1 ? 'urgent' : 'todo' },
    { key: 'review', label: 'Variation pictures waiting for review', count: toReview, href: '/admin/variation-batches', level: 'todo' },
    { key: 'social', label: 'Social posts waiting for approval', count: socialPending, href: '/admin/social', level: 'todo' },
    { key: 'trade-download', label: 'Trade print orders downloaded but not marked as ordered', count: tradeDownloaded, href: '/admin/stock/trade-orders', level: 'todo' },
    { key: 'trade-arrive', label: 'Trade print orders ordered over 10 days ago, not yet received', count: tradeOrdered, href: '/admin/stock/trade-orders', level: 'todo' },
    { key: 'team', label: 'Team versions that failed to paint', count: teamFailed, href: '/admin/collections', level: 'todo' },
  ].filter(a => a.count > 0);

  // ---- last 30 days, day by day
  const days: { day: string; online: number; stall: number; previews: number }[] = [];
  for (let i = 0; i < 30; i++) days.push({ day: londonDay(new Date(trendStart.getTime() + i * DAY + 12 * 3600_000).toISOString()), online: 0, stall: 0, previews: 0 });
  const byDay = new Map(days.map(d => [d.day, d]));
  for (const o of paid) {
    const d = byDay.get(londonDay(o.created_at));
    if (!d || (o.currency || 'GBP').toUpperCase() !== 'GBP') continue;
    if (o.pos_location_id) d.stall += o.total_amount || 0; else d.online += o.total_amount || 0;
  }
  for (const p of previewsAll) { const d = byDay.get(londonDay(p.created_at)); if (d) d.previews++; }

  // ---- top designs in the period: previews and orders per catalogue design
  const curIds = new Set(cur.map(o => o.id));
  const lines: { image_id: string; order_id: string; quantity: number | null }[] = [];
  for (const part of chunks(Array.from(curIds))) {
    const { data } = await supabase.from('order_items').select('image_id, order_id, quantity').in('order_id', part);
    lines.push(...((data ?? []) as any[]));
  }
  // An order line for a customisation counts towards the design it was made from
  const customOf = new Map(previewsAll.map(p => [p.id, p.catalog_image_id]));
  const unknown = lines.map(l => l.image_id).filter(id => id && !customOf.has(id));
  for (const part of chunks(Array.from(new Set(unknown)))) {
    const { data } = await supabase.from('customer_custom_images').select('id, catalog_image_id').in('id', part);
    for (const r of data ?? []) customOf.set(r.id, r.catalog_image_id);
  }
  const tally = new Map<string, { previews: number; orders: number }>();
  const bump = (id: string | null | undefined, k: 'previews' | 'orders', n = 1) => { if (!id) return; const t = tally.get(id) ?? { previews: 0, orders: 0 }; t[k] += n; tally.set(id, t); };
  for (const p of previewsCur) bump(p.catalog_image_id, 'previews');
  for (const l of lines) bump(customOf.has(l.image_id) ? customOf.get(l.image_id) : l.image_id, 'orders', l.quantity ?? 1);
  const topIds = Array.from(tally.entries()).sort((a, b) => b[1].orders * 5 + b[1].previews - (a[1].orders * 5 + a[1].previews)).slice(0, 8).map(([id]) => id);
  const cloud = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const { data: designs } = topIds.length ? await supabase.from('image_catalog').select('id, description, cloudinary_public_id, public_url').in('id', topIds) : { data: [] as any[] };
  const designOf = new Map((designs ?? []).map((d: any) => [d.id, d]));
  const top = topIds.map(id => {
    const d: any = designOf.get(id);
    return {
      id, ...tally.get(id)!, title: title(d?.description),
      thumb: d?.cloudinary_public_id && cloud ? `https://res.cloudinary.com/${cloud}/image/upload/c_fill,w_96,h_128,g_auto/f_auto,q_auto/${d.cloudinary_public_id}` : d?.public_url ?? null,
    };
  });

  // ---- latest orders and previews
  const recentOrders = paid.slice(0, 8).map(o => ({
    id: o.id, number: o.order_number, at: o.created_at, amount: o.total_amount, currency: (o.currency || 'GBP').toUpperCase(),
    channel: o.pos_location_id ? 'stall' : 'online',
    state: o.error_message ? 'error' : o.gelato_order_id ? (o.gelato_status || 'sent') : o.pos_location_id ? 'stall' : (o.fulfillment_status || 'pending'),
  }));
  const recentIds = previewsAll.slice(0, 10).map(p => p.id);
  const { data: recentRows } = recentIds.length ? await supabase.from('customer_custom_images').select('id, generated_image_url, status, created_at, metadata').in('id', recentIds) : { data: [] as any[] };
  const recentPreviews = (recentRows ?? []).sort((a: any, b: any) => b.created_at.localeCompare(a.created_at)).map((r: any) => ({
    id: r.id, at: r.created_at, status: r.status, thumb: r.status === 'complete' ? r.generated_image_url : null, source: r.metadata?.source ?? null, bought: !!outcomes.get(r.id)?.purchased,
  }));

  // ---- stalls
  let stalls: { id: string; name: string; scans: number; orders: number; revenue: number }[] = [];
  const { data: locations } = await supabase.from('stock_locations').select('id, name, location_type, is_active').eq('is_active', true);
  if (locations?.length) {
    stalls = await Promise.all(locations.filter((l: any) => l.location_type === 'stall').map(async (l: any) => {
      const mine = cur.filter(o => o.pos_location_id === l.id);
      const s = await count(supabase.from('qr_scans').select('id', { count: 'exact', head: true }).eq('location_id', l.id).gte('created_at', start.toISOString()).eq('is_bot', false).eq('is_repeat', false));
      return { id: l.id, name: l.name, scans: s, orders: mine.length, revenue: money(mine).total };
    }));
    stalls.sort((a, b) => b.revenue - a.revenue || b.scans - a.scans);
  }

  return { period, from: start.toISOString(), to: end.toISOString(), kpis, attention, trend: days, top, recentOrders, recentPreviews, stalls };
}
