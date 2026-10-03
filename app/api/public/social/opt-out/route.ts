/**
 * POST /api/public/social/opt-out  { o: orderId, t: signature }
 * "Don't feature my pet": records the opt-out for the order's email (lib/social/opt-out.ts).
 * The signature comes from the link in our emails; no sign-in needed.
 */
import { NextRequest, NextResponse } from 'next/server';
import { optOutByOrder, verifyOptOut } from '@/lib/social/opt-out';

export async function POST(request: NextRequest) {
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
  if (!verifyOptOut(body?.o, body?.t)) return NextResponse.json({ error: 'This link has expired or is incomplete.' }, { status: 400 });
  try {
    const ok = await optOutByOrder(body.o);
    if (!ok) return NextResponse.json({ error: 'We couldn’t find that order.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('social opt-out failed', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
