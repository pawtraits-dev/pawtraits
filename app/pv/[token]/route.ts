/**
 * /pv/<token>: the link in the "Email me this preview" email. Verifies the signed token (30 days; it
 * carries a request id, never an address), gives THIS browser access to that one preview, and
 * redirects to the preview page with ?src=preview_email. Safe to repeat. Link scanners and crawlers
 * (bot user agents) are just redirected: they grant nothing and confirm nothing.
 * Also carries the stall attribution (pt_qr) over to a device that has none, keeping its original
 * timestamp. Bad or expired: the "gone walkies" page with a way to browse.
 */
import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';
import { getRequester, setGuestCookie } from '@/lib/guest/access';
import { QR_ATTRIBUTION_COOKIE, decodeAttribution, encodeAttribution, isBotUserAgent } from '@/lib/qr/attribution';
import { attributionToRestore, verifyPreviewToken } from '@/lib/previews/email-link';
import { openPreviewLink } from '@/lib/previews/server';
import { badLinkPage } from '@/lib/marketing/pages';

export const dynamic = 'force-dynamic';
const HTML = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
const bad = () => new NextResponse(badLinkPage({ browseUrl: '/browse' }), { status: 400, headers: HTML });

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const check = verifyPreviewToken(token);
  if (!check.ok) return bad();
  const supabase = serviceClient();

  // A link scanner: send it on to the page, change nothing
  if (isBotUserAgent(req.headers.get('user-agent'))) {
    const { data } = await supabase.from('preview_email_requests').select('custom_image_id').eq('id', check.requestId).maybeSingle();
    if (!data) return bad();
    return NextResponse.redirect(new URL(`/shop/custom-portrait/${(data as any).custom_image_id}?src=preview_email`, req.url), 302);
  }

  try {
    const requester = await getRequester(req, { createGuest: true });
    const opened = await openPreviewLink(supabase, check.requestId, { guestId: requester.guestId!, userEmail: requester.user?.email });
    if (!opened.ok) return bad();
    const res = NextResponse.redirect(new URL(`/shop/custom-portrait/${opened.imageId}?src=preview_email`, req.url), 302);
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
    console.error('preview link failed', e);
    return bad();
  }
}
