/**
 * POST /api/admin/social/retry-checks → { retried }
 * Re-runs photo checks that are waiting or errored (e.g. the AI service was down).
 */
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/qr/server';
import { retryFailedChecks } from '@/lib/social/capture';

export const maxDuration = 120;

export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json({ retried: await retryFailedChecks(20) });
}
