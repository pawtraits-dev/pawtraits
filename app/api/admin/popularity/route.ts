/**
 * GET /api/admin/popularity?tab=prints|breeds&period=7|30|90|all&location=<uuid>&animal=dog|cat&sort=sold|scans|previews|revenue&format=json|csv
 * Prints: the most popular original designs (all breed / coat versions rolled up), top 100.
 * Breeds: breeds and coats of the pets customers upload. sort applies to prints only. CSVs hold counts only, no personal data.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import {
  breedsCsv, listStalls, loadBreeds, loadPrints, printsCsv, PERIODS, PRINT_SORTS,
  type Animal, type Period, type PrintSort,
} from '@/lib/admin/popularity';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(); if (denied) return denied;

  const sp = request.nextUrl.searchParams;
  const tab = sp.get('tab') || 'prints';
  if (tab !== 'prints' && tab !== 'breeds') return bad('tab must be prints or breeds');
  const period = (sp.get('period') || '30') as Period;
  if (!PERIODS.includes(period)) return bad('period must be 7, 30, 90 or all');
  const location = sp.get('location') || null;
  if (location && !UUID_RE.test(location)) return bad('Unknown stall');
  const animal = (sp.get('animal') || null) as Animal | null;
  if (animal && animal !== 'dog' && animal !== 'cat') return bad('animal must be dog or cat');
  const sort = (sp.get('sort') || 'sold') as PrintSort;
  if (!PRINT_SORTS.includes(sort)) return bad('sort must be sold, scans, previews or revenue');
  const format = sp.get('format') || 'json';
  if (format !== 'json' && format !== 'csv') return bad('format must be json or csv');

  const filters = { period, locationId: location, animal, sort };
  try {
    const supabase = serviceClient();
    const stamp = new Date().toISOString().slice(0, 10);

    if (tab === 'prints') {
      const [result, stalls] = await Promise.all([loadPrints(supabase, filters), format === 'json' ? listStalls(supabase) : Promise.resolve([])]);
      if (format === 'csv') {
        return new NextResponse(printsCsv(result.rows), { headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="pawtraits-popular-prints-${period}-${stamp}.csv"`,
          'Cache-Control': 'no-store',
        } });
      }
      return NextResponse.json({ tab, period, ...result, stalls }, { headers: { 'Cache-Control': 'no-store' } });
    }

    // Breeds come from the customers' pets, so a stall cannot narrow them (previews have no stall)
    const [result, stalls] = await Promise.all([loadBreeds(supabase, filters), format === 'json' ? listStalls(supabase) : Promise.resolve([])]);
    if (format === 'csv') {
      return new NextResponse(breedsCsv(result), { headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="pawtraits-popular-breeds-${period}-${stamp}.csv"`,
        'Cache-Control': 'no-store',
      } });
    }
    return NextResponse.json({ tab, period, ...result, stalls }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    console.error('Admin popularity failed:', tab, e?.message); // message from the database client only
    return NextResponse.json({ error: 'Could not load popularity' }, { status: 500 });
  }
}
