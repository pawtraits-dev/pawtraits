/**
 * The unsubscribe link in marketing emails (lib/marketing/preferences.ts): ?p=<preference id>&t=<signature>.
 *   POST  one-click (RFC 8058): the mail client POSTs with the body `List-Unsubscribe=One-Click`.
 *         Unsubscribes at once: no page, no cookies, no sign-in. A person pressing the confirm
 *         page's button (a form POST) gets the "done" page instead of JSON. Idempotent.
 *   GET   a person clicking the footer link. Does NOT unsubscribe (link scanners follow GETs):
 *         shows a page with one button, "Yes, stop all emails", that POSTs here.
 * The link carries the preference row's id, never the email address.
 */
import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';
import { getPreferencesById, preferencesUrl, unsubscribe, verifyPreferenceToken } from '@/lib/marketing/preferences';
import { badLinkPage, confirmPage, donePage } from '@/lib/marketing/pages';

export const dynamic = 'force-dynamic';
const HTML = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };

const baseOf = (req: NextRequest) => (process.env.NEXT_PUBLIC_BASE_URL || req.nextUrl.origin).replace(/\/$/, '');

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams.get('p'), t = req.nextUrl.searchParams.get('t');
  if (!verifyPreferenceToken(p, t)) return new NextResponse(badLinkPage(), { status: 400, headers: HTML });
  const base = baseOf(req);
  const post = `${base}/api/public/email-preferences/unsubscribe?p=${p}&t=${t}`;
  return new NextResponse(confirmPage(post, preferencesUrl(base, p)), { status: 200, headers: HTML });
}

export async function POST(req: NextRequest) {
  const p = req.nextUrl.searchParams.get('p'), t = req.nextUrl.searchParams.get('t');
  const raw = await req.text().catch(() => '');
  const oneClick = /(^|&)List-Unsubscribe=One-Click(&|$)/i.test(raw);
  const wantsPage = !oneClick && (req.headers.get('content-type') || '').includes('application/x-www-form-urlencoded');
  if (!verifyPreferenceToken(p, t)) {
    return wantsPage ? new NextResponse(badLinkPage(), { status: 400, headers: HTML }) : NextResponse.json({ error: 'This link has expired or is incomplete.' }, { status: 400 });
  }
  try {
    const supabase = serviceClient();
    const row = await getPreferencesById(supabase, p);
    if (!row) return wantsPage ? new NextResponse(badLinkPage(), { status: 400, headers: HTML }) : NextResponse.json({ error: 'This link has expired or is incomplete.' }, { status: 400 });
    if (row.status !== 'unsubscribed') await unsubscribe(supabase, { email: row.email, source: oneClick ? 'one_click' : 'email_link' });   // already stopped: nothing to do (idempotent)
    return wantsPage ? new NextResponse(donePage(preferencesUrl(baseOf(req), p)), { status: 200, headers: HTML }) : NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('email unsubscribe failed', e);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
