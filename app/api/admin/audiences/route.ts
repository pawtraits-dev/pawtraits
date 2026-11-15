/**
 * GET /api/admin/audiences?segment=buyers|previewers|scanners&from=&to=&location=&includeBought=1&format=json|meta_csv
 * Buyers, preview emailers (not bought) and stall scanners. meta_csv gives the Meta customer list
 * (subscribed people only) for buyers and previewers.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { listLocations, loadBuyers, loadPreviewEmailers, loadScanners, toMetaCsv } from '@/lib/marketing/audiences';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEGMENTS = ['buyers', 'previewers', 'scanners'] as const;
type Segment = (typeof SEGMENTS)[number];
const MAX_ROWS = 500;

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(); if (denied) return denied;

  const sp = request.nextUrl.searchParams;
  const segment = sp.get('segment') as Segment;
  if (!SEGMENTS.includes(segment)) return NextResponse.json({ error: 'segment must be buyers, previewers or scanners' }, { status: 400 });
  const format = sp.get('format') || 'json';
  if (format !== 'json' && format !== 'meta_csv') return NextResponse.json({ error: 'format must be json or meta_csv' }, { status: 400 });
  if (format === 'meta_csv' && segment === 'scanners') return NextResponse.json({ error: 'Scanners are anonymous and cannot be downloaded' }, { status: 400 });

  const from = sp.get('from') || null, to = sp.get('to') || null, location = sp.get('location') || null;
  if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) return NextResponse.json({ error: 'Dates must be YYYY-MM-DD' }, { status: 400 });
  if (location && !UUID_RE.test(location)) return NextResponse.json({ error: 'Unknown stall' }, { status: 400 });
  const filters = { from, to, locationId: location, includeBought: sp.get('includeBought') === '1' };

  try {
    const supabase = serviceClient();

    if (format === 'meta_csv') {
      const csv = segment === 'buyers'
        ? toMetaCsv((await loadBuyers(supabase, filters)).rows)
        : toMetaCsv((await loadPreviewEmailers(supabase, filters)).rows.map(r => ({ email: r.email, marketing: r.marketing })));
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="pawtraits-${segment}-${new Date().toISOString().slice(0, 10)}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const [result, locations] = await Promise.all([
      segment === 'buyers' ? loadBuyers(supabase, filters) : segment === 'previewers' ? loadPreviewEmailers(supabase, filters) : loadScanners(supabase, filters),
      listLocations(supabase),
    ]);
    return NextResponse.json(
      { summary: result.summary, rows: result.rows.slice(0, MAX_ROWS), total: result.rows.length, truncated: result.truncated, locations },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e: any) {
    // Never log addresses: the message is from the database client only
    console.error('Admin audiences failed:', segment, e?.message);
    return NextResponse.json({ error: 'Could not load this audience' }, { status: 500 });
  }
}
