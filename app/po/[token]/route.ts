/**
 * /po/<token>: the "See it bigger" links in an offer email (lib/offers/). Verifies the signed token (30 days; it carries an offer id
 * and one picture id, never an address), gives THIS browser access to that one picture (only if it belongs to that sent offer),
 * records the first click, and redirects to the preview page with ?src=offer_email. Safe to repeat. Link scanners and crawlers are
 * just redirected: they grant nothing and record nothing. Like /pv, it carries the stall attribution over to a device that has none.
 * Bad or expired: the "gone walkies" page with a way to browse.
 */
import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';
import { getRequester, setGuestCookie } from '@/lib/guest/access';
import { QR_ATTRIBUTION_COOKIE, decodeAttribution, encodeAttribution, isBotUserAgent } from '@/lib/qr/attribution';
import { attributionToRestore } from '@/lib/previews/email-link';
import { verifyOfferToken } from '@/lib/offers/link';
import { openOfferLink } from '@/lib/offers/open';
import { badLinkPage } from '@/lib/marketing/pages';

export const dynamic = 'force-dynamic';
const HTML = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
const bad = () => new NextResponse(badLinkPage({ browseUrl: '/browse' }), { status: 400, headers: HTML });

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const check = verifyOfferToken(token);
  if (!check.ok) return bad();
  const supabase = serviceClient();

  if (isBotUserAgent(req.headers.get('user-agent'))) {
    const { data } = await supabase.from('preview_offers').select('custom_image_ids, status').eq('id', check.offerId).maybeSingle();
    if (!data || (data as any).status !== 'sent' || !((data as any).custom_image_ids ?? []).includes(check.imageId)) return bad();
    return NextResponse.redirect(new URL(`/shop/custom-portrait/${check.imageId}?src=offer_email`, req.url), 302);
  }

  try {
    const requester = await getRequester(req, { createGuest: true });
    const opened = await openOfferLink(supabase, check.offerId, check.imageId, { guestId: requester.guestId! });
    if (!opened.ok) return bad();
    const res = NextResponse.redirect(new URL(`/shop/custom-portrait/${opened.imageId}?src=offer_email`, req.url), 302);
    res.headers.set('Cache-Control', 'no-store');
    setGuestCookie(res, requester);
    const restore = attributionToRestore(opened.qr, decodeAttribution(req.cookies.get(QR_ATTRIBUTION_COOKIE)?.value));
    if (restore) {
      res.cookies.set(QR_ATTRIBUTION_COOKIE, encodeAttribution(restore.attribution), {
        httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: restore.maxAgeS,
      });
    }
    return res;
  } catch (e) {
    console.error('offer link failed', e);
    return bad();
  }
}
