/**
 * GET /api/public/frame-status?ids=a,b,c → { framed: { [id]: true } }
 * Which catalogue designs show a frame (framed cards are sold as prints only, so the download
 * button hides). Public, ids only; at most 60 per call.
 */
import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';
import { isFramed } from '@/lib/frames/rules';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get('ids') || '').split(',').filter(id => UUID.test(id)).slice(0, 60);
  if (!ids.length) return NextResponse.json({ framed: {} });
  const { data, error } = await serviceClient().from('image_catalog').select('id, frame_overlay').in('id', ids);
  if (error) return NextResponse.json({ framed: {} });   // before the framed-cards migration: nothing is framed
  const framed: Record<string, true> = {};
  for (const r of data ?? []) if (isFramed(r as any)) framed[(r as any).id] = true;
  return NextResponse.json({ framed }, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' } });
}
