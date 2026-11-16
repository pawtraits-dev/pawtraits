/**
 * /po/<token>/birthday: the birthday question behind the small link in an offer email (lib/offers/birthday.ts).
 *   GET   shows a tiny page with day, month and an optional year. Changes NOTHING (link scanners open links), so it is safe to open any number of times.
 *   POST  the Save button (a form POST): stores the birthday against the address the offer went to, and says thank you. An impossible date
 *         (30 Feb) is not saved: the page is shown again.
 * The token carries the offer id and a 30-day expiry (signed), never an address. Bad or expired: the "gone walkies" page.
 */
import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';
import { badLinkPage, birthdayDonePage, birthdayPage } from '@/lib/marketing/pages';
import { BIRTHDAY_PAGE } from '@/lib/offers/copy';
import { birthdayFromForm, saveBirthday, verifyBirthdayToken } from '@/lib/offers/birthday';
import { previewFirstName } from '@/lib/previews/email-link';

export const dynamic = 'force-dynamic';
const HTML = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
const bad = () => new NextResponse(badLinkPage({ browseUrl: '/browse' }), { status: 400, headers: HTML });

async function petFirstName(offerId: string): Promise<string | null> {
  try {
    const { data } = await serviceClient().from('preview_offers').select('custom_image_ids').eq('id', offerId).maybeSingle();
    const id = ((data as any)?.custom_image_ids ?? [])[0];
    if (!id) return null;
    const { data: img } = await serviceClient().from('customer_custom_images').select('pet_name').eq('id', id).maybeSingle();
    return previewFirstName((img as any)?.pet_name);
  } catch { return null; }
}

const page = (token: string, name: string | null, problem: string | null = null, status = 200) => new NextResponse(birthdayPage({
  postUrl: `/po/${token}/birthday`, heading: BIRTHDAY_PAGE.heading(name), intro: BIRTHDAY_PAGE.intro, save: BIRTHDAY_PAGE.save, yearHint: BIRTHDAY_PAGE.yearHint, problem,
}), { status, headers: HTML });

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const check = verifyBirthdayToken(token);
  if (!check.ok) return bad();
  return page(token, await petFirstName(check.offerId));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const check = verifyBirthdayToken(token);
  if (!check.ok) return bad();
  try {
    const form = await req.formData().catch(() => null);
    const birthday = form ? birthdayFromForm(form) : null;
    if (!birthday) return page(token, await petFirstName(check.offerId), BIRTHDAY_PAGE.tryAgain, 400);
    if (!(await saveBirthday(serviceClient(), check.offerId, birthday))) return bad();
    return new NextResponse(birthdayDonePage(BIRTHDAY_PAGE.thanks), { status: 200, headers: HTML });
  } catch (e) {
    console.error('offer birthday failed', e);
    return bad();
  }
}
