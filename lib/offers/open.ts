/** Offers: what opening an offer email's link does (server only). The signed token is checked by the caller (lib/offers/link.ts). */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { QrAttribution } from '@/lib/qr/attribution';

export type OpenOfferResult = { ok: false } | { ok: true; imageId: string; qr: QrAttribution | null };

/**
 * Grants THIS browser's guest session access to that one picture (only if it is one of this sent offer's pictures), records the
 * first click, and returns the stall attribution to carry over (as /pv does). Safe to repeat.
 */
export async function openOfferLink(supabase: SupabaseClient, offerId: string, imageId: string, who: { guestId: string }, now = Date.now()): Promise<OpenOfferResult> {
  const { data: offer } = await supabase.from('preview_offers').select('id, email, request_id, status, custom_image_ids, clicked_at').eq('id', offerId).maybeSingle();
  const o: any = offer;
  if (!o || o.status !== 'sent' || !Array.isArray(o.custom_image_ids) || !o.custom_image_ids.includes(imageId)) return { ok: false };
  const { data: img } = await supabase.from('customer_custom_images').select('id, guest_session_id, customer_email').eq('id', imageId).maybeSingle();
  if (!img) return { ok: false };
  const update: Record<string, unknown> = {};
  if ((img as any).guest_session_id !== who.guestId) update.guest_session_id = who.guestId;
  if (!(img as any).customer_email) update.customer_email = o.email;
  if (Object.keys(update).length) await supabase.from('customer_custom_images').update(update).eq('id', imageId);
  if (!o.clicked_at) await supabase.from('preview_offers').update({ clicked_at: new Date(now).toISOString() }).eq('id', offerId).is('clicked_at', null);
  // A buyer's offer has no preview email request (so no stall attribution to carry over)
  const { data: req } = o.request_id ? await supabase.from('preview_email_requests').select('qr_attribution').eq('id', o.request_id).maybeSingle() : { data: null };
  return { ok: true, imageId, qr: ((req as any)?.qr_attribution as QrAttribution | null) ?? null };
}
