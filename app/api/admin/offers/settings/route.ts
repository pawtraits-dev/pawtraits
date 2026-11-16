/** POST /api/admin/offers/settings { key, value }: the Offers switches and numbers (only the offers_* settings). */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/qr/server';
import { setSetting, validateSetting, type SettingKey } from '@/lib/app-settings';

export const dynamic = 'force-dynamic';
const KEYS = ['offers_enabled', 'offers_auto_send', 'offers_round1_days', 'offers_round2_days', 'offers_per_run', 'offers_per_day'];

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(); if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  const key = String(body?.key ?? '');
  if (!KEYS.includes(key)) return NextResponse.json({ error: 'Unknown setting' }, { status: 400 });
  const problem = validateSetting(key, body?.value);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  try {
    await setSetting(key as SettingKey, body.value);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('offers setting failed', e);
    return NextResponse.json({ error: e?.message || 'Could not save' }, { status: 500 });
  }
}
