/**
 * "Please don't reuse my photo": the link in the photo notice and in offer emails (lib/marketing/preferences.ts): ?p=<preference id>&t=<signature>.
 *   GET   a person clicking it. Does NOT change anything (link scanners follow GETs): shows a page with one button that POSTs here.
 *   POST  the button (a form POST): sets photo_offers_opt_out_at and shows the done page. Idempotent. Only photo offers stop: other emails carry on.
 * The signature has its own prefix, so an unsubscribe link cannot be used here nor this one to unsubscribe. The link carries the row id, never the address.
 */
import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';
import { getPreferencesById, preferencesUrl, setPhotoOptOut, verifyPhotoOptOutToken } from '@/lib/marketing/preferences';
import { badLinkPage, photoConfirmPage, photoDonePage } from '@/lib/marketing/pages';

export const dynamic = 'force-dynamic';
const HTML = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
const baseOf = (req: NextRequest) => (process.env.NEXT_PUBLIC_BASE_URL || req.nextUrl.origin).replace(/\/$/, '');
const bad = () => new NextResponse(badLinkPage(), { status: 400, headers: HTML });

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams.get('p'), t = req.nextUrl.searchParams.get('t');
  if (!verifyPhotoOptOutToken(p, t)) return bad();
  const base = baseOf(req);
  return new NextResponse(photoConfirmPage(`${base}/api/public/email-preferences/photo-optout?p=${p}&t=${t}`, preferencesUrl(base, p)), { status: 200, headers: HTML });
}

export async function POST(req: NextRequest) {
  const p = req.nextUrl.searchParams.get('p'), t = req.nextUrl.searchParams.get('t');
  if (!verifyPhotoOptOutToken(p, t)) return bad();
  try {
    const supabase = serviceClient();
    const row = await getPreferencesById(supabase, p);
    if (!row) return bad();
    if (!row.photo_offers_opt_out_at) await setPhotoOptOut(supabase, row.email, true, 'email_link');
    return new NextResponse(photoDonePage(preferencesUrl(baseOf(req), p)), { status: 200, headers: HTML });
  } catch (e) {
    console.error('photo opt-out failed', e);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
