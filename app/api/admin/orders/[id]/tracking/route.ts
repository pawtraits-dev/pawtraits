/**
 * POST → check Royal Mail tracking for this order now (saves the timeline, tells the customer about
 * a new milestone). lib/shipping/royal-mail/server.ts
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { refreshTracking } from '@/lib/shipping/royal-mail/server';

export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const supabase = serviceClient();
    const r = await refreshTracking(supabase, id);
    const { data } = await supabase.from('orders').select('tracking_status, tracking_status_text, tracking_events, tracking_checked_at, delivered_at, self_print_status').eq('id', id).maybeSingle();
    return NextResponse.json({ ...r, order: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not check tracking' }, { status: 500 });
  }
}
