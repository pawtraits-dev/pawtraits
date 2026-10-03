/**
 * POST /api/admin/collections/auto-tag { limit?, retry_failed? } — tags the next batch of untagged catalogue
 * designs (Admin → Collections → Tagging, "Tag the catalogue"). The page calls it repeatedly
 * until `remaining` is 0.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { requeueFailed, tagUntagged } from '@/lib/collections/auto-tag';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  try {
    if (body.retry_failed) await requeueFailed(serviceClient());
    return NextResponse.json(await tagUntagged(serviceClient(), Number(body.limit) || 12));
  } catch (e) {
    console.error('auto-tag batch failed', e);
    return NextResponse.json({ error: 'Tagging stopped, try again' }, { status: 500 });
  }
}
