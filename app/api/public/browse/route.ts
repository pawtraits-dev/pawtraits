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
import { loadBrowseFacets, loadBrowsePage } from '@/lib/catalog/browse-server';

const CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' };

// The queries live in lib/catalog/browse-server.ts, shared with the server-rendered /browse page
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const db = serviceClient();
    const wantCounts = sp.get('counts') === '1';

    if (sp.get('facets') === '1') {
      return NextResponse.json(await loadBrowseFacets(db, wantCounts), { headers: CACHE_HEADERS });
    }

    const body = await loadBrowsePage(
      db,
      {
        page: sp.get('page'),
        limit: sp.get('limit'),
        breed: sp.get('breed'),
        theme: sp.get('theme'),
        animal: sp.get('animal'),
        search: sp.get('search'),
        breedName: sp.get('breedName'),
      },
      wantCounts,
    );
    return NextResponse.json(body, { headers: CACHE_HEADERS });
  } catch (error) {
    console.error('Public browse API error:', error);
    return NextResponse.json({ error: 'Failed to load designs' }, { status: 500 });
  }
}
