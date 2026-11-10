import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';
import { trackingConfigured } from '@/lib/shipping/royal-mail/tracking-api';
import { trackingSweep } from '@/lib/shipping/royal-mail/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Vercel cron (every 15 min): check Royal Mail tracking for posted parcels that are due a look */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!trackingConfigured()) return NextResponse.json({ skipped: 'Royal Mail tracking not connected' });
  try {
    return NextResponse.json(await trackingSweep(serviceClient(), 240_000));
  } catch (e: any) {
    console.error('Royal Mail tracking cron failed:', e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
