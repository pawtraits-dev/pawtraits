/**
 * Offers: the checks made again at every step (before generating, and immediately before sending). Server only.
 * Never bypassed: an offer is only generated or sent while canEmail(email, 'offers') is true, offers have not been stopped
 * for the person, and they have not bought since the preview request.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { canEmail } from '@/lib/marketing/preferences';
import { boughtSince } from './data';

export interface OfferRow {
  id: string; email: string; request_id: string; source_custom_image_id: string; round: string; campaign_id: string | null;
  status: string; designs: any[]; custom_image_ids: string[]; error: string | null; due_at: string;
  generated_at: string | null; approved_at: string | null; approved_by: string | null; sent_at: string | null;
  opened_at: string | null; clicked_at: string | null; created_at: string;
}

export type Allowed = { ok: true; request: any } | { ok: false; reason: string };

export async function offerStillAllowed(supabase: SupabaseClient, offer: Pick<OfferRow, 'email' | 'request_id'>, opts: { needPhoto?: boolean } = {}): Promise<Allowed> {
  const { data: request } = await supabase.from('preview_email_requests').select('*').eq('id', offer.request_id).maybeSingle();
  if (!request) return { ok: false, reason: 'The preview request is gone' };
  if ((request as any).photo_offers_ok !== true) return { ok: false, reason: 'They were not told we keep the photo' };
  const { data: stopped } = await supabase.from('preview_email_requests').select('id').eq('email', offer.email).not('offers_stopped_at', 'is', null).limit(1);
  if ((stopped ?? []).length) return { ok: false, reason: 'Offers were stopped for this person' };
  if (!(await canEmail(supabase, offer.email, 'offers'))) return { ok: false, reason: 'No longer subscribed to offers' };
  if (await boughtSince(supabase, offer.email, Date.parse((request as any).created_at))) return { ok: false, reason: 'They have bought since asking for the preview' };
  if (opts.needPhoto) {
    const { data: src } = await supabase.from('customer_custom_images').select('id, status, pet_image_url, pet_cloudinary_id').eq('id', (request as any).custom_image_id).maybeSingle();
    if (!src || (src as any).status !== 'complete' || !(src as any).pet_image_url || !(src as any).pet_cloudinary_id) return { ok: false, reason: 'The preview or its photo is no longer there' };
  }
  return { ok: true, request };
}
