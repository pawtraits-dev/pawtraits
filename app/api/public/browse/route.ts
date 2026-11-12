/**
 * GET /api/public/browse — paged, filtered public listing for the Browse page (no auth).
 *
 *   ?page=1&limit=24            page (>=1) and page size (1..48)
 *   &breed=<uuid>               designs of this breed (primary breed or any pet in generation_parameters.subjects)
 *   &theme=<uuid>
 *   &animal=dog|cat             same meaning as the old client matchesAnimalType()
 *   &search=<text>              description, tags (exact tag) and primary breed name
 *   &breedName=<text>           primary breed name contains text (theme view "Search Breeds")
 *   &counts=1                   also return counts: { all, dogs, cats } (public listing, no other filters)
 *   &facets=1                   instead of designs, return per-breed / per-theme counts (see BrowseFacets)
 *
 * Response: { images, total, page, limit, hasMore [, counts] }  or  { facets..., [counts] } for facets=1.
 * Public listing rule is the same as SupabaseService.getImages: is_public = true AND LISTED_ONLY.
 */
import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';
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
} from '@/lib/catalog/browse-query';

const CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' };
const FACET_CHUNK = 1000;

type Db = ReturnType<typeof serviceClient>;

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
async function listingCounts(db: Db) {
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

async function listingFacets(db: Db) {
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

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const db = serviceClient();
    const wantCounts = sp.get('counts') === '1';

    if (sp.get('facets') === '1') {
      const [facets, counts] = await Promise.all([listingFacets(db), wantCounts ? listingCounts(db) : Promise.resolve(null)]);
      return NextResponse.json(counts ? { ...facets, counts } : facets, { headers: CACHE_HEADERS });
    }

    const page = clampPage(sp.get('page'));
    const limit = clampLimit(sp.get('limit'));
    const offset = (page - 1) * limit;

    const breedParam = sp.get('breed');
    const themeParam = sp.get('theme');
    const animal: BrowseAnimal | null = parseAnimal(sp.get('animal'));
    const search = sanitiseSearch(sp.get('search'));
    const breedName = sanitiseSearch(sp.get('breedName'));

    // An id that is not a uuid can match nothing (the old client filter would match nothing too)
    if ((breedParam && !isUuid(breedParam)) || (themeParam && !isUuid(themeParam))) {
      const counts = wantCounts ? await listingCounts(db) : undefined;
      return NextResponse.json({ images: [], total: 0, page, limit, hasMore: false, ...(counts ? { counts } : {}) }, { headers: CACHE_HEADERS });
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
      return NextResponse.json({ images: [], total: 0, page, limit, hasMore: false, ...(counts ? { counts } : {}) }, { headers: CACHE_HEADERS });
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

    const { data, error, count } = await applyFilters(
      db.from('image_catalog').select(BROWSE_SELECT, { count: 'exact' }),
    )
      .order('created_at', { ascending: false })
      .order('id', { ascending: false }) // tie-break so pages never overlap
      .range(offset, offset + limit - 1);

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

    const counts = wantCounts ? await listingCounts(db) : undefined;
    const images = rowsData.map(shapeBrowseRow);
    return NextResponse.json(
      { images, total, page, limit, hasMore: offset + images.length < total, ...(counts ? { counts } : {}) },
      { headers: CACHE_HEADERS },
    );
  } catch (error) {
    console.error('Public browse API error:', error);
    return NextResponse.json({ error: 'Failed to load designs' }, { status: 500 });
  }
}
