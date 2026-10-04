/**
 * GET /api/public/collection?path=sports/nfl&animal=dog|cat&breed=<slug>&pets=1|2&page=
 * One collection page: the collection, breadcrumb, collections inside it, neighbours,
 * the breeds that appear in it, and a page of designs (most popular first).
 */
import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';
import { cleanPath, loadCollectionPage } from '@/lib/collections/public';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const path = cleanPath(sp.get('path'));
  if (!path) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const data = await loadCollectionPage(serviceClient(), path, {
      animal: sp.get('animal'), breedSlug: sp.get('breed')?.slice(0, 80) ?? null, page: Math.min(100, Number(sp.get('page')) || 0),
      pets: sp.get('pets') === '1' ? 1 : sp.get('pets') === '2' ? 2 : null,
    });
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(data, { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' } });
  } catch (e) {
    console.error('public collection failed', e);
    return NextResponse.json({ error: 'This collection is unavailable just now' }, { status: 500 });
  }
}
