/**
 * Audiences for the admin (server only): who bought, who asked for a preview by email and has not bought,
 * and which anonymous devices scanned a stall QR code. Buyers and preview emailers can be downloaded as a
 * customer list for Meta, but ONLY addresses that are subscribed (email_preferences) are ever included.
 *
 * Tables read: orders (payment_status = 'paid'), preview_email_requests, qr_scans, customer_custom_images,
 * image_catalog (breed_id, coat_id), breeds, coats, stock_locations, user_profiles, email_preferences (through marketingStates).
 *
 * Segments (breed, coat, design) for previews and scans:
 *  - Scanner: from the designs scanned (qr_scans.image_id -> image_catalog.breed_id / coat_id / id).
 *  - Preview emailer: breed = customer_custom_images.pet_breed_id of the latest preview, else the design's breed;
 *    coat = customer_custom_images.pet_coat_id, else the design's coat; design = customer_custom_images.catalog_image_id.
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
  image_id?: string | null;          // image_catalog.id
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
// Segments: breed, coat and design

/** A breed, coat or design id, or null when it is not known */
export type SegKey = string | null;
export type SegmentView = 'breed' | 'coat' | 'design';
export interface SegmentFilter { breed?: string | null; coat?: string | null; design?: string | null }

/** Each key with how many times it applies to one row (scans for a scanner, 1 for a preview emailer) */
export interface SegCounts {
  breeds: Array<[SegKey, number]>;
  coats: Array<[SegKey, number]>;
  designs: Array<[SegKey, number]>;
}

export interface SegLabel { id: string; name: string; fromDesign: boolean }
export interface CatalogDesign { id: string; title: string; stockRef: number | null; breedId: string | null; coatId: string | null; thumb: string | null }
export interface SegmentNames {
  designs: Map<string, CatalogDesign>;
  breeds: Map<string, string>;
  coats: Map<string, string>;
}
export const emptyNames = (): SegmentNames => ({ designs: new Map(), breeds: new Map(), coats: new Map() });

export interface Facets {
  breeds: { id: string; name: string; count: number }[];
  coats: { id: string; name: string; count: number }[];
  designs: { id: string; title: string; stockRef: number | null; count: number }[];
}

export interface ScanDesign { id: string; title: string; stockRef: number | null; thumb: string | null }

/** What one preview emailer's design, pet and the catalogue say about breed and coat */
export interface PreviewMeta { catalogImageId: string | null; petBreedId: string | null; petCoatId: string | null }

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
  designId: string | null;             // image_catalog.id of the latest emailed preview
  breed: SegLabel | null;              // the pet's breed, else the design's (fromDesign)
  coat: SegLabel | null;
  hasBought: boolean;
  lastAt: string;
  seg: SegCounts;
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
  flags: StageFlags;
  topDesign: ScanDesign | null;        // the most scanned design
  moreDesigns: number;                 // other different designs scanned
  breed: SegLabel | null;              // of the most scanned design
  coat: SegLabel | null;
  seg: SegCounts;
}

export interface LoadResult<T> { rows: T[]; summary: Summary; truncated: boolean }
/** Preview emailers and scanners: rows honour include-bought; allRows never drop buyers (for the Bought column) */
export interface SegmentLoad<T> extends LoadResult<T> { allRows: T[]; names: SegmentNames }

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

/** Count how often each key occurs, in order of first appearance */
export function tally(keys: SegKey[]): Array<[SegKey, number]> {
  const m = new Map<SegKey, number>();
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
  return Array.from(m.entries());
}

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
  /** names for the segments; without it every breed, coat and design is unknown */
  names?: SegmentNames;
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
    const names = ctx.names ?? emptyNames();
    const imageCounts = new Map<string, number>();
    const imageRefs = new Map<string, number>();
    const breedKeys: SegKey[] = [], coatKeys: SegKey[] = [], designKeys: SegKey[] = [];
    for (const s of list) {
      const cat = s.image_id ? names.designs.get(s.image_id) : undefined;
      designKeys.push(s.image_id ?? null);
      breedKeys.push(cat?.breedId ?? null);
      coatKeys.push(cat?.coatId ?? null);
      if (s.image_id) { imageCounts.set(s.image_id, (imageCounts.get(s.image_id) ?? 0) + 1); imageRefs.set(s.image_id, s.stock_ref); }
      if (s.created_at < first) first = s.created_at;
      if (s.created_at > last) last = s.created_at;
      if (!s.is_repeat) newScans++;
      if ((s.order_id && ctx.paidOrderIds.has(s.order_id)) || ctx.paidOrderScanIds.has(s.id)) bought = true;
      const stall = (s.location_id && ctx.locNames.get(s.location_id)) || s.location_code;
      if (stall) stalls.set(stall, true);
      refs.set(s.stock_ref, (refs.get(s.stock_ref) ?? 0) + 1);
    }
    const flags: StageFlags = { bought, leftEmail: ctx.emailVisitors.has(visitorId), madePreview: ctx.previewVisitors.has(visitorId) };
    const topId = Array.from(imageCounts.entries())
      .sort((a, b) => b[1] - a[1] || (imageRefs.get(a[0]) ?? 0) - (imageRefs.get(b[0]) ?? 0) || (a[0] < b[0] ? -1 : 1))[0]?.[0] ?? null;
    const topCat = topId ? names.designs.get(topId) : undefined;
    const label = (id: string | null | undefined, map: Map<string, string>): SegLabel | null =>
      id ? { id, name: map.get(id) ?? 'Unknown', fromDesign: false } : null;
    rows.push({
      visitorId, firstScanAt: first, lastScanAt: last, scans: list.length, newScans,
      stalls: Array.from(stalls.keys()),
      designs: Array.from(refs.entries()).sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 3).map(([r]) => `#${r}`),
      stage: scannerStage(flags),
      flags,
      topDesign: topId ? { id: topId, title: topCat?.title ?? 'Design', stockRef: topCat?.stockRef ?? imageRefs.get(topId) ?? null, thumb: topCat?.thumb ?? null } : null,
      moreDesigns: Math.max(0, imageCounts.size - 1),
      breed: label(topCat?.breedId, names.breeds),
      coat: label(topCat?.coatId, names.coats),
      seg: { breeds: tally(breedKeys), coats: tally(coatKeys), designs: tally(designKeys) },
    });
  }
  return rows.sort((a, b) => (a.lastScanAt < b.lastScanAt ? 1 : a.lastScanAt > b.lastScanAt ? -1 : 0));
}

/** Group preview email requests into one row per lower-cased email. Newest activity first. */
export function groupPreviewers(
  reqs: PreviewRequestRow[],
  ctx: {
    boughtEmails: Set<string>; marketing: Map<string, MarketingStatus>; locNames: Map<string, string>; designs: Map<string, DesignInfo>;
    /** per custom image id: the catalogue design and the pet's breed and coat */
    meta?: Map<string, PreviewMeta>;
    names?: SegmentNames;
  },
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
    const names = ctx.names ?? emptyNames();
    const meta = ctx.meta?.get(latest.custom_image_id);
    const cat = meta?.catalogImageId ? names.designs.get(meta.catalogImageId) : undefined;
    const breedId = meta?.petBreedId ?? cat?.breedId ?? null;
    const coatId = meta?.petCoatId ?? cat?.coatId ?? null;
    const breed: SegLabel | null = breedId ? { id: breedId, name: names.breeds.get(breedId) ?? 'Unknown', fromDesign: !meta?.petBreedId } : null;
    const coat: SegLabel | null = coatId ? { id: coatId, name: names.coats.get(coatId) ?? 'Unknown', fromDesign: !meta?.petCoatId } : null;
    const designId = meta?.catalogImageId ?? null;
    rows.push({
      email, previews: list.length,
      lastSentAt: sent.length ? sent[sent.length - 1] : null,
      opened: list.some(r => !!r.opened_at),
      marketing: ctx.marketing.get(email) ?? 'not asked',
      stall: stallId ? ctx.locNames.get(stallId) ?? null : null,
      design: ctx.designs.get(latest.custom_image_id) ?? null,
      designId, breed, coat,
      seg: { breeds: [[breedId, 1]], coats: [[coatId, 1]], designs: [[designId, 1]] },
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
// Segment filters, facets and breakdowns (pure)

type Segmented = { seg: SegCounts };
const SEG_FIELD = { breed: 'breeds', coat: 'coats', design: 'designs' } as const;

const hasKey = (list: Array<[SegKey, number]>, id: string) => list.some(([k]) => k === id);

/** Keep rows that match every chosen filter. A row with several designs matches if ANY of them matches. */
export function applySegmentFilter<T extends Segmented>(rows: T[], f: SegmentFilter): T[] {
  if (!f.breed && !f.coat && !f.design) return rows;
  return rows.filter(r =>
    (!f.breed || hasKey(r.seg.breeds, f.breed)) &&
    (!f.coat || hasKey(r.seg.coats, f.coat)) &&
    (!f.design || hasKey(r.seg.designs, f.design)));
}

const byName = (a: string, b: string) => a.localeCompare(b, 'en-GB', { sensitivity: 'base' });

/** The dropdown options present in these rows, each with how many rows (people or scanners) have it. Unknown is left out. */
export function segmentFacets<T extends Segmented>(rows: T[], names: SegmentNames): Facets {
  const count = (field: 'breeds' | 'coats' | 'designs') => {
    const m = new Map<string, number>();
    for (const r of rows) for (const [k] of r.seg[field]) if (k) m.set(k, (m.get(k) ?? 0) + 1);
    return m;
  };
  const named = (field: 'breeds' | 'coats', lookup: Map<string, string>) =>
    Array.from(count(field).entries()).map(([id, n]) => ({ id, name: lookup.get(id) ?? 'Unknown', count: n })).sort((a, b) => byName(a.name, b.name));
  return {
    breeds: named('breeds', names.breeds),
    coats: named('coats', names.coats),
    designs: Array.from(count('designs').entries())
      .map(([id, n]) => { const d = names.designs.get(id); return { id, title: d?.title ?? 'Unknown design', stockRef: d?.stockRef ?? null, count: n }; })
      .sort((a, b) => byName(a.title, b.title) || (a.stockRef ?? 0) - (b.stockRef ?? 0)),
  };
}
export const scannerFacets = (rows: ScannerRow[], names: SegmentNames): Facets => segmentFacets(rows, names);
export const previewerFacets = (rows: PreviewerRow[], names: SegmentNames): Facets => segmentFacets(rows, names);

export interface BreakdownRow {
  id: string | null;                   // null is the Unknown row
  name: string;
  stockRef: number | null;             // designs only
  [k: string]: string | number | null;
}
export interface ScannerBreakdownRow extends BreakdownRow {
  scans: number; scanners: number; madePreview: number; leftEmail: number; bought: number; scanToPreview: string;
}
export interface PreviewerBreakdownRow extends BreakdownRow {
  people: number; opened: number; subscribed: number; bought: number;
}

/** A percentage, or a dash when there is nothing to divide by */
export const pctLabel = (part: number, whole: number): string => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '–');

const labelFor = (by: SegmentView, id: string | null, names: SegmentNames): { name: string; stockRef: number | null } => {
  if (!id) return { name: 'Unknown', stockRef: null };
  if (by === 'breed') return { name: names.breeds.get(id) ?? 'Unknown', stockRef: null };
  if (by === 'coat') return { name: names.coats.get(id) ?? 'Unknown', stockRef: null };
  const d = names.designs.get(id);
  return { name: d?.title ?? 'Unknown design', stockRef: d?.stockRef ?? null };
};

/** Biggest first by the named number; the Unknown row always last */
function sortBreakdown<T extends BreakdownRow>(rows: T[], first: keyof T & string): T[] {
  return rows.sort((a, b) => {
    if ((a.id === null) !== (b.id === null)) return a.id === null ? 1 : -1;
    return (Number(b[first]) - Number(a[first])) || byName(a.name, b.name) || (a.stockRef ?? 0) - (b.stockRef ?? 0);
  });
}

/**
 * One row per breed, coat or design. A scanner counts once in every row they scanned (so rows can add up to more than
 * the number of scanners). Buyers are left out of every column but Bought unless includeBought is on; Bought always
 * counts every buyer of that row, so conversion shows even when buyers are hidden from the list.
 */
export function scannerBreakdown(rows: ScannerRow[], by: SegmentView, includeBought: boolean, names: SegmentNames): ScannerBreakdownRow[] {
  const acc = new Map<SegKey, ScannerBreakdownRow & { progressed: number }>();
  for (const r of rows) {
    const counted = includeBought || !r.flags.bought;
    for (const [key, n] of r.seg[SEG_FIELD[by]]) {
      let a = acc.get(key);
      if (!a) {
        const l = labelFor(by, key, names);
        a = { id: key, name: l.name, stockRef: l.stockRef, scans: 0, scanners: 0, madePreview: 0, leftEmail: 0, bought: 0, scanToPreview: '–', progressed: 0 };
        acc.set(key, a);
      }
      if (r.flags.bought) a.bought++;
      if (!counted) continue;
      a.scans += n;
      a.scanners++;
      if (r.flags.madePreview) a.madePreview++;
      if (r.flags.leftEmail) a.leftEmail++;
      if (r.stage !== 'Scanned only') a.progressed++;
    }
  }
  return sortBreakdown(Array.from(acc.values()).map(({ progressed, ...a }) => ({ ...a, scanToPreview: pctLabel(progressed, a.scanners) })), 'scans');
}

/** Same idea for people who asked for a preview by email. Bought ignores the include-bought toggle. */
export function previewerBreakdown(rows: PreviewerRow[], by: SegmentView, includeBought: boolean, names: SegmentNames): PreviewerBreakdownRow[] {
  const acc = new Map<SegKey, PreviewerBreakdownRow>();
  for (const r of rows) {
    const counted = includeBought || !r.hasBought;
    for (const [key] of r.seg[SEG_FIELD[by]]) {
      let a = acc.get(key);
      if (!a) {
        const l = labelFor(by, key, names);
        a = { id: key, name: l.name, stockRef: l.stockRef, people: 0, opened: 0, subscribed: 0, bought: 0 };
        acc.set(key, a);
      }
      if (r.hasBought) a.bought++;
      if (!counted) continue;
      a.people++;
      if (r.opened) a.opened++;
      if (r.marketing === 'subscribed') a.subscribed++;
    }
  }
  return sortBreakdown(Array.from(acc.values()), 'people');
}

/** Rows without the internal segment lists, for the JSON response */
export const withoutSeg = <T extends Segmented>(rows: T[]): Omit<T, 'seg'>[] => rows.map(({ seg, ...rest }) => rest);

export function summariseScanners(rows: ScannerRow[], truncated: boolean): Summary {
  const count = (s: ScannerStage) => rows.filter(r => r.stage === s).length;
  return { total: rows.length, subscribed: 0, truncated, bought: count('Bought'), leftEmail: count('Left an email'), madePreview: count('Made a preview'), scannedOnly: count('Scanned only') };
}
export const summarisePreviewers = (rows: PreviewerRow[], truncated: boolean): Summary =>
  ({ total: rows.length, subscribed: rows.filter(r => r.marketing === 'subscribed').length, truncated });

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


/** Catalogue designs (with breed and coat ids) for these image ids, then the names of every breed and coat involved. No per-row queries. */
export async function loadSegmentNames(supabase: SupabaseClient, imageIds: string[], extraBreedIds: string[] = [], extraCoatIds: string[] = []): Promise<SegmentNames> {
  const names = emptyNames();
  for (const chunk of chunks(Array.from(new Set(imageIds)))) {
    const { data, error } = await supabase.from('image_catalog').select('id, description, stock_ref, breed_id, coat_id, public_url').in('id', chunk);
    if (error) throw new Error(error.message);
    for (const c of data ?? []) {
      const r = c as any;
      names.designs.set(r.id, { id: r.id, title: designTitle(r.description), stockRef: r.stock_ref ?? null, breedId: r.breed_id ?? null, coatId: r.coat_id ?? null, thumb: r.public_url ?? null });
    }
  }
  const designs = Array.from(names.designs.values());
  const fill = async (table: 'breeds' | 'coats', ids: string[], into: Map<string, string>) => {
    for (const chunk of chunks(Array.from(new Set(ids)))) {
      const { data, error } = await supabase.from(table).select('id, name').in('id', chunk);
      if (error) throw new Error(error.message);
      for (const b of data ?? []) into.set((b as any).id, (b as any).name);
    }
  };
  await Promise.all([
    fill('breeds', [...extraBreedIds, ...designs.map(d => d.breedId).filter((x): x is string => !!x)], names.breeds),
    fill('coats', [...extraCoatIds, ...designs.map(d => d.coatId).filter((x): x is string => !!x)], names.coats),
  ]);
  return names;
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

export async function loadPreviewEmailers(supabase: SupabaseClient, filters: AudienceFilters = {}): Promise<SegmentLoad<PreviewerRow>> {
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
  const customs = new Map<string, { catalog_image_id: string | null; generated_image_url: string | null; pet_breed_id: string | null; pet_coat_id: string | null }>();
  for (const chunk of chunks(imageIds)) {
    const { data } = await supabase.from('customer_custom_images').select('id, catalog_image_id, generated_image_url, pet_breed_id, pet_coat_id').in('id', chunk);
    for (const c of data ?? []) customs.set((c as any).id, c as any);
  }
  const customList = Array.from(customs.values());
  const catalogIds = Array.from(new Set(customList.map(c => c.catalog_image_id).filter((x): x is string => !!x)));
  const names = await loadSegmentNames(
    supabase, catalogIds,
    customList.map(c => c.pet_breed_id).filter((x): x is string => !!x),
    customList.map(c => c.pet_coat_id).filter((x): x is string => !!x),
  );
  const designs = new Map<string, DesignInfo>();
  const meta = new Map<string, PreviewMeta>();
  for (const id of imageIds) {
    const c = customs.get(id);
    if (!c) continue;
    const cat = c.catalog_image_id ? names.designs.get(c.catalog_image_id) : undefined;
    designs.set(id, { title: cat ? cat.title : 'Own design', stockRef: cat?.stockRef ?? null, thumb: c.generated_image_url ?? null });
    meta.set(id, { catalogImageId: c.catalog_image_id ?? null, petBreedId: c.pet_breed_id ?? null, petCoatId: c.pet_coat_id ?? null });
  }

  const marketing = mapStates(await marketingStates(supabase, Array.from(latestByEmail.keys())));
  const allRows = groupPreviewers(reqs.rows, { boughtEmails, marketing, locNames, designs, meta, names });
  const rows = filters.includeBought ? allRows : allRows.filter(r => !r.hasBought);

  const truncated = reqs.truncated || paid.truncated;
  return { rows, allRows, names, truncated, summary: summarisePreviewers(rows, truncated) };
}

export async function loadScanners(supabase: SupabaseClient, filters: AudienceFilters = {}): Promise<SegmentLoad<ScannerRow>> {
  const { fromTs, toTs } = dateBounds(filters.from, filters.to);
  const [locNames, paid, scans, emailReqs, previews] = await Promise.all([
    loadLocations(supabase),
    loadPaidOrders(supabase),
    fetchAll<ScanRow>((a, b) => {
      let q = supabase.from('qr_scans').select('id, visitor_id, stock_ref, image_id, location_id, location_code, is_repeat, order_id, created_at').eq('is_bot', false);
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

  // Breed, coat and title of every design scanned: one batched read, not one per scan
  const names = await loadSegmentNames(supabase, scans.rows.map(s => s.image_id).filter((x): x is string => !!x));
  const ctx: ScannerContext = {
    locNames, names,
    paidOrderIds: new Set(paid.rows.map(o => o.id)),
    paidOrderScanIds: new Set(paid.rows.map(o => o.qr_scan_id).filter((x): x is string => !!x)),
    paidOrderVisitors: new Set(paid.rows.map(o => o.guest_session_id).filter((x): x is string => !!x)),
    emailVisitors: new Set(emailReqs.rows.map(r => r.guest_session_id)),
    previewVisitors: new Set(previews.rows.map(r => r.guest_session_id)),
  };
  const allRows = groupScanners(scans.rows, ctx);
  const rows = filters.includeBought ? allRows : allRows.filter(r => r.stage !== 'Bought');

  const truncated = scans.truncated || paid.truncated || emailReqs.truncated || previews.truncated;
  return { rows, allRows, names, truncated, summary: summariseScanners(rows, truncated) };
}

export { normaliseEmail };
