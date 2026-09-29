/**
 * Admin-controlled app settings (public.app_settings).
 * GET   → all settings with defaults filled in
 * PATCH { key, value }
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/qr/server';
import { getAllSettings, setSetting, validateSetting, SETTING_DEFAULTS, SettingKey } from '@/lib/app-settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    return NextResponse.json(await getAllSettings());
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to load settings — has the guest-checkout migration been run?' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { key, value } = await request.json();
  if (!(key in SETTING_DEFAULTS)) return NextResponse.json({ error: 'Unknown setting' }, { status: 400 });
  const invalid = validateSetting(key, value);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
  try {
    await setSetting(key as SettingKey, value);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
