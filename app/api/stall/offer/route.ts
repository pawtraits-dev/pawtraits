/** GET /api/stall/offer?imageId=&size= — is "take this print home now" available for this visitor? */
import { NextRequest, NextResponse } from 'next/server';
import { getStallOffer } from '@/lib/stall/offer';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const imageId = request.nextUrl.searchParams.get('imageId');
  if (!imageId) return NextResponse.json({ available: false, reason: 'missing_image' });
  const offer = await getStallOffer(request, imageId, request.nextUrl.searchParams.get('size'));
  const { locationId: _l, scanId: _s, ...safe } = offer;
  return NextResponse.json(safe, { headers: { 'Cache-Control': 'no-store' } });
}
