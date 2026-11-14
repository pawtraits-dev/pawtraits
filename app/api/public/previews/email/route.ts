/**
 * POST /api/public/previews/email  { imageId, email?, marketingOptIn?, website? }
 * "Email me this preview": emails the owner of a finished preview a link to pick it up on any device
 * (lib/previews/). A message the person asked for, not marketing: sent whatever their marketing choice.
 *
 * Only the preview's current owner may ask (the same check as the other custom-image routes: the
 * signed-in customer, or the guest device that made it); anyone else gets a 404. Signed-in customers
 * send no address (their account address is used). Limits (this sends email to an address a visitor
 * typed): 3 sends per preview, 3 different addresses per guest per day, 5 emails to any one address
 * per day, plus the middleware's IP rate limit. `website` is a honeypot: filled in = pretend success.
 * The email contains nothing the visitor typed (the pet's first name, letters only, is the only name).
 */
import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';
import { canAccessCustomImage, clientIp, getRequester } from '@/lib/guest/access';
import { QR_ATTRIBUTION_COOKIE } from '@/lib/qr/attribution';
import { maskEmail, normaliseEmail } from '@/lib/marketing/preferences';
import { requestPreviewEmail } from '@/lib/previews/server';
import { PREVIEW_COPY } from '@/lib/previews/copy';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_STORE = { 'Cache-Control': 'no-store' };

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const imageId = String(body?.imageId ?? '');
  if (!UUID.test(imageId)) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE });

  const requester = await getRequester(req);
  if (!requester.user && !requester.guestId) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE });
  const supabase = serviceClient();
  const { data: row } = await supabase.from('customer_custom_images').select('id, customer_email, guest_session_id').eq('id', imageId).maybeSingle();
  if (!row || !canAccessCustomImage(row as any, requester)) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE });

  const typed = normaliseEmail(body?.email);
  if (!requester.user && !typed) return NextResponse.json({ error: PREVIEW_COPY.errBad, code: 'bad_email' }, { status: 400, headers: NO_STORE });
  // Honeypot: a bot fills the hidden field. Look successful, send nothing.
  if (typeof body?.website === 'string' && body.website.trim()) return NextResponse.json({ ok: true, masked: maskEmail(typed ?? 'x@x.co') }, { headers: NO_STORE });

  const r = await requestPreviewEmail(supabase, {
    imageId, email: typed, marketingTicked: !requester.user && body?.marketingOptIn === true,
    user: requester.user ? { id: requester.user.id, email: requester.user.email } : null,
    guestId: requester.guestId, qrCookie: req.cookies.get(QR_ATTRIBUTION_COOKIE)?.value ?? null, ip: clientIp(req),
    baseUrl: (process.env.NEXT_PUBLIC_BASE_URL || req.nextUrl.origin).replace(/\/$/, ''),
  });
  if (r.ok) return NextResponse.json({ ok: true, masked: r.masked }, { headers: NO_STORE });
  const error = r.code === 'bad_email' ? PREVIEW_COPY.errBad : r.code === 'limit' ? PREVIEW_COPY.errLimit : r.code === 'unavailable' ? PREVIEW_COPY.errUnavailable : r.code === 'not_found' ? 'Not found' : PREVIEW_COPY.errOther;
  return NextResponse.json({ error, code: r.code }, { status: r.status, headers: NO_STORE });
}
