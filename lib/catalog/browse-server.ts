/**
 * Server side of the Browse listing: one source of truth for both the public API route
 * (GET /api/public/browse) and the server-rendered Browse page, so a URL gives the same designs
 * whichever way they are loaded. Nothing here depends on who is asking (no cookies, no user).
 * Pass a service-role client (`serviceClient()` from lib/qr/server).
 *
 * Public listing rule is the same as SupabaseService.getImages: is_public = true AND LISTED_ONLY.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { LISTED_ONLY } from '@/lib/catalog/listing';
import {
  BROWSE_SELECT,
  animalOrFilter,
  breedOrFilter,
  buildFacets,
  clampLimit,
  clampPage,
  isUuid,
  parseAnimal,
  sanitiseSearch,
  searchOrFilter,
  shapeBrowseRow,
  type BrowseAnimal,
  type BrowseFacets,
} from '@/lib/catalog/browse-query';

const FACET_CHUNK = 1000;

type Db = SupabaseClient;

export type BrowseCountsResult = { all: number; dogs: number; cats: number };

export interface BrowsePageResult {
  images: any[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  counts?: BrowseCountsResult;
}

/** Raw (unvalidated) query values, as read from a URL */
export interface BrowseRawParams {
  page?: unknown;
  limit?: unknown;
  breed?: string | null;
  theme?: string | null;
  animal?: string | null;
  search?: string | null;
  breedName?: string | null;
}

async function catBreedIds(db: Db): Promise<string[]> {
  const { data, error } = await db.from('breeds').select('id').eq('animal_type', 'cat');
  if (error) throw error;
  return (data ?? []).map((b: any) => b.id);
}

async function breedIdsMatchingName(db: Db, term: string): Promise<string[]> {
  const { data, error } = await db.from('breeds').select('id').ilike('name', `%${term}%`).limit(100);
  if (error) throw error;
  return (data ?? []).map((b: any) => b.id);
}

/** Exact public-listing counts, ignoring all other filters */
export async function listingCounts(db: Db): Promise<BrowseCountsResult> {
  const cats = await catBreedIds(db);
  const base = () => db.from('image_catalog').select('id', { count: 'exact', head: true }).eq('is_public', true).or(LISTED_ONLY);
  const [all, dogs, catsRes] = await Promise.all([
    base(),
    base().or(animalOrFilter('dog', cats)),
    base().or(animalOrFilter('cat', cats)),
  ]);
  for (const r of [all, dogs, catsRes]) if (r.error) throw r.error;
  return { all: all.count ?? 0, dogs: dogs.count ?? 0, cats: catsRes.count ?? 0 };
}

export async function listingFacets(db: Db): Promise<BrowseFacets> {
  const { data: breeds, error: bErr } = await db.from('breeds').select('id, animal_type');
  if (bErr) throw bErr;
  const breedTypes: Record<string, string> = {};
  for (const b of breeds ?? []) breedTypes[b.id] = b.animal_type;

  const rows: any[] = [];
  for (let from = 0; ; from += FACET_CHUNK) {
    const { data, error } = await db
      .from('image_catalog')
      .select('id, breed_id, theme_id, format_id, subjects:generation_parameters->subjects')
      .eq('is_public', true)
      .or(LISTED_ONLY)
      .order('id', { ascending: true })
      .range(from, from + FACET_CHUNK - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < FACET_CHUNK) break;
  }
  return buildFacets(rows, breedTypes);
}

/** The facets response body: facets plus (optionally) the tab counts */
export async function loadBrowseFacets(db: Db, wantCounts: boolean) {
  const [facets, counts] = await Promise.all([listingFacets(db), wantCounts ? listingCounts(db) : Promise.resolve(null)]);
  return counts ? { ...facets, counts } : facets;
}

/**
 * One page of the filtered public listing: exactly the body GET /api/public/browse returns for
 * the same parameters.
 */
export async function loadBrowsePage(db: Db, raw: BrowseRawParams, wantCounts: boolean): Promise<BrowsePageResult> {
  const page = clampPage(raw.page);
  const limit = clampLimit(raw.limit);
  const offset = (page - 1) * limit;

  const breedParam = raw.breed ?? null;
  const themeParam = raw.theme ?? null;
  const animal: BrowseAnimal | null = parseAnimal(raw.animal);
  const search = sanitiseSearch(raw.search);
  const breedName = sanitiseSearch(raw.breedName);

  // An id that is not a uuid can match nothing (the old client filter would match nothing too)
  if ((breedParam && !isUuid(breedParam)) || (themeParam && !isUuid(themeParam))) {
    const counts = wantCounts ? await listingCounts(db) : undefined;
    return { images: [], total: 0, page, limit, hasMore: false, ...(counts ? { counts } : {}) };
  }

  // Look-ups needed to express the filters (small tables)
  const [cats, searchBreedIds, nameBreedIds] = await Promise.all([
    animal ? catBreedIds(db) : Promise.resolve([] as string[]),
    search ? breedIdsMatchingName(db, search) : Promise.resolve([] as string[]),
    breedName ? breedIdsMatchingName(db, breedName) : Promise.resolve([] as string[]),
  ]);

  // A breed-name search that matches no breed matches no design
  if (breedName && nameBreedIds.length === 0) {
    const counts = wantCounts ? await listingCounts(db) : undefined;
    return { images: [], total: 0, page, limit, hasMore: false, ...(counts ? { counts } : {}) };
  }

  const applyFilters = (q: any) => {
    q = q.eq('is_public', true).or(LISTED_ONLY);
    if (breedParam) q = q.or(breedOrFilter(breedParam)!);
    if (themeParam) q = q.eq('theme_id', themeParam);
    if (animal) q = q.or(animalOrFilter(animal, cats));
    const s = searchOrFilter(search, searchBreedIds);
    if (s) q = q.or(s);
    if (breedName) q = q.in('breed_id', nameBreedIds);
    return q;
  };

  // The tab counts do not depend on the page query, so they are fetched alongside it
  const [{ data, error, count }, counts] = await Promise.all([
    applyFilters(db.from('image_catalog').select(BROWSE_SELECT, { count: 'exact' }))
      .order('created_at', { ascending: false })
      .order('id', { ascending: false }) // tie-break so pages never overlap
      .range(offset, offset + limit - 1) as Promise<{ data: any[] | null; error: any; count: number | null }>,
    wantCounts ? listingCounts(db) : Promise.resolve(undefined),
  ]);

  let rowsData: any[] = data ?? [];
  let total = count ?? 0;

  if (error) {
    // Paging past the end is a 416 from PostgREST: answer with an empty page and the real total
    if ((error as any).code === 'PGRST103') {
      const head = await applyFilters(db.from('image_catalog').select('id', { count: 'exact', head: true }));
      if (head.error) throw head.error;
      rowsData = [];
      total = head.count ?? 0;
    } else {
      throw error;
    }
  }

  const images = rowsData.map(shapeBrowseRow);
  return { images, total, page, limit, hasMore: offset + images.length < total, ...(counts ? { counts } : {}) };
}

/**
 * The breed / theme records the page heading needs when the URL selects one (same columns as
 * /api/public/breeds and /api/public/themes). null when not selected, not a uuid, or not found.
 */
export async function loadBrowseHeading(db: Db, ids: { breed?: string; theme?: string }) {
  const [breed, theme] = await Promise.all([
    ids.breed && isUuid(ids.breed) ? db.from('breeds').select('*').eq('id', ids.breed).maybeSingle() : Promise.resolve(null),
    ids.theme && isUuid(ids.theme) ? db.from('themes').select('*').eq('id', ids.theme).maybeSingle() : Promise.resolve(null),
  ]);
  if (breed?.error) throw breed.error;
  if (theme?.error) throw theme.error;
  return { breed: (breed?.data ?? null) as any, theme: (theme?.data ?? null) as any };
}
