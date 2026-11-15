/**
 * Audiences for the admin (server only): who bought, who asked for a preview by email and has not bought,
 * and which anonymous devices scanned a stall QR code. Buyers and preview emailers can be downloaded as a
 * customer list for Meta, but ONLY addresses that are subscribed (email_preferences) are ever included.
 *
 * Tables read: orders (payment_status = 'paid'), preview_email_requests, qr_scans, customer_custom_images,
 * image_catalog, stock_locations, user_profiles, email_preferences (through marketingStates).
 * The grouping, stage and CSV functions are pure (no database) so scripts/test-audiences.ts can test them.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { marketingStates, type MarketingState } from './admin';
import { normaliseEmail } from './preferences';

export type MarketingStatus = 'subscribed' | 'unsubscribed' | 'not asked';
export type ScannerStage = 'Bought' | 'Left an email' | 'Made a preview' | 'Scanned only';

export interface AudienceFilters {
  /** YYYY-MM-DD, inclusive */
  from?: string | null;
  /** YYYY-MM-DD, inclusive */
  to?: string | null;
  locationId?: string | null;
  includeBought?: boolean;
}

export interface Summary { total: number; subscribed: number; truncated: boolean; [k: string]: number | boolean }

export const ROW_CAP = 20000;
const PAGE = 1000;
const CHUNK = 100;

// ---------------------------------------------------------------------------------------------
// Row shapes read from the database

export interface OrderRow {
  id: string;
  customer_email: string | null;
  shipping_first_name?: string | null;
  shipping_last_name?: string | null;
  shipping_postcode?: string | null;
  shipping_country?: string | null;
  total_amount: number | null;       // pence
  created_at: string;
  pos_location_id?: string | null;
  qr_scan_id?: string | null;
  guest_session_id?: string | null;
}

export interface ScanRow {
  id: string;
  visitor_id: string;
  stock_ref: number;
  location_id: string | null;
  location_code: string | null;
  is_repeat: boolean;
  order_id: string | null;
  created_at: string;
}

export interface PreviewRequestRow {
  id: string;
  custom_image_id: string;
  email: string;
  guest_session_id: string | null;
  pos_location_id: string | null;
  last_sent_at: string | null;
  opened_at: string | null;
  created_at: string;
}

export interface DesignInfo { title: string; stockRef: number | null; thumb: string | null }

// ---------------------------------------------------------------------------------------------
// Output rows

export interface BuyerRow {
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  customerId: string | null;          // user_profiles.id, which is what /admin/customers/<id> expects
  orders: number;
  totalSpent: number;                  // pounds
  firstOrderAt: string;
  lastOrderAt: string;
  stalls: string[];
  postcode: string;                    // of the latest order
  country: string;                     // of the latest order, as written
  marketing: MarketingStatus;
}

export interface PreviewerRow {
  email: string;
  previews: number;
  lastSentAt: string | null;
  opened: boolean;
  marketing: MarketingStatus;
  stall: string | null;
  design: DesignInfo | null;
  hasBought: boolean;
  lastAt: string;
}

export interface ScannerRow {
  visitorId: string;
  firstScanAt: string;
  lastScanAt: string;
  scans: number;
  newScans: number;                    // scans that were not repeats
  stalls: string[];
  designs: string[];                   // stock refs, up to 3, most scanned first
  stage: ScannerStage;
}

export interface LoadResult<T> { rows: T[]; summary: Summary; truncated: boolean }

// ---------------------------------------------------------------------------------------------
// Pure helpers

export const statusOf = (s: MarketingState | undefined | null): MarketingStatus =>
  s?.state === 'subscribed' ? 'subscribed' : s?.state === 'unsubscribed' ? 'unsubscribed' : 'not asked';

const lower = (e: string | null | undefined) => String(e ?? '').trim().toLowerCase();
const pounds = (pence: number | null | undefined) => Math.round(Number(pence) || 0) / 100;

/** First day start and the day after the last day, as ISO instants (UTC), for range filters */
export function dateBounds(from?: string | null, to?: string | null): { fromTs: string | null; toTs: string | null } {
  const ok = (s?: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) ? s : null);
  const f = ok(from), t = ok(to);
  return {
    fromTs: f ? `${f}T00:00:00.000Z` : null,
    toTs: t ? new Date(Date.parse(`${t}T00:00:00Z`) + 864e5).toISOString() : null,
  };
}

const inRange = (iso: string, fromTs: string | null, toTs: string | null) =>
  (!fromTs || iso >= fromTs) && (!toTs || iso < toTs);

/** Group paid orders into one buyer per lower-cased email. Newest activity first. */
export function groupBuyers(orders: OrderRow[], locNames: Map<string, string>): BuyerRow[] {
  const by = new Map<string, OrderRow[]>();
  for (const o of orders) {
    const e = lower(o.customer_email);
    if (!e) continue;
    const list = by.get(e);
    if (list) list.push(o); else by.set(e, [o]);
  }
  const rows: BuyerRow[] = [];
  for (const [email, list] of Array.from(by)) {
    list.sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
    const latest = list[list.length - 1];
    const stalls = Array.from(new Set(list.map(o => (o.pos_location_id ? locNames.get(o.pos_location_id) : null)).filter((s): s is string => !!s)));
    const firstName = String(latest.shipping_first_name ?? '').trim();
    const lastName = String(latest.shipping_last_name ?? '').trim();
    rows.push({
      email, name: [firstName, lastName].filter(Boolean).join(' '), firstName, lastName, customerId: null,
      orders: list.length,
      totalSpent: Math.round(list.reduce((s, o) => s + (Number(o.total_amount) || 0), 0)) / 100,
      firstOrderAt: list[0].created_at, lastOrderAt: latest.created_at,
      stalls, postcode: String(latest.shipping_postcode ?? '').trim(), country: String(latest.shipping_country ?? '').trim(),
      marketing: 'not asked',
    });
  }
  return rows.sort((a, b) => (a.lastOrderAt < b.lastOrderAt ? 1 : a.lastOrderAt > b.lastOrderAt ? -1 : 0));
}

export interface StageFlags { bought: boolean; leftEmail: boolean; madePreview: boolean }

/** How far a scanner got: bought beats left an email beats made a preview beats scanned only */
export function scannerStage(f: StageFlags): ScannerStage {
  return f.bought ? 'Bought' : f.leftEmail ? 'Left an email' : f.madePreview ? 'Made a preview' : 'Scanned only';
}

export interface ScannerContext {
  locNames: Map<string, string>;
  /** ids of paid orders */
  paidOrderIds: Set<string>;
  /** qr_scan_id of paid orders */
  paidOrderScanIds: Set<string>;
  /** guest_session_id of paid orders */
  paidOrderVisitors: Set<string>;
  emailVisitors: Set<string>;
  previewVisitors: Set<string>;
}

/** Group scans into one row per visitor id. Newest activity first. */
export function groupScanners(scans: ScanRow[], ctx: ScannerContext): ScannerRow[] {
  const by = new Map<string, ScanRow[]>();
  for (const s of scans) {
    const list = by.get(s.visitor_id);
    if (list) list.push(s); else by.set(s.visitor_id, [s]);
  }
  const rows: ScannerRow[] = [];
  for (const [visitorId, list] of Array.from(by)) {
    let first = list[0].created_at, last = list[0].created_at, newScans = 0, bought = ctx.paidOrderVisitors.has(visitorId);
    const stalls = new Map<string, true>();
    const refs = new Map<number, number>();
    for (const s of list) {
      if (s.created_at < first) first = s.created_at;
      if (s.created_at > last) last = s.created_at;
      if (!s.is_repeat) newScans++;
      if ((s.order_id && ctx.paidOrderIds.has(s.order_id)) || ctx.paidOrderScanIds.has(s.id)) bought = true;
      const stall = (s.location_id && ctx.locNames.get(s.location_id)) || s.location_code;
      if (stall) stalls.set(stall, true);
      refs.set(s.stock_ref, (refs.get(s.stock_ref) ?? 0) + 1);
    }
    rows.push({
      visitorId, firstScanAt: first, lastScanAt: last, scans: list.length, newScans,
      stalls: Array.from(stalls.keys()),
      designs: Array.from(refs.entries()).sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 3).map(([r]) => `#${r}`),
      stage: scannerStage({ bought, leftEmail: ctx.emailVisitors.has(visitorId), madePreview: ctx.previewVisitors.has(visitorId) }),
    });
  }
  return rows.sort((a, b) => (a.lastScanAt < b.lastScanAt ? 1 : a.lastScanAt > b.lastScanAt ? -1 : 0));
}

/** Group preview email requests into one row per lower-cased email. Newest activity first. */
export function groupPreviewers(
  reqs: PreviewRequestRow[],
  ctx: { boughtEmails: Set<string>; marketing: Map<string, MarketingStatus>; locNames: Map<string, string>; designs: Map<string, DesignInfo> },
): PreviewerRow[] {
  const by = new Map<string, PreviewRequestRow[]>();
  for (const r of reqs) {
    const e = lower(r.email);
    if (!e) continue;
    const list = by.get(e);
    if (list) list.push(r); else by.set(e, [r]);
  }
  const rows: PreviewerRow[] = [];
  for (const [email, list] of Array.from(by)) {
    list.sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
    const latest = list[list.length - 1];
    const sent = list.map(r => r.last_sent_at).filter((s): s is string => !!s).sort();
    const stallId = [...list].reverse().find(r => r.pos_location_id)?.pos_location_id ?? null;
    rows.push({
      email, previews: list.length,
      lastSentAt: sent.length ? sent[sent.length - 1] : null,
      opened: list.some(r => !!r.opened_at),
      marketing: ctx.marketing.get(email) ?? 'not asked',
      stall: stallId ? ctx.locNames.get(stallId) ?? null : null,
      design: ctx.designs.get(latest.custom_image_id) ?? null,
      hasBought: ctx.boughtEmails.has(email),
      lastAt: sent.length && sent[sent.length - 1] > latest.created_at ? sent[sent.length - 1] : latest.created_at,
    });
  }
  return rows.sort((a, b) => (a.lastAt < b.lastAt ? 1 : a.lastAt > b.lastAt ? -1 : 0));
}

const COUNTRY_CODES: Record<string, string> = {
  'united kingdom': 'GB', uk: 'GB', gb: 'GB', 'great britain': 'GB', england: 'GB', scotland: 'GB', wales: 'GB', 'northern ireland': 'GB',
  ireland: 'IE', 'republic of ireland': 'IE', 'united states': 'US', usa: 'US', 'united states of america': 'US',
  france: 'FR', germany: 'DE', spain: 'ES', italy: 'IT', netherlands: 'NL', belgium: 'BE', canada: 'CA', australia: 'AU',
};

/** Two-letter country for Meta: GB when blank, the code when we know the name, otherwise blank */
export function countryCode(country: string | null | undefined): string {
  const c = String(country ?? '').trim().toLowerCase();
  if (!c) return 'GB';
  if (COUNTRY_CODES[c]) return COUNTRY_CODES[c];
  return /^[a-z]{2}$/.test(c) ? c.toUpperCase() : '';
}

/** One CSV field: neutralise spreadsheet formulas, then quote when needed */
export function csvField(v: string | number | null | undefined): string {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const META_HEADER = 'email,fn,ln,zip,country,value';

export interface MetaRow {
  email: string;
  marketing: MarketingStatus;
  firstName?: string;
  lastName?: string;
  postcode?: string;
  country?: string;
  totalSpent?: number | null;
}

/** The customer list for Meta. Only rows whose marketing status is 'subscribed'. */
export function toMetaCsv(rows: MetaRow[]): string {
  const lines = [META_HEADER];
  for (const r of rows) {
    if (r.marketing !== 'subscribed') continue;
    lines.push([
      csvField(r.email),
      csvField(r.firstName ?? ''),
      csvField(r.lastName ?? ''),
      csvField(r.postcode ?? ''),
      csvField(countryCode(r.country)),
      csvField(typeof r.totalSpent === 'number' ? r.totalSpent.toFixed(2) : ''),
    ].join(','));
  }
  return `${lines.join('\n')}\n`;
}

/** The title Pawtraits shows for a catalogue design (same rule as the divider card admin) */
export function designTitle(description: string | null | undefined): string {
  const d = description || '';
  return d.match(/\*\*(.+?)\*\*/)?.[1]?.trim() || d.replace(/[#*_]/g, '').trim().slice(0, 60) || 'Untitled design';
}

// ---------------------------------------------------------------------------------------------
// Database

/** Page through a query 1000 rows at a time, up to ROW_CAP rows */
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: { message: string } | null }>): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = [];
  for (let from = 0; from < ROW_CAP; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

const chunks = <T,>(list: T[], n = CHUNK): T[][] => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));

async function loadLocations(supabase: SupabaseClient): Promise<Map<string, string>> {
  const { data, error } = await supabase.from('stock_locations').select('id, name');
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((l: any) => [l.id as string, l.name as string]));
}

export async function listLocations(supabase: SupabaseClient): Promise<{ id: string; name: string }[]> {
  const m = await loadLocations(supabase);
  return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

const ORDER_COLS = 'id, status, customer_email, shipping_first_name, shipping_last_name, shipping_postcode, shipping_country, total_amount, created_at, pos_location_id, qr_scan_id, guest_session_id';

const NOT_A_SALE = new Set(['cancelled', 'canceled', 'refunded', 'failed']);

/** Every paid order (not date filtered: "has this person ever bought" must not depend on the filters) */
async function loadPaidOrders(supabase: SupabaseClient) {
  const all = await fetchAll<OrderRow & { status?: string | null }>((a, b) =>
    supabase.from('orders').select(ORDER_COLS).eq('payment_status', 'paid')
      .order('created_at', { ascending: false }).order('id').range(a, b));
  // Same rule as the admin dashboard: a cancelled or refunded order does not make someone a buyer
  return { rows: all.rows.filter(o => !NOT_A_SALE.has(String(o.status || '').toLowerCase())) as OrderRow[], truncated: all.truncated };
}

const mapStates = (m: Map<string, MarketingState>) => new Map(Array.from(m, ([e, s]) => [e, statusOf(s)] as const));

export async function loadBuyers(supabase: SupabaseClient, filters: AudienceFilters = {}): Promise<LoadResult<BuyerRow>> {
  const { fromTs, toTs } = dateBounds(filters.from, filters.to);
  const [locNames, paid] = await Promise.all([loadLocations(supabase), loadPaidOrders(supabase)]);
  const orders = paid.rows.filter(o => inRange(o.created_at, fromTs, toTs) && (!filters.locationId || o.pos_location_id === filters.locationId));
  const rows = groupBuyers(orders, locNames);

  const emails = rows.map(r => r.email);
  const marketing = mapStates(await marketingStates(supabase, emails));
  const profileIds = new Map<string, string>();
  for (const chunk of chunks(emails)) {
    const { data } = await supabase.from('user_profiles').select('id, email').eq('user_type', 'customer').in('email', chunk);
    for (const p of data ?? []) profileIds.set(lower((p as any).email), (p as any).id);
  }
  for (const r of rows) { r.marketing = marketing.get(r.email) ?? 'not asked'; r.customerId = profileIds.get(r.email) ?? null; }

  return {
    rows, truncated: paid.truncated,
    summary: { total: rows.length, subscribed: rows.filter(r => r.marketing === 'subscribed').length, truncated: paid.truncated },
  };
}

export async function loadPreviewEmailers(supabase: SupabaseClient, filters: AudienceFilters = {}): Promise<LoadResult<PreviewerRow>> {
  const { fromTs, toTs } = dateBounds(filters.from, filters.to);
  const [locNames, paid, reqs] = await Promise.all([
    loadLocations(supabase),
    loadPaidOrders(supabase),
    fetchAll<PreviewRequestRow>((a, b) => {
      let q = supabase.from('preview_email_requests')
        .select('id, custom_image_id, email, guest_session_id, pos_location_id, last_sent_at, opened_at, created_at');
      if (fromTs) q = q.gte('created_at', fromTs);
      if (toTs) q = q.lt('created_at', toTs);
      if (filters.locationId) q = q.eq('pos_location_id', filters.locationId);
      return q.order('created_at', { ascending: false }).order('id').range(a, b);
    }),
  ]);

  const boughtEmails = new Set(paid.rows.map(o => lower(o.customer_email)).filter(Boolean));

  // Newest request per address decides the design shown: fetch the previews, then their catalogue images, in batches
  const latestByEmail = new Map<string, PreviewRequestRow>();
  for (const r of reqs.rows) { const e = lower(r.email); const cur = latestByEmail.get(e); if (!cur || r.created_at > cur.created_at) latestByEmail.set(e, r); }
  const imageIds = Array.from(new Set(Array.from(latestByEmail.values()).map(r => r.custom_image_id)));
  const customs = new Map<string, { catalog_image_id: string | null; generated_image_url: string | null }>();
  for (const chunk of chunks(imageIds)) {
    const { data } = await supabase.from('customer_custom_images').select('id, catalog_image_id, generated_image_url').in('id', chunk);
    for (const c of data ?? []) customs.set((c as any).id, c as any);
  }
  const catalogIds = Array.from(new Set(Array.from(customs.values()).map(c => c.catalog_image_id).filter((x): x is string => !!x)));
  const catalog = new Map<string, { description: string | null; stock_ref: number | null }>();
  for (const chunk of chunks(catalogIds)) {
    const { data } = await supabase.from('image_catalog').select('id, description, stock_ref').in('id', chunk);
    for (const c of data ?? []) catalog.set((c as any).id, c as any);
  }
  const designs = new Map<string, DesignInfo>();
  for (const id of imageIds) {
    const c = customs.get(id);
    if (!c) continue;
    const cat = c.catalog_image_id ? catalog.get(c.catalog_image_id) : undefined;
    designs.set(id, { title: cat ? designTitle(cat.description) : 'Own design', stockRef: cat?.stock_ref ?? null, thumb: c.generated_image_url ?? null });
  }

  const marketing = mapStates(await marketingStates(supabase, Array.from(latestByEmail.keys())));
  let rows = groupPreviewers(reqs.rows, { boughtEmails, marketing, locNames, designs });
  if (!filters.includeBought) rows = rows.filter(r => !r.hasBought);

  const truncated = reqs.truncated || paid.truncated;
  return { rows, truncated, summary: { total: rows.length, subscribed: rows.filter(r => r.marketing === 'subscribed').length, truncated } };
}

export async function loadScanners(supabase: SupabaseClient, filters: AudienceFilters = {}): Promise<LoadResult<ScannerRow>> {
  const { fromTs, toTs } = dateBounds(filters.from, filters.to);
  const [locNames, paid, scans, emailReqs, previews] = await Promise.all([
    loadLocations(supabase),
    loadPaidOrders(supabase),
    fetchAll<ScanRow>((a, b) => {
      let q = supabase.from('qr_scans').select('id, visitor_id, stock_ref, location_id, location_code, is_repeat, order_id, created_at').eq('is_bot', false);
      if (fromTs) q = q.gte('created_at', fromTs);
      if (toTs) q = q.lt('created_at', toTs);
      if (filters.locationId) q = q.eq('location_id', filters.locationId);
      return q.order('created_at', { ascending: false }).order('id').range(a, b);
    }),
    // Tolerant: before the preview-emails migration has been run this table does not exist; scanners still load
    fetchAll<{ guest_session_id: string }>((a, b) =>
      supabase.from('preview_email_requests').select('guest_session_id').not('guest_session_id', 'is', null).order('id').range(a, b))
      .catch(() => ({ rows: [] as { guest_session_id: string }[], truncated: false })),
    fetchAll<{ guest_session_id: string }>((a, b) =>
      supabase.from('customer_custom_images').select('guest_session_id').not('guest_session_id', 'is', null).order('id').range(a, b)),
  ]);

  const ctx: ScannerContext = {
    locNames,
    paidOrderIds: new Set(paid.rows.map(o => o.id)),
    paidOrderScanIds: new Set(paid.rows.map(o => o.qr_scan_id).filter((x): x is string => !!x)),
    paidOrderVisitors: new Set(paid.rows.map(o => o.guest_session_id).filter((x): x is string => !!x)),
    emailVisitors: new Set(emailReqs.rows.map(r => r.guest_session_id)),
    previewVisitors: new Set(previews.rows.map(r => r.guest_session_id)),
  };
  let rows = groupScanners(scans.rows, ctx);
  if (!filters.includeBought) rows = rows.filter(r => r.stage !== 'Bought');

  const truncated = scans.truncated || paid.truncated || emailReqs.truncated || previews.truncated;
  const count = (s: ScannerStage) => rows.filter(r => r.stage === s).length;
  return {
    rows, truncated,
    summary: { total: rows.length, subscribed: 0, truncated, bought: count('Bought'), leftEmail: count('Left an email'), madePreview: count('Made a preview'), scannedOnly: count('Scanned only') },
  };
}

export { normaliseEmail };
