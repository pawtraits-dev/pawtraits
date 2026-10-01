/**
 * POST /api/public/quiz-results/[code]/shared  { platform }
 * Records that a result was shared (first share time and platform), for the viral-rate KPI.
 */
import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';

const PLATFORMS = ['instagram', 'whatsapp', 'facebook', 'copy_link', 'native_share'];

export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^[a-z0-9]{8,12}$/.test(code)) return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const platform = PLATFORMS.includes(body?.platform) ? body.platform : 'native_share';
  const { error } = await serviceClient().from('quiz_results')
    .update({ shared_at: new Date().toISOString(), share_platform: platform })
    .eq('share_code', code).is('shared_at', null);
  if (error) return NextResponse.json({ error: 'Could not record share' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
