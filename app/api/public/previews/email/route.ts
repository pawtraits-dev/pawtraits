/**
 * POST /api/public/previews/email  { imageId, email?, website? }
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
import { NextRequest, NextResponse, after } from 'next/server';
import { randomUUID } from 'crypto';
import { sendMetaEvent } from '@/lib/tracking/meta-capi';
import { metaClientFromRequest } from '@/lib/tracking/meta-request';
import { serviceClient } from '@/lib/qr/server';
import { canAccessCustomImage, clientIp, getRequester } from '@/lib/guest/access';
import { QR_ATTRIBUTION_COOKIE } from '@/lib/qr/attribution';
import { maskEmail, normaliseEmail } from '@/lib/marketing/preferences';
import { requestPreviewEmail } from '@/lib/previews/server';
import { cleanBirthday } from '@/lib/offers/dates';
import { linkBaseUrl } from '@/lib/site-url';
import { PHOTO_WORDS_VERSION, PREVIEW_COPY } from '@/lib/previews/copy';

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
  const { data: row } = await supabase.from('customer_custom_images').select('id, customer_email, guest_session_id, catalog_image_id').eq('id', imageId).maybeSingle();
  if (!row || !canAccessCustomImage(row as any, requester)) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE });

  const catalogImageId = String((row as any).catalog_image_id ?? '');
  const typed = normaliseEmail(body?.email);
  if (!requester.user && !typed) return NextResponse.json({ error: PREVIEW_COPY.errBad, code: 'bad_email' }, { status: 400, headers: NO_STORE });
  // Honeypot: a bot fills the hidden field. Look successful, send nothing.
  if (typeof body?.website === 'string' && body.website.trim()) return NextResponse.json({ ok: true, masked: maskEmail(typed ?? 'x@x.co') }, { headers: NO_STORE });

  const r = await requestPreviewEmail(supabase, {
    imageId, email: typed, marketingTicked: !requester.user,   // not signed in: asking for the preview is the sign-up (confirmed when the link is opened)
    birthday: requester.user ? null : cleanBirthday(body?.birthday),   // optional; an impossible date (30 Feb) is ignored
    photoWordsShown: body?.wording === PHOTO_WORDS_VERSION,    // the card sends the version of the words it showed (we keep the photo)
    user: requester.user ? { id: requester.user.id, email: requester.user.email } : null,
    guestId: requester.guestId, qrCookie: req.cookies.get(QR_ATTRIBUTION_COOKIE)?.value ?? null, ip: clientIp(req),
    baseUrl: linkBaseUrl(req.nextUrl.origin),   // a preview deployment links back to itself (lib/site-url.ts)
  });
  if (r.ok) {
    // Meta "Lead" (server side), only with marketing cookies. The event id is a fresh random one, not the
    // preview_email_requests row id: that id is the key of the signed link, and the same row is reused when
    // an address asks again, so returning it would reveal "this address is already known". The browser
    // pixel gets the same id from this response, so the two de-duplicate.
    const client = metaClientFromRequest(req);
    const metaEventId = client ? `lead_${randomUUID()}` : undefined;
    if (client && metaEventId) {
      const email = r.email;
      after(() => sendMetaEvent({
        name: 'Lead', eventId: metaEventId, email,
        fbp: client.fbp, fbc: client.fbc, clientIp: client.ip, userAgent: client.ua, sourceUrl: client.url,
        customData: { content_ids: [catalogImageId], content_type: 'product', content_category: 'preview_email' },
      }));
    }
    return NextResponse.json({ ok: true, masked: r.masked, ...(metaEventId ? { metaEventId } : {}) }, { headers: NO_STORE });
  }
  const error = r.code === 'bad_email' ? PREVIEW_COPY.errBad : r.code === 'limit' ? PREVIEW_COPY.errLimit : r.code === 'unavailable' ? PREVIEW_COPY.errUnavailable : r.code === 'not_found' ? 'Not found' : PREVIEW_COPY.errOther;
  return NextResponse.json({ error, code: r.code }, { status: r.status, headers: NO_STORE });
}
