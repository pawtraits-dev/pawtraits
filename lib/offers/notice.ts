/**
 * Offers: the one-off notice to past buyers (server only). "We've kept the photo you sent; Pawcasso may paint them again; nothing to do."
 *
 * ONLY ever sent when the owner presses a button in Admin > Offers (app/api/admin/offers/notice/route.ts): never from the cron, never automatically,
 * and never while offers_enabled is off. The audience is lib/offers/eligibility.ts noticeAudience(): subscribed buyers with a usable photo who have not
 * yet been shown the photo wording. Each send is claimed first (photo_words_shown_at, source 'notice_email', set only where it is still empty) so two
 * presses at once cannot send twice; if the send then fails, the claim is undone. Right before sending, canEmail(email, 'offers') is asked again.
 * The email has the unsubscribe and preferences links and List-Unsubscribe headers (marketingEmailExtras) and a one-click "Please don't reuse my photo".
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { canEmail, marketingEmailExtras, markPhotoWordsShown, photoOptOutUrl } from '@/lib/marketing/preferences';
import { sendMessageImmediate } from '@/lib/messaging/message-service';
import { renderEmailFile } from '@/lib/messaging/render-file';
import { previewFirstName } from '@/lib/previews/email-link';
import { loadNoticePeople } from './data';
import { noticeAudience, type PersonFacts } from './eligibility';
import { NOTICE_EMAIL } from './copy';
import { siteUrl } from './settings';

/** People emailed per request (the admin page asks again until none are left, up to its own cap per press) */
export const NOTICE_BATCH = 50;

export async function noticeRecipients(supabase: SupabaseClient): Promise<PersonFacts[]> {
  return noticeAudience(await loadNoticePeople(supabase));
}

function render(firstName: string | null, links: { optOut: string; unsubscribe: string; preferences: string }) {
  return renderEmailFile('customer-photo-notice.html', {
    heading: NOTICE_EMAIL.heading(firstName), preheader: NOTICE_EMAIL.preheader, lines: NOTICE_EMAIL.lines(firstName), why_line: NOTICE_EMAIL.why,
    photo_optout_url: links.optOut, photo_optout_label: NOTICE_EMAIL.optOut, unsubscribe_url: links.unsubscribe, preferences_url: links.preferences,
  });
}

export type NoticeResult = 'sent' | 'skipped' | 'failed';

export async function sendNoticeTo(supabase: SupabaseClient, p: PersonFacts, now = Date.now()): Promise<NoticeResult> {
  if (!(await canEmail(supabase, p.email, 'offers'))) return 'skipped';
  const base = siteUrl();
  const extras = await marketingEmailExtras(supabase, base, p.email);
  if (!extras) return 'skipped';
  if (!(await markPhotoWordsShown(supabase, p.email, 'notice_email', now))) return 'skipped';   // already shown (or the migration is not run): never sent twice
  const firstName = previewFirstName(p.buyer?.pet.name);
  try {
    const sent = await sendMessageImmediate({
      channel: 'email', recipientEmail: p.email, subject: NOTICE_EMAIL.subject(firstName), headers: extras.headers,
      body: render(firstName, { optOut: photoOptOutUrl(base, extras.preference_id), unsubscribe: extras.unsubscribe_url, preferences: extras.preferences_url }),
    });
    if (sent.success) return 'sent';
    console.error('notice: send failed', sent.error);
  } catch (e) {
    console.error('notice: send failed', e);
  }
  await supabase.from('email_preferences').update({ photo_words_shown_at: null, photo_words_source: null }).eq('email', p.email).eq('photo_words_source', 'notice_email');
  return 'failed';
}

/** Send to up to `limit` of the people who are still due it. Returns what happened and how many are still to go. */
export async function sendNoticeBatch(supabase: SupabaseClient, limit = NOTICE_BATCH): Promise<{ sent: number; skipped: number; failed: number; remaining: number }> {
  const todo = await noticeRecipients(supabase);
  const batch = todo.slice(0, Math.max(0, Math.min(limit, NOTICE_BATCH)));
  const r = { sent: 0, skipped: 0, failed: 0, remaining: 0 };
  for (const p of batch) { const o = await sendNoticeTo(supabase, p); r[o === 'sent' ? 'sent' : o === 'failed' ? 'failed' : 'skipped']++; }
  // Skipped and failed people stay in the audience if they still qualify; the page stops after a batch that sent nothing, so it cannot loop
  r.remaining = Math.max(0, todo.length - r.sent);
  return r;
}

/** "Send me a test": the notice to the signed-in admin's own address, nothing else. Records nothing. Links are real when that address has a preferences row. */
export async function sendNoticeTest(supabase: SupabaseClient, adminEmail: string): Promise<{ ok: boolean; error?: string }> {
  const base = siteUrl();
  const extras = await marketingEmailExtras(supabase, base, adminEmail);
  const links = extras
    ? { optOut: photoOptOutUrl(base, extras.preference_id), unsubscribe: extras.unsubscribe_url, preferences: extras.preferences_url }
    : { optOut: `${base}/email-preferences`, unsubscribe: `${base}/email-preferences`, preferences: `${base}/email-preferences` };
  const sent = await sendMessageImmediate({
    channel: 'email', recipientEmail: adminEmail, subject: `${NOTICE_EMAIL.testSubjectPrefix}${NOTICE_EMAIL.subject('Biscuit')}`, headers: extras?.headers,
    body: render('Biscuit', links),
  });
  return sent.success ? { ok: true } : { ok: false, error: sent.error ?? 'Send failed' };
}
