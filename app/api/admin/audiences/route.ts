/**
 * GET /api/admin/audiences?segment=buyers|previewers|scanners&from=&to=&location=&includeBought=1&format=json|meta_csv
 *     &breed=<uuid>&coat=<uuid>&design=<uuid>&view=breed|coat|design
 * Buyers, preview emailers (not bought) and stall scanners. meta_csv gives the Meta customer list
 * (subscribed people only) for buyers and previewers.
 * For previewers and scanners, breed / coat / design narrow the rows (including the Meta list), `facets` lists the
 * options present before those three filters, and view=breed|coat|design returns breakdown rows instead of people.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import {
  applySegmentFilter, listLocations, loadBuyers, loadPreviewEmailers, loadScanners, previewerBreakdown, scannerBreakdown,
  segmentFacets, summarisePreviewers, summariseScanners, toMetaCsv, withoutSeg, type PreviewerRow, type ScannerRow, type SegmentView,
} from '@/lib/marketing/audiences';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEGMENTS = ['buyers', 'previewers', 'scanners'] as const;
type Segment = (typeof SEGMENTS)[number];
const MAX_ROWS = 500;
const VIEWS = ['breed', 'coat', 'design'] as const;

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

  const breed = sp.get('breed') || null, coat = sp.get('coat') || null, design = sp.get('design') || null;
  if ((breed && !UUID_RE.test(breed)) || (coat && !UUID_RE.test(coat)) || (design && !UUID_RE.test(design))) {
    return NextResponse.json({ error: 'breed, coat and design must be ids' }, { status: 400 });
  }
  const segment_ = { breed, coat, design };
  const viewParam = sp.get('view');
  if (viewParam && !VIEWS.includes(viewParam as SegmentView)) return NextResponse.json({ error: 'view must be breed, coat or design' }, { status: 400 });
  const view = (viewParam as SegmentView | null) || null;

  try {
    const supabase = serviceClient();

    if (format === 'meta_csv') {
      const csv = segment === 'buyers'
        ? toMetaCsv((await loadBuyers(supabase, filters)).rows)
        : toMetaCsv(applySegmentFilter((await loadPreviewEmailers(supabase, filters)).rows, segment_).map(r => ({ email: r.email, marketing: r.marketing })));
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="pawtraits-${segment}-${new Date().toISOString().slice(0, 10)}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const headers = { 'Cache-Control': 'no-store' };

    if (segment === 'buyers') {
      const [result, locations] = await Promise.all([loadBuyers(supabase, filters), listLocations(supabase)]);
      return NextResponse.json(
        { summary: result.summary, rows: result.rows.slice(0, MAX_ROWS), total: result.rows.length, truncated: result.truncated, locations },
        { headers },
      );
    }

    const [result, locations] = await Promise.all([
      segment === 'previewers' ? loadPreviewEmailers(supabase, filters) : loadScanners(supabase, filters),
      listLocations(supabase),
    ]);
    // Options come from the rows before the breed / coat / design filters, so the dropdowns never empty themselves
    const facets = segmentFacets<PreviewerRow | ScannerRow>(result.rows, result.names);
    const matching = applySegmentFilter<PreviewerRow | ScannerRow>(result.rows, segment_);
    const summary = segment === 'previewers'
      ? summarisePreviewers(matching as PreviewerRow[], result.truncated)
      : summariseScanners(matching as ScannerRow[], result.truncated);

    if (view) {
      // Breakdown rows: buyers are kept in the input so the Bought column can count them whatever the toggle says
      const base = applySegmentFilter<PreviewerRow | ScannerRow>(result.allRows, segment_);
      const rows = segment === 'previewers'
        ? previewerBreakdown(base as PreviewerRow[], view, filters.includeBought, result.names)
        : scannerBreakdown(base as ScannerRow[], view, filters.includeBought, result.names);
      return NextResponse.json({ view, summary, rows, total: rows.length, truncated: result.truncated, locations, facets }, { headers });
    }
    return NextResponse.json(
      { summary, rows: withoutSeg(matching.slice(0, MAX_ROWS)), total: matching.length, truncated: result.truncated, locations, facets },
      { headers },
    );
  } catch (e: any) {
    // Never log addresses: the message is from the database client only
    console.error('Admin audiences failed:', segment, e?.message);
    return NextResponse.json({ error: 'Could not load this audience' }, { status: 500 });
  }
}
