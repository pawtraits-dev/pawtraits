/**
 * GET /api/public/collections — every live collection with its design count (including the
 * collections inside it), picture and season state, for the home page, navigation and
 * /collections. Occasions in season come first.
 */
import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';
import { loadPublicTree, orderOccasions } from '@/lib/collections/public';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tree = await loadPublicTree(serviceClient());
    const occasions = orderOccasions(tree.filter(c => c.kind === 'occasion' && c.depth === 1));
    const rest = tree.filter(c => !(c.kind === 'occasion' && c.depth === 1));
    return NextResponse.json({ collections: [...rest.filter(c => c.depth === 0), ...occasions, ...rest.filter(c => c.depth > 0)] },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
  } catch (e) {
    console.error('public collections failed', e);
    return NextResponse.json({ error: 'Collections are unavailable just now' }, { status: 500 });
  }
}
