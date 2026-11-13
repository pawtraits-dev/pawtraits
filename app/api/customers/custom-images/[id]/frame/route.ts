import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';
import { getRequester, canAccessCustomImage } from '@/lib/guest/access';
import { switchCustomFrame } from '@/lib/frames/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/customers/custom-images/[id]/frame  { frame: 'on' | 'off', petName?: string }
 * Switch the owner's portrait of a zodiac or tarot card between framed and unframed, without a new
 * AI generation (the clean painting is stored; the frame is only layers). `petName` is the name on
 * the card banner when switching on (or changing it). Owner only: the signed-in customer, or the
 * guest on the device that made it (the same check as GET). Refused with 409 and a short message for
 * a portrait that has been ordered, and for "on" while a download, mug or case of it is in the basket.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    if (body?.frame !== 'on' && body?.frame !== 'off') return NextResponse.json({ error: 'Choose with or without the frame' }, { status: 400 });
    const requester = await getRequester(request);
    if (!requester.user && !requester.guestId) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const supabase = serviceClient();
    const { data: row } = await supabase.from('customer_custom_images').select('id, customer_email, guest_session_id').eq('id', id).maybeSingle();
    // 404 (not 403) for someone else's image, so ids can't be probed
    if (!row || !canAccessCustomImage(row as any, requester)) return NextResponse.json({ error: 'Custom image not found' }, { status: 404 });
    const r = await switchCustomFrame(supabase as any, id, body.frame, body.petName);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, state: r.state, petName: r.petName, changed: r.changed }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('custom-image frame switch failed', e);
    return NextResponse.json({ error: 'Could not change the card just now. Please try again.' }, { status: 500 });
  }
}
