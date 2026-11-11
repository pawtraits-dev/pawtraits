/**
 * GET /api/public/phone-cases             designs available as phone cases, the phone models and camera layouts
 * GET /api/public/phone-cases?design=<id> one design (404 if it isn't available as a case)
 */
import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';
import { phoneCaseCatalogue } from '@/lib/phone-cases/public';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const design = req.nextUrl.searchParams.get('design');
  if (design && !UUID.test(design)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const data = await phoneCaseCatalogue(serviceClient(), design || undefined);
    if (design && !data.designs.length) return NextResponse.json({ error: 'This design isn’t available as a phone case' }, { status: 404 });
    return NextResponse.json(data, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch (e: any) {
    console.error('phone cases catalogue failed', e);
    return NextResponse.json({ error: 'Could not load phone cases' }, { status: 500 });
  }
}
