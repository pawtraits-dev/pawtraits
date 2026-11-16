/**
 * Offers: the checks made again at every step (before generating, and immediately before sending). Server only.
 * Never bypassed: an offer is only generated or sent while canEmail(email, 'offers') is true, offers have not been stopped for the person,
 * they have not said "don't reuse my photo", and
 *   - a previewer: they have not bought since the preview request;
 *   - a buyer: they were shown the photo wording (email_preferences.photo_words_shown_at); having bought is expected;
 *   - an automatic birthday or zodiac offer: its day (the birthday, or the start of the sign) has not passed.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { canEmail, getPreferences } from '@/lib/marketing/preferences';
import { boughtSince } from './data';
import { eventPassed } from './dates';
import { loadOfferSource } from './source';

export interface OfferRow {
  id: string; email: string; request_id: string | null; source_custom_image_id: string | null; source_pet_id?: string | null; audience?: 'previewer' | 'buyer'; event_date?: string | null;
  round: string; campaign_id: string | null;
  status: string; designs: any[]; custom_image_ids: string[]; error: string | null; due_at: string;
  generated_at: string | null; approved_at: string | null; approved_by: string | null; sent_at: string | null;
  opened_at: string | null; clicked_at: string | null; created_at: string;
}

export type Allowed = { ok: true; request: any } | { ok: false; reason: string };

export async function offerStillAllowed(supabase: SupabaseClient, offer: Pick<OfferRow, 'email' | 'request_id' | 'source_custom_image_id'> & Partial<OfferRow>, opts: { needPhoto?: boolean; now?: number } = {}): Promise<Allowed> {
  if (eventPassed(offer.event_date, opts.now ?? Date.now())) return { ok: false, reason: 'The day this offer was for has passed' };
  const buyer = offer.audience === 'buyer';
  let request: any = null;
  if (!buyer) {
    const { data } = await supabase.from('preview_email_requests').select('*').eq('id', offer.request_id ?? '').maybeSingle();
    request = data;
    if (!request) return { ok: false, reason: 'The preview request is gone' };
    if (request.photo_offers_ok !== true) return { ok: false, reason: 'They were not told we keep the photo' };
  }
  const { data: stopped } = await supabase.from('preview_email_requests').select('id').eq('email', offer.email).not('offers_stopped_at', 'is', null).limit(1);
  if ((stopped ?? []).length) return { ok: false, reason: 'Offers were stopped for this person' };
  const prefs: any = await getPreferences(supabase, offer.email);
  if (prefs?.photo_offers_opt_out_at) return { ok: false, reason: 'They asked us not to reuse their photo' };
  if (!(await canEmail(supabase, offer.email, 'offers'))) return { ok: false, reason: 'No longer subscribed to offers' };
  if (buyer) {
    if (!prefs?.photo_words_shown_at) return { ok: false, reason: 'They have not been shown the photo wording' };
  } else if (await boughtSince(supabase, offer.email, Date.parse(request.created_at))) {
    return { ok: false, reason: 'They have bought since asking for the preview' };
  }
  if (opts.needPhoto && !(await loadOfferSource(supabase, offer))) return { ok: false, reason: buyer ? 'Their photo is no longer there' : 'The preview or its photo is no longer there' };
  return { ok: true, request };
}
