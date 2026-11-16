/** POST /api/admin/offers/run: "Run now": the same pass as the cron (lib/offers/run.ts), once, within the caps. Nothing happens while offers are switched off. */
import { NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { runOffers } from '@/lib/offers/run';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST() {
  const denied = await requireAdmin(); if (denied) return denied;
  try {
    return NextResponse.json(await runOffers(serviceClient()));
  } catch (e: any) {
    console.error('offers run failed', e);
    return NextResponse.json({ error: e?.message || 'Run failed' }, { status: 500 });
  }
}
