/**
 * Offers: which designs to paint a person's pet into (server only; the ranking is pure).
 *
 * pickOfferDesigns() is THE one place that decides, so it can be replaced. TODAY's strategy:
 *   1. ORIGINAL designs ranked by prints sold (paid orders) to people whose pet had the same breed as this person's preview;
 *   2. then overall best sellers;
 *   3. then the most previewed designs, when sales are thin.
 * Left out: designs this person has already previewed or been offered (compared by original, so a breed version of a design
 * they saw counts as seen), framed cards, caption plates, designs with words or a personalised kit, several-pet and
 * wraparound (mug) designs, designs that are not public or are link-only, and designs for the other animal when the animal is known.
 * For a campaign the pool is the campaign's own designs instead, with the same exclusions and the same ranking, then the campaign's order.
 *
 * LATER (the owner's intent): choose by the style and setting of the print they picked (its theme and style), so that someone who chose
 * a regal portrait is shown regal ones. To do that, replace rankDesigns() or pickOfferDesigns(): nothing else needs to change.
 *
 * Which catalogue row is painted: exactly the row picked, as the customise page does (it posts the chosen design's id to
 * /api/customers/custom-images/generate and paints into that row; it never switches to a breed version). Offers pick ORIGINAL rows.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { isListed } from '@/lib/catalog/listing';
import { isOriginalRow } from '@/lib/catalog/originals';
import { readFrameOverlay } from '@/lib/frames/frame';
import { readCaptionOverlay } from '@/lib/captions/caption';
import { readWords } from '@/lib/picture-words';
import { readKit } from '@/lib/collections/kit-lettering';
import { designTitle } from '@/lib/marketing/audiences';
import { OFFER_PICTURES } from './settings';

export type Animal = 'dog' | 'cat';

/** One catalogue row, reduced to what the choice needs (see loadDesigns for where each comes from) */
export interface DesignRow {
  id: string;
  variationOf: string | null;
  isOriginal: boolean;
  title: string;
  animal: Animal | null;       // the animal the design shows (its breed's), when known
  isPublic: boolean;
  listed: boolean;             // not link-only
  framed: boolean;
  caption: boolean;            // has the caption plate (type / sign + tagline)
  words: boolean;              // has words on the picture
  kit: boolean;                // personalised football kit
  multiPet: boolean;
  wraparound: boolean;         // 2:1, a mug design
  hasPicture: boolean;
  customerMade: boolean;
}

/** A paid print line: the design bought, and the breed of the buyer's pet when the line came from a customised portrait */
export interface SaleLine { designId: string; breedId: string | null; qty: number }
export interface PreviewCount { designId: string; count: number }

export interface Dataset { designs: DesignRow[]; sales: SaleLine[]; previews: PreviewCount[] }

export interface RankInput extends Dataset {
  petBreedId: string | null;
  petBreedName?: string | null;
  petAnimal: Animal | null;
  /** catalogue ids already previewed or offered to this person (any version: matched by original) */
  excludeDesignIds: string[];
  /** a campaign: draw only from these catalogue rows */
  campaignDesignIds?: string[] | null;
}

export interface Pick { id: string; reason: string; /** the sign's framed zodiac card (the one framed design an offer may hold) */ card?: boolean }

/** The original a design comes from (itself when it is one, or when the chain is broken) */
export function rootOf(id: string, byId: Map<string, DesignRow>): string {
  let cur = id;
  for (let i = 0; i < 10; i++) {
    const row = byId.get(cur);
    if (!row?.variationOf || !byId.has(row.variationOf)) return cur;
    cur = row.variationOf;
  }
  return cur;
}

/** Is this a design we would paint a pet into for an offer (before looking at the person)? */
export function plainPortrait(d: DesignRow): boolean {
  return d.isPublic && d.listed && d.hasPicture && !d.customerMade && !d.framed && !d.caption && !d.words && !d.kit && !d.multiPet && !d.wraparound;
}

/** All eligible designs for this person, best first (the caller takes the first few; "paint a different one" takes the next) */
export function rankDesigns(input: RankInput): Pick[] {
  const byId = new Map(input.designs.map(d => [d.id, d] as const));
  const root = (id: string) => rootOf(id, byId);
  const seen = new Set(input.excludeDesignIds.map(root));
  const campaign = input.campaignDesignIds ?? null;

  // The pool: every original (standard), or the campaign's chosen rows (which may be versions)
  const pool: DesignRow[] = campaign
    ? campaign.map(id => byId.get(id)).filter((d): d is DesignRow => !!d)
    : input.designs.filter(d => d.isOriginal);
  const seenRoots = new Set<string>();
  const candidates = pool.filter(d => {
    if (!plainPortrait(d)) return false;
    if (input.petAnimal && d.animal && d.animal !== input.petAnimal) return false;
    const r = root(d.id);
    if (seen.has(r) || seenRoots.has(r)) return false;
    seenRoots.add(r);
    return true;
  });

  // Sales and previews are credited to the original
  const breedSales = new Map<string, number>(), allSales = new Map<string, number>(), previews = new Map<string, number>();
  const add = (m: Map<string, number>, k: string, n: number) => m.set(k, (m.get(k) ?? 0) + n);
  for (const s of input.sales) {
    if (!byId.has(s.designId)) continue;
    const r = root(s.designId);
    add(allSales, r, s.qty);
    if (input.petBreedId && s.breedId === input.petBreedId) add(breedSales, r, s.qty);
  }
  for (const p of input.previews) if (byId.has(p.designId)) add(previews, root(p.designId), p.count);

  const out: Pick[] = [];
  const taken = new Set<string>();
  const tier = (score: (d: DesignRow) => number, reason: (n: number) => string) => {
    candidates
      .filter(d => !taken.has(d.id) && score(d) > 0)
      .sort((a, b) => score(b) - score(a) || (allSales.get(root(b.id)) ?? 0) - (allSales.get(root(a.id)) ?? 0) || a.id.localeCompare(b.id))
      .forEach(d => { taken.add(d.id); out.push({ id: d.id, reason: reason(score(d)) }); });
  };
  const breedWords = input.petBreedName ? `${input.petBreedName} owners` : 'owners of the same breed';
  tier(d => breedSales.get(root(d.id)) ?? 0, n => `Best seller among ${breedWords} (${n} sold)`);
  tier(d => allSales.get(root(d.id)) ?? 0, n => `Best seller overall (${n} sold)`);
  tier(d => previews.get(root(d.id)) ?? 0, n => `Popular to preview (${n} previews)`);
  if (campaign) candidates.filter(d => !taken.has(d.id)).forEach(d => { taken.add(d.id); out.push({ id: d.id, reason: 'Chosen for this campaign' }); });
  return out;
}

// ---------------------------------------------------------------------------------------------
// Birthday and zodiac campaigns (pure)

/**
 * Is this design the kind of framed zodiac card we may paint? It must be a design in the sign's collection (the caller passes the ids), shown
 * publicly, a plain single-pet picture (no caption plate, words, kit or mug shape). The zodiac card is the ONE framed design an offer may contain.
 */
export function cardCandidate(d: DesignRow): boolean {
  return d.isPublic && d.listed && d.hasPicture && !d.customerMade && !d.caption && !d.words && !d.kit && !d.multiPet && !d.wraparound;
}

/**
 * That sign's card for the pet's animal: from the sign's collection, the design that shows that animal (a design with no known animal if there is no
 * other, never the other animal), one the person has not seen, framed ones first, then the best seller. Null when there is none.
 */
export function pickZodiacCard(input: { designs: DesignRow[]; sales: SaleLine[]; signDesignIds: string[]; animal: Animal; excludeDesignIds: string[] }): Pick | null {
  const byId = new Map(input.designs.map(d => [d.id, d] as const));
  const seen = new Set(input.excludeDesignIds.map(id => rootOf(id, byId)));
  const sold = new Map<string, number>();
  for (const s of input.sales) if (byId.has(s.designId)) { const r = rootOf(s.designId, byId); sold.set(r, (sold.get(r) ?? 0) + s.qty); }
  const pool = input.signDesignIds.map(id => byId.get(id)).filter((d): d is DesignRow => !!d && cardCandidate(d) && !seen.has(rootOf(d.id, byId)))
    .filter(d => d.animal === input.animal || d.animal === null);
  pool.sort((a, b) =>
    Number(b.animal === input.animal) - Number(a.animal === input.animal) || Number(b.framed) - Number(a.framed) || Number(b.isOriginal) - Number(a.isOriginal)
    || (sold.get(rootOf(b.id, byId)) ?? 0) - (sold.get(rootOf(a.id, byId)) ?? 0) || a.id.localeCompare(b.id));
  const card = pool[0];
  return card ? { id: card.id, reason: 'Their star sign, as a framed card', card: true } : null;
}

/** Zodiac offer: the sign's framed card first, then the standard best-seller choice (which never includes a framed design). Empty when there is no card. */
export function zodiacOfferPicks(input: RankInput & { signDesignIds: string[]; animal: Animal; count?: number }): Pick[] {
  const card = pickZodiacCard({ designs: input.designs, sales: input.sales, signDesignIds: input.signDesignIds, animal: input.animal, excludeDesignIds: input.excludeDesignIds });
  if (!card) return [];
  const byId = new Map(input.designs.map(d => [d.id, d] as const));
  const cardRoot = rootOf(card.id, byId);
  const rest = rankDesigns({ ...input, petAnimal: input.animal, campaignDesignIds: null, excludeDesignIds: [...input.excludeDesignIds, card.id] })
    .filter(p => !byId.get(p.id)?.framed && rootOf(p.id, byId) !== cardRoot);
  return [card, ...rest].slice(0, input.count ?? OFFER_PICTURES);
}

/** How many designs of a set could go in an offer for a pet of this animal (the birthday campaign needs at least 2) */
export function suitableCount(designs: DesignRow[], ids: string[], animal: Animal | null): number {
  const byId = new Map(designs.map(d => [d.id, d] as const));
  const roots = new Set<string>();
  for (const id of ids) { const d = byId.get(id); if (d && plainPortrait(d) && (!animal || !d.animal || d.animal === animal)) roots.add(rootOf(id, byId)); }
  return roots.size;
}
export const MIN_BIRTHDAY_DESIGNS = 2;

// ---------------------------------------------------------------------------------------------
// Database side

const PAGE = 1000;
async function fetchPages<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, max = 100_000): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < max; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}
const chunks = <T,>(xs: T[], n = 150): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
const NOT_A_SALE = new Set(['cancelled', 'canceled', 'refunded', 'failed']);

const aspectOf = (f: any) => (Array.isArray(f) ? f[0] : f)?.aspect_ratio as string | undefined;
const animalOf = (b: any): Animal | null => { const a = (Array.isArray(b) ? b[0] : b)?.animal_type; return a === 'dog' || a === 'cat' ? a : null; };

/** Every catalogue design reduced to a DesignRow (paged; the catalogue is a few thousand rows) */
export async function loadDesigns(supabase: SupabaseClient, onlyIds?: string[]): Promise<DesignRow[]> {
  const cols = 'id, description, variation_of, tags, cloudinary_public_id, is_public, is_customer_generated, is_multi_subject, subjects, frame_overlay, caption_overlay, text_overlay, kit_personalisation, breeds(animal_type), formats(aspect_ratio)';
  let rows: any[];
  if (onlyIds) {
    rows = [];
    for (const c of chunks(Array.from(new Set(onlyIds)))) {
      const { data, error } = await supabase.from('image_catalog').select(cols).in('id', c);
      if (error) throw new Error(error.message);
      rows.push(...((data ?? []) as any[]));
    }
  } else {
    rows = await fetchPages<any>((a, b) => supabase.from('image_catalog').select(cols).order('id').range(a, b));
  }
  return rows.map(r => {
    const ratio = aspectOf(r.formats);
    const [w, h] = (ratio ?? '').split(':').map(Number);
    return {
      id: r.id, variationOf: r.variation_of ?? null, isOriginal: isOriginalRow(r), title: designTitle(r.description),
      animal: animalOf(r.breeds), isPublic: r.is_public !== false, listed: isListed(r),
      framed: !!readFrameOverlay(r.frame_overlay)?.applied, caption: !!readCaptionOverlay(r.caption_overlay)?.applied,
      words: !!readWords(r.text_overlay)?.clean_public_id, kit: !!readKit(r.kit_personalisation),
      multiPet: r.is_multi_subject === true || (Array.isArray(r.subjects) && r.subjects.length > 1),
      wraparound: ratio === '2:1' || (w > 0 && h > 0 && w / h >= 1.9), hasPicture: !!r.cloudinary_public_id, customerMade: r.is_customer_generated === true,
    } as DesignRow;
  });
}

/** Paid print lines (paid order, not cancelled or refunded), with the breed of the buyer's pet for customised portraits */
export async function loadSales(supabase: SupabaseClient, designIds: Set<string>): Promise<SaleLine[]> {
  const orders = await fetchPages<any>((a, b) => supabase.from('orders').select('id, status').eq('payment_status', 'paid').order('id').range(a, b));
  const orderIds = orders.filter(o => !NOT_A_SALE.has(String(o.status || '').toLowerCase())).map(o => o.id as string);
  const lines: { image_id: string; quantity: number }[] = [];
  for (const chunk of chunks(orderIds, 200)) {
    const { data, error } = await supabase.from('order_items').select('image_id, quantity').in('order_id', chunk);
    if (error) throw new Error(error.message);
    lines.push(...((data ?? []) as any[]));
  }
  // image_id is a catalogue design or a customer's own portrait (customer_custom_images)
  const customIds = Array.from(new Set(lines.map(l => l.image_id).filter(id => !designIds.has(id) && /^[0-9a-f-]{36}$/i.test(id))));
  const custom = new Map<string, { designId: string | null; breedId: string | null }>();
  for (const chunk of chunks(customIds)) {
    const { data, error } = await supabase.from('customer_custom_images').select('id, catalog_image_id, pet_breed_id').in('id', chunk);
    if (error) throw new Error(error.message);
    for (const c of (data ?? []) as any[]) custom.set(c.id, { designId: c.catalog_image_id ?? null, breedId: c.pet_breed_id ?? null });
  }
  const out: SaleLine[] = [];
  for (const l of lines) {
    const qty = Number(l.quantity) || 1;
    if (designIds.has(l.image_id)) out.push({ designId: l.image_id, breedId: null, qty });
    else { const c = custom.get(l.image_id); if (c?.designId) out.push({ designId: c.designId, breedId: c.breedId, qty }); }
  }
  return out;
}

/** How often each design was previewed in the last 90 days (offer pictures not counted) */
export async function loadPreviewCounts(supabase: SupabaseClient, now = Date.now()): Promise<PreviewCount[]> {
  const since = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();
  const rows = await fetchPages<any>((a, b) => supabase.from('customer_custom_images').select('catalog_image_id')
    .is('metadata->offer', null).gte('created_at', since).order('created_at').range(a, b), 30_000);
  const m = new Map<string, number>();
  for (const r of rows) if (r.catalog_image_id) m.set(r.catalog_image_id, (m.get(r.catalog_image_id) ?? 0) + 1);
  return Array.from(m, ([designId, count]) => ({ designId, count }));
}

export async function loadDataset(supabase: SupabaseClient, now = Date.now()): Promise<Dataset> {
  const designs = await loadDesigns(supabase);
  const ids = new Set(designs.map(d => d.id));
  const [sales, previews] = await Promise.all([loadSales(supabase, ids), loadPreviewCounts(supabase, now)]);
  return { designs, sales, previews };
}

/** The catalogue rows a campaign draws from: its chosen designs plus the designs in its collection (and the collections under it) */
export async function campaignDesignIds(supabase: SupabaseClient, c: { design_ids: string[] | null; collection_path: string | null }): Promise<string[]> {
  const ids: string[] = [...(c.design_ids ?? [])];
  const path = (c.collection_path ?? '').trim().replace(/^\/+|\/+$/g, '');
  if (path) {
    const { data: cols } = await supabase.from('collections').select('id, path').or(`path.eq.${path},path.like.${path}/%`);
    const colIds = ((cols ?? []) as any[]).map(x => x.id);
    for (const chunk of chunks(colIds)) {
      const { data } = await supabase.from('design_collections').select('image_id').in('collection_id', chunk).eq('excluded', false);
      for (const r of (data ?? []) as any[]) ids.push(r.image_id);
    }
  }
  return Array.from(new Set(ids));
}

export interface PickContext {
  supabase: SupabaseClient;
  dataset: Dataset;
  petBreedId: string | null;
  petBreedName?: string | null;
  petAnimal: Animal | null;
  excludeDesignIds: string[];
  campaign?: { design_ids: string[] | null; collection_path: string | null } | null;
  /** zodiac: this sign's card goes first (its collection's design ids are looked up by the caller) */
  zodiac?: { signDesignIds: string[]; animal: Animal } | null;
  /** how many (default 3) */
  count?: number;
}

/** THE replaceable choice: up to `count` designs, each with the reason it was chosen */
export async function pickOfferDesigns(ctx: PickContext): Promise<Pick[]> {
  if (ctx.zodiac) {
    return zodiacOfferPicks({
      ...ctx.dataset, petBreedId: ctx.petBreedId, petBreedName: ctx.petBreedName, petAnimal: ctx.zodiac.animal, excludeDesignIds: ctx.excludeDesignIds,
      signDesignIds: ctx.zodiac.signDesignIds, animal: ctx.zodiac.animal, count: ctx.count,
    });
  }
  const campaignDesignIdsList = ctx.campaign ? await campaignDesignIds(ctx.supabase, ctx.campaign) : null;
  return rankDesigns({
    ...ctx.dataset, petBreedId: ctx.petBreedId, petBreedName: ctx.petBreedName, petAnimal: ctx.petAnimal,
    excludeDesignIds: ctx.excludeDesignIds, campaignDesignIds: campaignDesignIdsList,
  }).slice(0, ctx.count ?? OFFER_PICTURES);
}
