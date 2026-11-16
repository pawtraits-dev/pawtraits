/**
 * "Tell past buyers": the one-off notice that we have kept their pet's photo (lib/offers/notice.ts). Admin only, and ONLY on a button press.
 * GET   how many would get it
 * POST  { action: 'test' }   send the notice to the signed-in admin's own address (nobody else), records nothing
 *       { action: 'send' }   send to up to 50 of the people who are still due it; the page asks again until none are left (it stops at its own cap per press)
 * Both refuse while Offers is switched off (offers_enabled) and until db/migrations/2026-11-16-offers-campaigns.sql has been run.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { campaignsMigrationReady } from '@/lib/offers/run';
import { NOTICE_BATCH, noticeRecipients, sendNoticeBatch, sendNoticeTest } from '@/lib/offers/notice';
import { CAMPAIGNS_MIGRATION_FILE, loadOfferSettings } from '@/lib/offers/settings';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function GET() {
  const denied = await requireAdmin(); if (denied) return denied;
  try {
    const supabase = serviceClient();
    if (!(await campaignsMigrationReady(supabase))) return NextResponse.json({ migration: false, file: CAMPAIGNS_MIGRATION_FILE, eligible: 0, batch: NOTICE_BATCH });
    return NextResponse.json({ migration: true, eligible: (await noticeRecipients(supabase)).length, batch: NOTICE_BATCH });
  } catch (e: any) {
    console.error('offers notice count failed', e);
    return fail(e?.message || 'Could not count', 500);
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(); if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  try {
    if (!(await loadOfferSettings()).enabled) return fail('Switch offers on first: nothing is sent while they are off');
    const supabase = serviceClient();
    if (!(await campaignsMigrationReady(supabase))) return fail(`Run ${CAMPAIGNS_MIGRATION_FILE} first`, 503);
    if (body?.action === 'test') {
      const cookieStore = await cookies();
      const auth = createRouteHandlerClient({ cookies: () => cookieStore } as any);
      const email = (await auth.auth.getUser()).data.user?.email;
      if (!email) return fail('Could not read your email address', 400);
      const r = await sendNoticeTest(supabase, email);
      return r.ok ? NextResponse.json({ ok: true, to: email }) : fail(r.error ?? 'The test did not send', 502);
    }
    if (body?.action === 'send') return NextResponse.json({ ok: true, ...(await sendNoticeBatch(supabase, NOTICE_BATCH)) });
    return fail('Unknown action');
  } catch (e: any) {
    console.error('offers notice failed', e);
    return fail(e?.message || 'Something went wrong', 500);
  }
}
