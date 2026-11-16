/**
 * Offers: asking for a pet's birthday through the link in an offer email.
 *
 * The link is /po/<token>/birthday. The token carries the offer id and an expiry (30 days), signed like the offer link (a different prefix, so
 * no other token can be used for it); it never carries an address. Opening the page (GET, which link scanners do) changes nothing: only the form's
 * POST saves. The birthday is stored against the offer's address (email_preferences.pet_birth_*): buyers who never made an account have no saved
 * pet to keep it on, and previewers told us on the preview card (preview_email_requests.pet_birth_*), which is read too.
 * Pure parts (token) first, then the database parts (server only).
 */
import { createHmac, timingSafeEqual } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { LINK_DAYS } from '@/lib/previews/email-link';
import { birthdayFromDate, cleanBirthday, type Birthday } from './dates';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_MS = 24 * 60 * 60 * 1000;

function secret() {
  return process.env.PREVIEW_LINK_SECRET || process.env.SOCIAL_LINK_SECRET || process.env.DOWNLOAD_LINK_SECRET || process.env.QR_ATTRIBUTION_SECRET
    || `preview-${process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-16) ?? 'dev'}`;
}
const sig = (offerId: string, exp: string) => createHmac('sha256', secret()).update(`offer-birthday:${offerId}:${exp}`).digest('base64url').slice(0, 32);

/** `<offer id>.<expiry, base36 ms>.<signature>` */
export const signBirthdayToken = (offerId: string, now = Date.now()) => { const exp = (now + LINK_DAYS * DAY_MS).toString(36); return `${offerId}.${exp}.${sig(offerId, exp)}`; };

export type BirthdayTokenCheck = { ok: true; offerId: string } | { ok: false; reason: 'bad' | 'expired' };
export function verifyBirthdayToken(token: unknown, now = Date.now()): BirthdayTokenCheck {
  if (typeof token !== 'string') return { ok: false, reason: 'bad' };
  const [offerId, exp, s] = token.split('.');
  if (!offerId || !exp || !s || !UUID_RE.test(offerId) || !/^[0-9a-z]+$/.test(exp)) return { ok: false, reason: 'bad' };
  const a = Buffer.from(sig(offerId, exp)), b = Buffer.from(s);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'bad' };
  return parseInt(exp, 36) < now ? { ok: false, reason: 'expired' } : { ok: true, offerId };
}
export const birthdayAskUrl = (baseUrl: string, offerId: string, now = Date.now()) => `${baseUrl.replace(/\/$/, '')}/po/${signBirthdayToken(offerId, now)}/birthday`;

/** The form's fields (day, month, optional year) as a birthday; null when it is not a real date */
export function birthdayFromForm(form: { get(name: string): unknown }): Birthday | null {
  return cleanBirthday({ month: form.get('month'), day: form.get('day'), year: form.get('year') });
}

// ---------------------------------------------------------------------------------------------
// Database

/** Do we already know this pet's birthday? (saved pet, the birthday given through an offer email, or told to us on a preview card) */
export async function birthdayKnown(supabase: SupabaseClient, offer: { email: string; source_pet_id?: string | null; source_custom_image_id?: string | null }): Promise<boolean> {
  const email = offer.email;
  const prefs = await supabase.from('email_preferences').select('pet_birth_month, pet_birth_day').eq('email', email).maybeSingle();
  if (!prefs.error && (prefs.data as any)?.pet_birth_month && (prefs.data as any)?.pet_birth_day) return true;
  const reqs = await supabase.from('preview_email_requests').select('pet_birth_month, pet_birth_day').eq('email', email).not('pet_birth_month', 'is', null).limit(1);
  if (!reqs.error && (reqs.data ?? []).length) return true;
  let petId = offer.source_pet_id ?? null;
  if (!petId && offer.source_custom_image_id) petId = ((await supabase.from('customer_custom_images').select('pet_id').eq('id', offer.source_custom_image_id).maybeSingle()).data as any)?.pet_id ?? null;
  if (petId) {
    const { data } = await supabase.from('pets').select('birthday').eq('id', petId).maybeSingle();
    if (birthdayFromDate((data as any)?.birthday)) return true;
  }
  return false;
}

/** Save a birthday for the address an offer went to. False when the offer is not one that was sent, or the columns are not there yet. */
export async function saveBirthday(supabase: SupabaseClient, offerId: string, b: Birthday): Promise<boolean> {
  const { data: offer } = await supabase.from('preview_offers').select('email, status').eq('id', offerId).maybeSingle();
  if (!offer || (offer as any).status !== 'sent') return false;
  const { data, error } = await supabase.from('email_preferences').update({
    pet_birth_month: b.month, pet_birth_day: b.day, pet_birth_year: b.year ?? null, updated_at: new Date().toISOString(),
  }).eq('email', (offer as any).email).select('id');
  if (error) { console.warn('offers: birthday not saved', error.message); return false; }
  return (data ?? []).length > 0;
}
