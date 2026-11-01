/**
 * GET /api/admin/dashboard?period=today|7d|30d — Admin home: KPIs against the previous period,
 * things that need doing, the 30-day trend, top designs, latest orders and previews, stalls.
 * See lib/admin/dashboard.ts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { loadDashboard, type Period } from '@/lib/admin/dashboard';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const p = request.nextUrl.searchParams.get('period');
  const period: Period = p === 'today' || p === '30d' ? p : '7d';
  try {
    return NextResponse.json(await loadDashboard(serviceClient(), period));
  } catch (e: any) {
    console.error('admin dashboard failed', e);
    return NextResponse.json({ error: e?.message || 'Could not load the dashboard' }, { status: 500 });
  }
}
