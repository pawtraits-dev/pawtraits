/**
 * Admin > Popularity (server only for the loaders; every grouping function is pure, so
 * scripts/test-popularity.ts needs no database).
 *
 * Prints: one row per ORIGINAL design. Every version of a design (the same picture redone for another breed or
 * coat, linked by image_catalog.variation_of; older versions are recognised by tags / folders, see
 * lib/catalog/originals.ts) counts towards its original.
 *   scans              qr_scans (is_bot = false): image_id -> image_catalog.id, location_id = stall
 *   previews           customer_custom_images (status <> 'failed'): catalog_image_id = the design version used
 *   preview emails     preview_email_requests: custom_image_id -> customer_custom_images.catalog_image_id, pos_location_id = stall
 *   sold               order_items of paid orders (not cancelled / refunded): image_id is TEXT and holds either an
 *                      image_catalog.id (a design bought as it is) or a customer_custom_images.id (a customised
 *                      portrait; its design is customer_custom_images.catalog_image_id). Same rule as lib/orders/order-image.ts.
 *                      Money: order_items.total_price (pence), else unit_price * quantity.
 * Breeds: the customer's own pet from customer_custom_images (pet_breed_id, pet_coat_id, detected_breed in metadata),
 * not the design's breed.
 * A preview cannot be tied to a stall (customer_custom_images has no stall column); only emailed previews can
 * (preview_email_requests.pos_location_id), so the stall filter leaves "previews made" alone.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { looksLikeVersion } from '../catalog/originals';
import { chunks, csvField, designTitle, fetchAll, NOT_A_SALE, ROW_CAP } from '../marketing/audiences';
import { loadOutcomes } from './customisation-stats';

export type Period = '7' | '30' | '90' | 'all';
export type Animal = 'dog' | 'cat';
export type PrintSort = 'sold' | 'scans' | 'previews' | 'revenue';
export const PERIODS: Period[] = ['7', '30', '90', 'all'];
export const PRINT_SORTS: PrintSort[] = ['sold', 'scans', 'previews', 'revenue'];
export const TOP_PRINTS = 100;
const DAY = 86_400_000;

// ---------------------------------------------------------------------------------------------
// Periods

/** from is inclusive, to is exclusive (milliseconds); from null = since the beginning */
export interface Range { from: number | null; to: number }

export function periodRanges(period: Period, now = Date.now()): { current: Range; previous: Range | null } {
  if (period === 'all') return { current: { from: null, to: now }, previous: null };
  const span = Number(period) * DAY;
  return { current: { from: now - span, to: now }, previous: { from: now - 2 * span, to: now - span } };
}

export const inRange = (at: number, r: Range | null) => !!r && (r.from === null || at >= r.from) && at < r.to;

/** Fraction, or null when there is nothing to divide by */
export const ratio = (n: number, d: number): number | null => (d > 0 ? n / d : null);

const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------------------------
// Originals and their versions

export interface CatalogLink { id: string; variation_of: string | null; /** recognised as a version by tags / folder but not linked */ legacy?: boolean }
export interface RootInfo { rootId: string; /** a version with no link to its original: counted as its own design */ unlinked: boolean }

/**
 * The original design of every row: follow variation_of up. A row with no link is its own root (flagged
 * unlinked when its tags / folder say it is a version). A parent that is not in `rows` ends the walk at the child.
 * A cycle never loops: every member of it gets the smallest id in the cycle as its root.
 */
export function resolveRoots(rows: CatalogLink[]): Map<string, RootInfo> {
  const byId = new Map(rows.map(r => [r.id, r] as const));
  const out = new Map<string, RootInfo>();
  for (const row of rows) {
    const path: string[] = [];
    let cur = row.id;
    let root = row.id;
    for (let guard = 0; guard < 1000; guard++) {
      const at = path.indexOf(cur);
      if (at >= 0) { root = path.slice(at).reduce((a, b) => (b < a ? b : a)); break; }
      const node = byId.get(cur);
      if (!node) { root = path.length ? path[path.length - 1] : cur; break; }
      path.push(cur);
      if (!node.variation_of) { root = cur; break; }
      cur = node.variation_of;
    }
    const r = byId.get(root);
    out.set(row.id, { rootId: root, unlinked: !!r && !r.variation_of && !!r.legacy });
  }
  return out;
}

/** How many versions each original has: everything below it, however deep (cycle safe), not counting itself */
export function countVersions(rootIds: string[], edges: { id: string; parent: string }[]): Map<string, number> {
  const kids = new Map<string, string[]>();
  for (const e of edges) { const l = kids.get(e.parent) ?? []; l.push(e.id); kids.set(e.parent, l); }
  const out = new Map<string, number>();
  for (const root of rootIds) {
    const seen = new Set<string>([root]);
    const stack = [root];
    while (stack.length) {
      for (const k of kids.get(stack.pop()!) ?? []) if (!seen.has(k)) { seen.add(k); stack.push(k); }
    }
    out.set(root, seen.size - 1);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Prints

export interface ScanEvt { at: number; imageId: string | null; visitor: string; locationId: string | null }
export interface PreviewEvt { at: number; imageId: string | null }
export interface EmailEvt { at: number; imageId: string | null; locationId: string | null }
export interface SaleEvt { at: number; orderId: string; imageId: string | null; locationId: string | null; qty: number; pence: number }
export interface PrintEvents { scans: ScanEvt[]; previews: PreviewEvt[]; emails: EmailEvt[]; sales: SaleEvt[] }

export interface VersionInfo extends RootInfo { breedId: string | null }
export interface DesignInfo { title: string; stockRef: number | null; thumb: string | null }
export interface BreedInfo { name: string; animal: Animal | string }

export interface PrintContext {
  versions: Map<string, VersionInfo>;   // catalogue id -> its original and breed
  designs: Map<string, DesignInfo>;     // original id -> title etc.
  breeds: Map<string, BreedInfo>;
  versionCounts?: Map<string, number>;
}
export interface PrintOptions { current: Range; previous: Range | null; locationId?: string | null; animal?: Animal | null; sort?: PrintSort; limit?: number }

export interface BreedSplit { breed: string; scans: number; previews: number; sold: number }
export interface PrintRow {
  id: string; title: string; stockRef: number | null; thumb: string | null;
  versions: number; unlinked: boolean;
  scans: number; scanners: number; previews: number; emails: number; orders: number; sold: number; revenue: number; // pounds
  scanToPreview: number | null; previewToOrder: number | null;
  /** primary metric now minus the previous period (null for all time) */
  change: number | null;
  breeds: BreedSplit[];
}
export interface PrintsResult { rows: PrintRow[]; total: number; sort: PrintSort; stallFiltered: boolean }

interface Acc {
  scans: number; scanners: Set<string>; previews: number; emails: number; orders: Set<string>; sold: number; pence: number;
  byBreed: Map<string, { scans: number; previews: number; sold: number }>;
}
const newAcc = (): Acc => ({ scans: 0, scanners: new Set(), previews: 0, emails: 0, orders: new Set(), sold: 0, pence: 0, byBreed: new Map() });

/** Everything that happened in one range, rolled up per original design */
function tally(ev: PrintEvents, range: Range, ctx: PrintContext, o: PrintOptions): Map<string, Acc> {
  const out = new Map<string, Acc>();
  const at = (imageId: string | null) => {
    if (!imageId) return null;
    const v = ctx.versions.get(imageId);
    if (!v) return null;
    if (o.animal) {
      const b = v.breedId ? ctx.breeds.get(v.breedId) : null;
      if (!b || b.animal !== o.animal) return null; // a version with no breed has no animal to filter by
    }
    let acc = out.get(v.rootId);
    if (!acc) { acc = newAcc(); out.set(v.rootId, acc); }
    const key = v.breedId ?? '';
    let split = acc.byBreed.get(key);
    if (!split) { split = { scans: 0, previews: 0, sold: 0 }; acc.byBreed.set(key, split); }
    return { acc, split };
  };
  for (const s of ev.scans) {
    if (!inRange(s.at, range) || (o.locationId && s.locationId !== o.locationId)) continue;
    const t = at(s.imageId); if (!t) continue;
    t.acc.scans += 1; t.acc.scanners.add(s.visitor); t.split.scans += 1;
  }
  for (const p of ev.previews) {
    if (!inRange(p.at, range)) continue; // previews cannot be tied to a stall, so the stall filter does not apply
    const t = at(p.imageId); if (!t) continue;
    t.acc.previews += 1; t.split.previews += 1;
  }
  for (const e of ev.emails) {
    if (!inRange(e.at, range) || (o.locationId && e.locationId !== o.locationId)) continue;
    const t = at(e.imageId); if (!t) continue;
    t.acc.emails += 1;
  }
  for (const s of ev.sales) {
    if (!inRange(s.at, range) || (o.locationId && s.locationId !== o.locationId)) continue;
    const t = at(s.imageId); if (!t) continue;
    t.acc.orders.add(s.orderId); t.acc.sold += s.qty; t.acc.pence += s.pence; t.split.sold += s.qty;
  }
  return out;
}

const primary = (a: Acc | undefined, sort: PrintSort): number =>
  !a ? 0 : sort === 'sold' ? a.sold : sort === 'scans' ? a.scans : sort === 'previews' ? a.previews : round2(a.pence / 100);

/** The Prints tab: one row per original, sorted by the chosen metric, each with its breed split and change on the previous period */
export function buildPrints(ev: PrintEvents, ctx: PrintContext, o: PrintOptions): PrintsResult {
  const sort = o.sort ?? 'sold';
  const stallFiltered = !!o.locationId;
  const now = tally(ev, o.current, ctx, o);
  const before = o.previous ? tally(ev, o.previous, ctx, o) : null;

  const rows: PrintRow[] = Array.from(now, ([id, a]): PrintRow => {
    const d = ctx.designs.get(id);
    const v = ctx.versions.get(id);
    const revenue = round2(a.pence / 100);
    return {
      id, title: d?.title ?? 'Untitled design', stockRef: d?.stockRef ?? null, thumb: d?.thumb ?? null,
      versions: ctx.versionCounts?.get(id) ?? 0, unlinked: !!v?.unlinked,
      scans: a.scans, scanners: a.scanners.size, previews: a.previews, emails: a.emails,
      orders: a.orders.size, sold: a.sold, revenue,
      // Previews are not split by stall, so these two ratios would mix a stall with everywhere
      scanToPreview: stallFiltered ? null : ratio(a.previews, a.scans),
      previewToOrder: stallFiltered ? null : ratio(a.orders.size, a.previews),
      change: before ? round2(primary(a, sort) - primary(before.get(id), sort)) : null,
      breeds: Array.from(a.byBreed, ([breedId, s]) => ({ breed: breedId ? ctx.breeds.get(breedId)?.name ?? 'Unknown breed' : 'No breed', ...s }))
        .sort((x, y) => (y.sold - x.sold) || (y.previews - x.previews) || (y.scans - x.scans) || x.breed.localeCompare(y.breed, 'en-GB')),
    };
  }).filter(r => r.scans || r.previews || r.emails || r.orders);

  const key = (r: PrintRow) => (sort === 'sold' ? r.sold : sort === 'scans' ? r.scans : sort === 'previews' ? r.previews : r.revenue);
  rows.sort((a, b) => (key(b) - key(a)) || (b.scans - a.scans) || (b.previews - a.previews) || a.title.localeCompare(b.title, 'en-GB') || a.id.localeCompare(b.id));
  return { rows: rows.slice(0, o.limit ?? TOP_PRINTS), total: rows.length, sort, stallFiltered };
}

// ---------------------------------------------------------------------------------------------
// Breeds and coats of the customers' own pets

export interface PreviewRecord {
  at: number;
  breedId: string | null;
  coatId: string | null;
  /** lower-cased email, else the guest session id */
  person: string | null;
  bought: boolean;
  /** metadata.detected_breed */
  detected: { name: string; matched: boolean; animal: string | null } | null;
}
export interface PetNames { breeds: Map<string, BreedInfo>; coats: Map<string, BreedInfo> }

export interface CoatRow { id: string | null; name: string; previews: number; people: number; bought: number; /** of the previews for this breed */ share: number | null }
export interface BreedRow {
  id: string | null; name: string; animal: string | null;
  previews: number; people: number; bought: number; share: number | null; change: number | null;
  coats: CoatRow[];
}
export interface BreedsResult {
  summary: { previews: number; breedKnown: number; coatKnown: number; breedShare: number | null; coatShare: number | null };
  rows: BreedRow[];
  notRecognised: BreedRow & { names: { name: string; count: number }[] };
}

const NOT_KNOWN = 'Coat not known';

/** Animal of a record: from its breed, else what the photo detection said, else its coat */
function animalOf(r: PreviewRecord, n: PetNames): string | null {
  if (r.breedId) { const a = n.breeds.get(r.breedId)?.animal; if (a) return a; }
  if (r.detected?.animal === 'dog' || r.detected?.animal === 'cat') return r.detected.animal;
  if (r.coatId) return n.coats.get(r.coatId)?.animal ?? null;
  return null;
}

function people(list: PreviewRecord[]) { return new Set(list.map(r => r.person).filter((p): p is string => !!p)).size; }

function coatRows(list: PreviewRecord[], names: PetNames): CoatRow[] {
  const groups = new Map<string, PreviewRecord[]>();
  for (const r of list) { const k = r.coatId ?? ''; const g = groups.get(k) ?? []; g.push(r); groups.set(k, g); }
  return Array.from(groups, ([k, g]): CoatRow => ({
    id: k || null, name: k ? names.coats.get(k)?.name ?? 'Unknown coat' : NOT_KNOWN,
    previews: g.length, people: people(g), bought: g.filter(x => x.bought).length, share: ratio(g.length, list.length),
  })).sort((a, b) => ((a.id === null ? 1 : 0) - (b.id === null ? 1 : 0)) || (b.previews - a.previews) || a.name.localeCompare(b.name, 'en-GB'));
}

/** Previews made from customers' own pets in `current`, by breed with coats nested, plus "Not recognised" */
export function buildBreeds(records: PreviewRecord[], names: PetNames, current: Range, previous: Range | null, animal: Animal | null): BreedsResult {
  const keep = (r: PreviewRecord) => !animal || animalOf(r, names) === animal;
  const now = records.filter(r => inRange(r.at, current) && keep(r));
  const before = previous ? records.filter(r => inRange(r.at, previous) && keep(r)) : null;
  const count = (list: PreviewRecord[], breedId: string | null) => list.filter(r => r.breedId === breedId).length;

  const groups = new Map<string, PreviewRecord[]>();
  const unknown: PreviewRecord[] = [];
  for (const r of now) {
    if (!r.breedId) { unknown.push(r); continue; }
    const g = groups.get(r.breedId) ?? []; g.push(r); groups.set(r.breedId, g);
  }
  const rows: BreedRow[] = Array.from(groups, ([id, g]): BreedRow => ({
    id, name: names.breeds.get(id)?.name ?? 'Unknown breed', animal: names.breeds.get(id)?.animal ?? null,
    previews: g.length, people: people(g), bought: g.filter(x => x.bought).length, share: ratio(g.length, now.length),
    change: before ? g.length - count(before, id) : null,
    coats: coatRows(g, names),
  })).sort((a, b) => (b.previews - a.previews) || a.name.localeCompare(b.name, 'en-GB'));

  // Names the photo detection gave that are not in the breeds table, counted case-insensitively
  const tallyNames = new Map<string, { name: string; count: number }>();
  for (const r of unknown) {
    if (!r.detected || r.detected.matched) continue;
    const name = r.detected.name.trim();
    if (!name) continue;
    const k = name.toLowerCase();
    const t = tallyNames.get(k); if (t) t.count += 1; else tallyNames.set(k, { name, count: 1 });
  }
  const unknownBefore = before ? before.filter(r => !r.breedId).length : null;
  const breedKnown = now.length - unknown.length;
  const coatKnown = now.filter(r => r.coatId).length;
  return {
    summary: { previews: now.length, breedKnown, coatKnown, breedShare: ratio(breedKnown, now.length), coatShare: ratio(coatKnown, now.length) },
    rows,
    notRecognised: {
      id: null, name: 'Not recognised', animal: null,
      previews: unknown.length, people: people(unknown), bought: unknown.filter(x => x.bought).length, share: ratio(unknown.length, now.length),
      change: unknownBefore === null ? null : unknown.length - unknownBefore,
      coats: coatRows(unknown, names),
      names: Array.from(tallyNames.values()).sort((a, b) => (b.count - a.count) || a.name.localeCompare(b.name, 'en-GB')).slice(0, 15),
    },
  };
}

// ---------------------------------------------------------------------------------------------
// CSV (no personal data: counts only)

const pct = (v: number | null) => (v === null ? '' : (v * 100).toFixed(1));

export function printsCsv(rows: PrintRow[]): string {
  const head = ['Design', 'Stock ref', 'Versions', 'Scans', 'Scanners', 'Previews made', 'Preview emails', 'Orders', 'Prints sold', 'Revenue (GBP)', 'Scan to preview %', 'Preview to order %', 'Change'];
  const lines = [head.join(',')];
  for (const r of rows) {
    lines.push([r.title, r.stockRef ?? '', r.versions, r.scans, r.scanners, r.previews, r.emails, r.orders, r.sold, r.revenue.toFixed(2), pct(r.scanToPreview), pct(r.previewToOrder), r.change ?? ''].map(csvField).join(','));
  }
  return `${lines.join('\n')}\n`;
}

export function breedsCsv(res: BreedsResult): string {
  const lines = [['Breed', 'Coat', 'Previews made', 'People', 'Bought', 'Share %', 'Change'].join(',')];
  const line = (breed: string, coat: string, r: { previews: number; people: number; bought: number; share: number | null }, change: number | null) =>
    lines.push([breed, coat, r.previews, r.people, r.bought, pct(r.share), change ?? ''].map(csvField).join(','));
  for (const b of res.rows) {
    line(b.name, '', b, b.change);
    for (const c of b.coats) line(b.name, c.name, c, null);
  }
  const n = res.notRecognised;
  line(n.name, '', n, n.change);
  for (const c of n.coats) line(n.name, c.name, c, null);
  for (const u of n.names) lines.push([`${n.name}: ${u.name}`, '', u.count, '', '', '', ''].map(csvField).join(','));
  return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------------------------------------
// Database (server only). Tables are paged 1000 rows at a time, 20,000 rows at most (truncated is reported); joins are in memory.

export interface PopularityFilters { period: Period; locationId: string | null; animal: Animal | null; sort: PrintSort }
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const iso = (ms: number) => new Date(ms).toISOString();
const ms = (s: string | null | undefined) => (s ? new Date(s).getTime() : NaN);
const lower = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

/** Rows of `table` whose `col` is in `ids`, in batches */
async function selectIn<T>(supabase: SupabaseClient, table: string, columns: string, col: string, ids: string[]): Promise<T[]> {
  const out: T[] = [];
  for (const part of chunks(Array.from(new Set(ids)))) {
    const { data, error } = await supabase.from(table).select(columns).in(col, part);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as T[]));
  }
  return out;
}

export async function listStalls(supabase: SupabaseClient): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase.from('stock_locations').select('id, name');
  if (error) throw new Error(error.message);
  return (data ?? []).map((l: any) => ({ id: l.id as string, name: l.name as string })).sort((a, b) => a.name.localeCompare(b.name, 'en-GB'));
}

interface CatalogRow { id: string; variation_of: string | null; tags: string[] | null; cloudinary_public_id: string | null; description: string | null; stock_ref: number | null; public_url: string | null; breed_id: string | null }
const CATALOG_COLS = 'id, variation_of, tags, cloudinary_public_id, description, stock_ref, public_url, breed_id';

export interface PrintsLoad extends PrintsResult { truncated: boolean }

export async function loadPrints(supabase: SupabaseClient, f: PopularityFilters, now = Date.now()): Promise<PrintsLoad> {
  const { current, previous } = periodRanges(f.period, now);
  const since = previous?.from ?? current.from;
  let truncated = false;
  const keep = <T,>(r: { rows: T[]; truncated: boolean }) => { truncated = truncated || r.truncated; return r.rows; };

  const [scanRows, customRows, emailRows, orderRows] = await Promise.all([
    fetchAll<any>((a, b) => {
      let q = supabase.from('qr_scans').select('id, image_id, visitor_id, location_id, created_at').eq('is_bot', false);
      if (since !== null) q = q.gte('created_at', iso(since));
      if (f.locationId) q = q.eq('location_id', f.locationId);
      return q.order('created_at', { ascending: false }).order('id').range(a, b);
    }).then(keep),
    fetchAll<any>((a, b) => {
      let q = supabase.from('customer_custom_images').select('id, created_at, catalog_image_id').neq('status', 'failed');
      if (since !== null) q = q.gte('created_at', iso(since));
      return q.order('created_at', { ascending: false }).order('id').range(a, b);
    }).then(keep),
    // Tolerant: the table does not exist before the preview-emails migration has been run
    fetchAll<any>((a, b) => {
      let q = supabase.from('preview_email_requests').select('id, custom_image_id, pos_location_id, created_at');
      if (since !== null) q = q.gte('created_at', iso(since));
      if (f.locationId) q = q.eq('pos_location_id', f.locationId);
      return q.order('created_at', { ascending: false }).order('id').range(a, b);
    }).catch(() => ({ rows: [] as any[], truncated: false })).then(keep),
    fetchAll<any>((a, b) => {
      let q = supabase.from('orders').select('id, status, created_at, pos_location_id').eq('payment_status', 'paid');
      if (since !== null) q = q.gte('created_at', iso(since));
      if (f.locationId) q = q.eq('pos_location_id', f.locationId);
      return q.order('created_at', { ascending: false }).order('id').range(a, b);
    }).then(keep),
  ]);

  // Sales: lines of the paid orders that were not cancelled or refunded
  const orders = new Map<string, { at: number; locationId: string | null }>();
  for (const o of orderRows) if (!NOT_A_SALE.has(lower(o.status))) orders.set(o.id, { at: ms(o.created_at), locationId: o.pos_location_id ?? null });
  const lines: any[] = [];
  for (const part of chunks(Array.from(orders.keys()))) {
    lines.push(...keep(await fetchAll<any>((a, b) =>
      supabase.from('order_items').select('id, order_id, image_id, quantity, unit_price, total_price').in('order_id', part).order('id').range(a, b))));
  }

  // An order line's image_id is a catalogue id or a customisation id (see lib/orders/order-image.ts)
  const lineImageIds = Array.from(new Set(lines.map(l => String(l.image_id)).filter(id => UUID_RE.test(id))));
  const lineCatalog = new Set((await selectIn<{ id: string }>(supabase, 'image_catalog', 'id', 'id', lineImageIds)).map(r => r.id));
  const customCatalog = new Map<string, string | null>(customRows.map((c: any) => [c.id as string, (c.catalog_image_id as string | null) ?? null] as const));
  const wanted = (ids: string[]) => ids.filter(id => !customCatalog.has(id));
  const extraCustoms = await selectIn<{ id: string; catalog_image_id: string | null }>(
    supabase, 'customer_custom_images', 'id, catalog_image_id', 'id',
    wanted([...lineImageIds.filter(id => !lineCatalog.has(id)), ...emailRows.map((e: any) => String(e.custom_image_id))]));
  for (const c of extraCustoms) customCatalog.set(c.id, c.catalog_image_id ?? null);

  const designOf = (imageId: string): string | null => (lineCatalog.has(imageId) ? imageId : customCatalog.get(imageId) ?? null);

  // Catalogue rows of every version involved, then their parents until the originals are reached
  const catalog = new Map<string, CatalogRow>();
  const load = async (ids: string[]) => {
    for (const r of await selectIn<CatalogRow>(supabase, 'image_catalog', CATALOG_COLS, 'id', ids.filter(id => !catalog.has(id)))) catalog.set(r.id, r);
  };
  await load([
    ...scanRows.map((s: any) => s.image_id as string | null),
    ...Array.from(customCatalog.values()),
    ...Array.from(lineCatalog),
  ].filter((x): x is string => !!x));
  for (let depth = 0; depth < 10; depth++) {
    const parents = Array.from(catalog.values()).map(r => r.variation_of).filter((p): p is string => !!p && !catalog.has(p));
    if (!parents.length) break;
    await load(parents);
  }

  const links: CatalogLink[] = Array.from(catalog.values()).map(r => ({ id: r.id, variation_of: r.variation_of, legacy: !r.variation_of && looksLikeVersion(r) }));
  const roots = resolveRoots(links);
  const versions = new Map<string, VersionInfo>();
  const designs = new Map<string, DesignInfo>();
  roots.forEach((info, id) => {
    versions.set(id, { ...info, breedId: catalog.get(id)?.breed_id ?? null });
    const root = catalog.get(info.rootId);
    if (root && !designs.has(root.id)) designs.set(root.id, { title: designTitle(root.description), stockRef: root.stock_ref ?? null, thumb: root.public_url ?? null });
  });
  const breedIds = Array.from(new Set(Array.from(versions.values()).map(v => v.breedId).filter((x): x is string => !!x)));
  const breeds = new Map<string, BreedInfo>();
  for (const b of await selectIn<{ id: string; name: string; animal_type: string }>(supabase, 'breeds', 'id, name, animal_type', 'id', breedIds)) breeds.set(b.id, { name: b.name, animal: b.animal_type });

  const events: PrintEvents = {
    scans: scanRows.map((s: any) => ({ at: ms(s.created_at), imageId: s.image_id ?? null, visitor: String(s.visitor_id), locationId: s.location_id ?? null })),
    previews: customRows.map((c: any) => ({ at: ms(c.created_at), imageId: c.catalog_image_id ?? null })),
    emails: emailRows.map((e: any) => ({ at: ms(e.created_at), imageId: customCatalog.get(String(e.custom_image_id)) ?? null, locationId: e.pos_location_id ?? null })),
    sales: lines.flatMap((l): SaleEvt[] => {
      const o = orders.get(l.order_id);
      if (!o) return [];
      const qty = Number(l.quantity) || 1;
      return [{ at: o.at, orderId: l.order_id, imageId: designOf(String(l.image_id)), locationId: o.locationId, qty, pence: Number(l.total_price ?? (Number(l.unit_price) || 0) * qty) || 0 }];
    }),
  };

  const opts: PrintOptions = { current, previous, locationId: f.locationId, animal: f.animal, sort: f.sort };
  const result = buildPrints(events, { versions, designs, breeds }, opts);

  // Versions of the top designs: their children, level by level (a few levels; cycles cannot loop)
  const top = result.rows.map(r => r.id);
  const edges: { id: string; parent: string }[] = [];
  let level = top;
  const seen = new Set(top);
  for (let depth = 0; depth < 6 && level.length; depth++) {
    const next: string[] = [];
    for (const part of chunks(level, 10)) {
      for (const r of keep(await fetchAll<{ id: string; variation_of: string }>((a, b) =>
        supabase.from('image_catalog').select('id, variation_of').in('variation_of', part).order('id').range(a, b)))) {
        edges.push({ id: r.id, parent: r.variation_of });
        if (!seen.has(r.id)) { seen.add(r.id); next.push(r.id); }
      }
    }
    level = next;
  }
  const counts = countVersions(top, edges);
  for (const r of result.rows) r.versions = counts.get(r.id) ?? 0;
  return { ...result, truncated };
}

export interface BreedsLoad extends BreedsResult { truncated: boolean }

export async function loadBreeds(supabase: SupabaseClient, f: PopularityFilters, now = Date.now()): Promise<BreedsLoad> {
  const { current, previous } = periodRanges(f.period, now);
  const since = previous?.from ?? current.from;
  const all = await fetchAll<any>((a, b) => {
    let q = supabase.from('customer_custom_images')
      .select('id, created_at, pet_breed_id, pet_coat_id, customer_email, guest_session_id, share_count, detected_breed:metadata->detected_breed')
      .neq('status', 'failed');
    if (since !== null) q = q.gte('created_at', iso(since));
    return q.order('created_at', { ascending: false }).order('id').range(a, b);
  });
  const rows = all.rows;

  // Bought: the existing rule (a paid order line whose image_id is the customisation), for this period's previews only
  const inNow = rows.filter(r => inRange(ms(r.created_at), current));
  const outcomes = await loadOutcomes(supabase, inNow.map(r => ({ id: r.id as string, share_count: r.share_count ?? 0 })));

  const records: PreviewRecord[] = rows.map((r): PreviewRecord => {
    const d = r.detected_breed;
    return {
      at: ms(r.created_at), breedId: r.pet_breed_id ?? null, coatId: r.pet_coat_id ?? null,
      person: lower(r.customer_email) || r.guest_session_id || null,
      bought: !!outcomes.get(r.id)?.purchased,
      detected: d && typeof d === 'object' ? { name: String(d.name ?? ''), matched: !!d.matched, animal: d.animal ?? null } : null,
    };
  });

  const names: PetNames = { breeds: new Map(), coats: new Map() };
  const ids = (k: 'pet_breed_id' | 'pet_coat_id') => Array.from(new Set(rows.map(r => r[k] as string | null).filter((x): x is string => !!x)));
  for (const b of await selectIn<any>(supabase, 'breeds', 'id, name, animal_type', 'id', ids('pet_breed_id'))) names.breeds.set(b.id, { name: b.name, animal: b.animal_type });
  for (const c of await selectIn<any>(supabase, 'coats', 'id, name, animal_type', 'id', ids('pet_coat_id'))) names.coats.set(c.id, { name: c.name, animal: c.animal_type });

  return { ...buildBreeds(records, names, current, previous, f.animal), truncated: all.truncated };
}

export { ROW_CAP };
