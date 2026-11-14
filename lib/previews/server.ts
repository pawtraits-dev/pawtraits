/**
 * "Email me this preview", database side (server only). Tables: preview_email_requests
 * (db/migrations/2026-11-14-preview-emails.sql). This is a message the person asked for, not
 * marketing, so it is sent whatever their marketing choice and never calls canEmail().
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { cloudinaryService } from '@/lib/cloudinary';
import { sendMessageImmediate } from '@/lib/messaging/message-service';
import { renderEmailFile } from '@/lib/messaging/render-file';
import { decodeAttribution, hashIp, type QrAttribution } from '@/lib/qr/attribution';
import { getPreferences, maskEmail, normaliseEmail, subscribe } from '@/lib/marketing/preferences';
import { CONSENT_LABEL } from '@/lib/marketing/consent-copy';
import { PREVIEW_EMAIL } from './copy';
import { appendSend, limitProblem, marketingStep, previewFirstName, previewUrl, sendsInLastDay, type LimitProblem } from './email-link';

const MISSING = /preview_email_requests/;
const DAY_MS = 24 * 60 * 60 * 1000;

export type RequestResult =
  | { ok: true; masked: string; sent: boolean }
  | { ok: false; status: number; code: 'bad_email' | 'limit' | 'unavailable' | 'other' | 'not_found'; limit?: LimitProblem };

export interface RequestInput {
  imageId: string;
  /** the visitor's own typed address (guests); ignored for signed-in customers, whose account address is used */
  email: string | null;
  marketingTicked: boolean;
  user: { id: string; email?: string | null } | null;
  guestId: string | null;
  qrCookie: string | null;
  ip: string | null;
  baseUrl: string;
}

/** The caller has already checked ownership of the preview (canAccessCustomImage). */
export async function requestPreviewEmail(supabase: SupabaseClient, input: RequestInput, now = Date.now()): Promise<RequestResult> {
  try {
    const email = normaliseEmail(input.user?.email ?? input.email);
    if (!email) return { ok: false, status: 400, code: 'bad_email' };

    const { data: img } = await supabase.from('customer_custom_images')
      .select('id, status, pet_name, generated_cloudinary_id').eq('id', input.imageId).maybeSingle();
    if (!img || (img as any).status !== 'complete' || !(img as any).generated_cloudinary_id) return { ok: false, status: 404, code: 'not_found' };

    const since = new Date(now - DAY_MS).toISOString();
    const [forPreview, forGuest, forAddress] = await Promise.all([
      supabase.from('preview_email_requests').select('send_count').eq('custom_image_id', input.imageId),
      input.guestId ? supabase.from('preview_email_requests').select('email').eq('guest_session_id', input.guestId).gte('last_sent_at', since) : Promise.resolve({ data: [] as any[], error: null }),
      supabase.from('preview_email_requests').select('sends').eq('email', email).gte('last_sent_at', since),
    ]);
    const err = forPreview.error || forGuest.error || forAddress.error;
    if (err) {
      console.error('preview email: table not available', err.message);
      return { ok: false, status: 503, code: 'unavailable' };
    }
    const problem = limitProblem({
      email,
      sendsForPreview: (forPreview.data ?? []).reduce((n: number, r: any) => n + (r.send_count ?? 0), 0),
      guestAddressesToday: Array.from(new Set((forGuest.data ?? []).map((r: any) => r.email))) as string[],
      sendsToAddressToday: (forAddress.data ?? []).reduce((n: number, r: any) => n + sendsInLastDay(r.sends, now), 0),
    });
    if (problem) return { ok: false, status: 429, code: 'limit', limit: problem };

    // Stall attribution at the time of asking (only a valid signed cookie)
    const qr = decodeAttribution(input.qrCookie);
    const customerId = input.user ? ((await supabase.from('customers').select('id').eq('user_id', input.user.id).maybeSingle()).data as any)?.id ?? null : null;
    const { data: existing } = await supabase.from('preview_email_requests').select('id, send_count, sends, marketing_ticked').eq('custom_image_id', input.imageId).eq('email', email).maybeSingle();
    // A tick stays once given (the address may be asked for again without it); nothing is stored as pending when unticked
    const ticked = input.marketingTicked || !!(existing as any)?.marketing_ticked;
    const fields = {
      custom_image_id: input.imageId, email, guest_session_id: input.guestId, customer_id: customerId, marketing_ticked: ticked,
      ...(qr ? { qr_scan_id: qr.scanId, pos_location_id: qr.locationId, qr_attribution: qr } : {}), ip_hash: hashIp(input.ip),
    };
    const { data: row, error } = existing
      ? await supabase.from('preview_email_requests').update(fields).eq('id', (existing as any).id).select('id, send_count, sends, marketing_ticked').single()
      : await supabase.from('preview_email_requests').insert(fields).select('id, send_count, sends, marketing_ticked').single();
    if (error || !row) { console.error('preview email: could not store the request', error?.message); return { ok: false, status: MISSING.test(error?.message ?? '') ? 503 : 500, code: MISSING.test(error?.message ?? '') ? 'unavailable' : 'other' }; }

    const firstName = previewFirstName((img as any).pet_name);
    const html = renderEmailFile('customer-preview-link.html', {
      pet_name: firstName,
      body_line: PREVIEW_EMAIL.body(firstName),
      picture_url: cloudinaryService.getPublicVariantUrl((img as any).generated_cloudinary_id, 'catalog_watermarked', { width: 640, format: 'jpg' }),
      preview_url: previewUrl(input.baseUrl, (row as any).id, now),
      marketing_line: (row as any).marketing_ticked ? PREVIEW_EMAIL.marketingLine : null,
    });
    const sent = await sendMessageImmediate({ channel: 'email', recipientEmail: email, subject: PREVIEW_EMAIL.subject(firstName), body: html });
    if (!sent.success) { console.error('preview email: send failed', sent.error); return { ok: false, status: 502, code: 'other' }; }
    await supabase.from('preview_email_requests').update({ send_count: ((row as any).send_count ?? 0) + 1, sends: appendSend((row as any).sends, now), last_sent_at: new Date(now).toISOString() }).eq('id', (row as any).id);
    return { ok: true, masked: maskEmail(email), sent: true };
  } catch (e) {
    console.error('preview email failed', e);
    return { ok: false, status: 500, code: 'other' };
  }
}

export type OpenResult =
  | { ok: false }
  | { ok: true; imageId: string; qr: QrAttribution | null; changed: { guestAttached: boolean } };

/**
 * The signed link was opened by a person (not a link scanner: the caller skips those). Grants THIS
 * browser's guest session access to that one preview, records the open, proves the address by setting
 * customer_email (only if the preview has none), and confirms a pending marketing tick. Safe to repeat.
 */
export async function openPreviewLink(supabase: SupabaseClient, requestId: string, who: { guestId: string; userEmail?: string | null }, now = Date.now()): Promise<OpenResult> {
  const { data: req, error } = await supabase.from('preview_email_requests').select('*').eq('id', requestId).maybeSingle();
  if (error || !req) return { ok: false };
  const r: any = req;
  const { data: img } = await supabase.from('customer_custom_images').select('id, guest_session_id, customer_email').eq('id', r.custom_image_id).maybeSingle();
  if (!img) return { ok: false };

  // Access: the preview's guest session becomes this browser's. (A signed-in owner keeps access by their address.)
  const guestAttached = (img as any).guest_session_id !== who.guestId;
  const update: Record<string, unknown> = {};
  if (guestAttached) update.guest_session_id = who.guestId;
  if (!(img as any).customer_email) update.customer_email = r.email;   // address proven by opening the link
  if (Object.keys(update).length) await supabase.from('customer_custom_images').update(update).eq('id', r.custom_image_id);

  await supabase.from('preview_email_requests').update({
    opened_at: r.opened_at ?? new Date(now).toISOString(), last_opened_at: new Date(now).toISOString(), open_count: (r.open_count ?? 0) + 1,
  }).eq('id', requestId);

  // Pending marketing tick: confirmed by opening the link (it shows the address is theirs)
  try {
    const step = marketingStep(r, (await getPreferences(supabase, r.email))?.status ?? null);
    if (step === 'subscribe') {
      await subscribe(supabase, { email: r.email, source: 'preview_email', customerId: r.customer_id, basis: 'consent', wording: CONSENT_LABEL });
      await supabase.from('preview_email_requests').update({ marketing_confirmed_at: new Date(now).toISOString() }).eq('id', requestId);
    }
  } catch (e) {
    console.error('preview email: marketing tick not confirmed', e);
  }
  return { ok: true, imageId: r.custom_image_id, qr: (r.qr_attribution as QrAttribution | null) ?? null, changed: { guestAttached } };
}
