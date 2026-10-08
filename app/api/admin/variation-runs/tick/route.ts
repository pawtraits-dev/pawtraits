import { NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { tick } from '@/lib/variations/batch';

export const maxDuration = 300;

/** "Check now" on the batch pages: same work as the cron */
export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    return NextResponse.json(await tick(serviceClient(), 100_000));
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Check failed' }, { status: 500 });
  }
}
