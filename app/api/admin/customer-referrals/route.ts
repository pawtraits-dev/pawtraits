/**
 * GET /api/admin/customer-referrals?period=30|90|365|all&sort=network|direct|descendants|opens|credit&all=1&format=json|csv&tree=<customers.id>
 * Read only. Per customer: link opens, sales made with their code, sales made with the codes of the people they
 * referred (to any depth), and credit. Emails are masked; the full address never leaves the server.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { loadReferralReport, PERIODS, SORTS, selectRows, referralsCsv, type Period, type Sort } from '@/lib/referrals/admin-report';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad = (error: string) => NextResponse.json({ error }, { status: 400 });
const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(); if (denied) return denied;

  const sp = request.nextUrl.searchParams;
  const period = (sp.get('period') || 'all') as Period;
  if (!PERIODS.includes(period)) return bad('period must be 30, 90, 365 or all');
  const sort = (sp.get('sort') || 'network') as Sort;
  if (!SORTS.includes(sort)) return bad('sort must be network, direct, descendants, opens or credit');
  const format = sp.get('format') || 'json';
  if (format !== 'json' && format !== 'csv') return bad('format must be json or csv');
  const all = sp.get('all') === '1';
  const treeId = sp.get('tree');
  if (treeId && !UUID_RE.test(treeId)) return bad('tree must be a customer id');

  try {
    const { report, truncated } = await loadReferralReport(serviceClient(), { period });

    if (treeId) {
      const key = report.keyById.get(treeId);
      const result = key ? report.tree(key) : null;
      if (!result) return NextResponse.json({ error: 'Customer not found' }, { status: 404, headers: NO_STORE });
      return NextResponse.json({ period, ...result, sourceTruncated: truncated }, { headers: NO_STORE });
    }

    const picked = selectRows(report.rows, sort, all);
    if (format === 'csv') {
      const stamp = new Date().toISOString().slice(0, 10);
      return new NextResponse(referralsCsv(picked.rows), { headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="pawtraits-customer-referrals-${stamp}.csv"`,
        'Cache-Control': 'no-store',
      } });
    }
    return NextResponse.json({
      period, sort, rows: picked.rows, total: picked.total, summary: report.summary,
      truncated: picked.truncated, sourceTruncated: truncated,
    }, { headers: NO_STORE });
  } catch (e: any) {
    console.error('Admin customer referrals failed:', e?.message); // message from the database client only
    return NextResponse.json({ error: 'Could not load customer referrals' }, { status: 500, headers: NO_STORE });
  }
}
