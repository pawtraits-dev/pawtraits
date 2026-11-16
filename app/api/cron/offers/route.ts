import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';
import { runOffers } from '@/lib/offers/run';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Vercel cron (hourly): Offers (lib/offers/run.ts). Queues who is due, generates a few pictures, and sends what was approved
 * (or, with offers_auto_send, what is ready). Does nothing at all while the offers_enabled setting is off.
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json(await runOffers(serviceClient()));
  } catch (e: any) {
    console.error('Offers cron failed:', e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
