import { NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { quizImageTick } from '@/lib/quiz/breed-batch';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** POST /api/admin/quizzes/breed-batch/tick — "Check now": the same work the cron does every 2 min */
export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    return NextResponse.json(await quizImageTick(serviceClient(), 200_000));
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
