/**
 * POST /api/admin/social/import-previews  { days? = 30 } → { added }
 * Adds recent completed free previews (customisations not yet bought) as social items and
 * photo-checks them, up to 40 per click. Skips customer ratings of 1–2 stars and opted-out emails.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/qr/server';
import { capturePreviews } from '@/lib/social/capture';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  const days = Math.min(365, Math.max(1, Number(body.days) || 30));
  return NextResponse.json({ added: await capturePreviews({ days, limit: 40, force: true }) });
}
