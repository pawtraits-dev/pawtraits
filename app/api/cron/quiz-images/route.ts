import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';
import { quizImageTick } from '@/lib/quiz/breed-batch';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Vercel cron (every 2 min): breed versions of quiz pictures (submit, check, store results) */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json(await quizImageTick(serviceClient(), 240_000));
  } catch (e: any) {
    console.error('Quiz image cron failed:', e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
