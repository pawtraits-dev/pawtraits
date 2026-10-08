import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';
import { tick } from '@/lib/variations/batch';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Vercel cron (every 2 min): submit queued Gemini batch jobs, check running ones, read results */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  // Same rule as the messaging cron: Vercel sends the secret; without one configured, allow
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const summary = await tick(serviceClient(), 240_000);
    return NextResponse.json(summary);
  } catch (e: any) {
    console.error('Variation batch cron failed:', e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
