/**
 * Offers: send the offer email (server only).
 *
 * Only an 'approved' offer is sent (a 'ready' one too when offers_auto_send is on). Immediately before sending, the checks are made AGAIN
 * (canEmail(email, 'offers'), offers not stopped, nothing bought since) and the offer is claimed with a conditional update, so two
 * runs cannot send it twice. If the person can no longer be emailed or has bought, the offer becomes 'skipped' with the reason.
 * The email carries the same watermarked preview picture the site shows for an unpurchased preview, and the unsubscribe and
 * preferences links and List-Unsubscribe headers every marketing email has (marketingEmailExtras).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { cloudinaryService } from '@/lib/cloudinary';
import { sendMessageImmediate } from '@/lib/messaging/message-service';
import { renderEmailFile } from '@/lib/messaging/render-file';
import { marketingEmailExtras } from '@/lib/marketing/preferences';
import { designTitle } from '@/lib/marketing/audiences';
import { previewFirstName } from '@/lib/previews/email-link';
import { computeLowestPrices, gbp } from '@/lib/pricing/lowest-prices';
import { offerUrl } from './link';
import { offerStillAllowed, type OfferRow } from './allowed';
import { OFFER_EMAIL } from './copy';
import { MIN_PICTURES, siteUrl } from './settings';

export interface EmailPicture { src: string; alt: string; title: string; url: string }

/** The price line ("Prints from £15."), from the catalogue's current UK prices; null when they cannot be read (the line is left out) */
export async function priceLine(supabase: SupabaseClient): Promise<string | null> {
  try {
    const [products, pricing] = await Promise.all([
      supabase.from('products').select('id, is_active, product_type').eq('is_active', true),
      supabase.from('product_pricing').select('product_id, country_code, sale_price, discount_price, is_on_sale, is_current').eq('country_code', 'GB'),
    ]);
    if (products.error || pricing.error) return null;
    const { lowestPrint } = computeLowestPrices(products.data ?? [], pricing.data ?? []);
    return lowestPrint ? OFFER_EMAIL.priceLine(gbp(lowestPrint)) : null;
  } catch {
    return null;
  }
}

/** Subject: the campaign's own, or the standard one */
export function offerSubject(firstName: string | null, pictures: number, campaignSubject?: string | null): string {
  const own = (campaignSubject ?? '').trim();
  return own || OFFER_EMAIL.subject(firstName, pictures);
}

export type SendOutcome = { result: 'sent' } | { result: 'skipped'; reason: string } | { result: 'not_sendable'; reason: string } | { result: 'failed'; reason: string };

/** Send one offer. `autoSend`: offers_auto_send is on, so a 'ready' offer may go without approval. */
export async function sendOffer(supabase: SupabaseClient, offerId: string, opts: { autoSend: boolean; now?: number; approvedBy?: string }): Promise<SendOutcome> {
  const now = opts.now ?? Date.now();
  const { data: row } = await supabase.from('preview_offers').select('*').eq('id', offerId).maybeSingle();
  if (!row) return { result: 'not_sendable', reason: 'No such offer' };
  const offer = row as unknown as OfferRow;
  const from = offer.status === 'approved' ? 'approved' : offer.status === 'ready' && opts.autoSend ? 'ready' : null;
  if (!from) return { result: 'not_sendable', reason: `An offer that is ${offer.status} cannot be sent${offer.status === 'ready' ? ' until it is approved' : ''}` };

  // Claim it: only one caller gets past this
  const { data: claimed } = await supabase.from('preview_offers')
    .update({ status: 'sent', sent_at: new Date(now).toISOString(), ...(from === 'ready' ? { approved_at: new Date(now).toISOString(), approved_by: 'auto' } : {}) })
    .eq('id', offerId).eq('status', from).select('id');
  if (!claimed?.length) return { result: 'not_sendable', reason: 'Someone else is sending it' };
  const undo = (patch: Record<string, unknown> = {}) => supabase.from('preview_offers').update({ status: from, sent_at: null, ...patch }).eq('id', offerId);
  const skip = async (reason: string): Promise<SendOutcome> => { await supabase.from('preview_offers').update({ status: 'skipped', sent_at: null, error: reason }).eq('id', offerId); return { result: 'skipped', reason }; };

  try {
    // The checks, again, right before sending
    const allowed = await offerStillAllowed(supabase, offer);
    if (!allowed.ok) return await skip(allowed.reason);
    const baseUrl = siteUrl();
    const extras = await marketingEmailExtras(supabase, baseUrl, offer.email);
    if (!extras) return await skip('No preferences record for this address');

    const ids = offer.custom_image_ids ?? [];
    const { data: imgs } = ids.length ? await supabase.from('customer_custom_images').select('id, status, pet_name, generated_cloudinary_id, catalog_image_id').in('id', ids) : { data: [] as any[] };
    const byId = new Map(((imgs ?? []) as any[]).map(i => [i.id as string, i]));
    const good = ids.map(id => byId.get(id)).filter((i: any) => i && i.status === 'complete' && i.generated_cloudinary_id);
    if (good.length < MIN_PICTURES) { await undo({ error: 'Fewer than 2 finished pictures' }); return { result: 'failed', reason: 'Fewer than 2 finished pictures' }; }

    const titles = new Map<string, string>();
    const catalogIds = Array.from(new Set(good.map((i: any) => i.catalog_image_id).filter(Boolean)));
    const { data: cats } = catalogIds.length ? await supabase.from('image_catalog').select('id, description').in('id', catalogIds) : { data: [] as any[] };
    for (const c of (cats ?? []) as any[]) titles.set(c.id, designTitle(c.description));

    const firstName = previewFirstName((good[0] as any).pet_name);
    const campaign = offer.campaign_id ? ((await supabase.from('offer_campaigns').select('subject, intro').eq('id', offer.campaign_id).maybeSingle()).data as any) : null;
    const pictures: EmailPicture[] = good.map((i: any) => ({
      // The watermarked preview picture, as the preview email uses: never the unwatermarked file
      src: cloudinaryService.getPublicVariantUrl(i.generated_cloudinary_id, 'catalog_watermarked', { width: 640, format: 'jpg' }),
      alt: `${firstName ?? 'Your pet'} as ${titles.get(i.catalog_image_id) ?? 'a Pawtrait'}`,
      title: titles.get(i.catalog_image_id) ?? 'A new Pawtrait',
      url: offerUrl(baseUrl, offer.id, i.id, now),
    }));
    const html = renderEmailFile('customer-offer.html', {
      heading: OFFER_EMAIL.heading(firstName), preheader: OFFER_EMAIL.preheader,
      intro_line: (campaign?.intro ?? '').trim() || OFFER_EMAIL.intro(firstName),
      pictures, price_line: await priceLine(supabase), why_line: OFFER_EMAIL.why(firstName),
      unsubscribe_url: extras.unsubscribe_url, preferences_url: extras.preferences_url,
    });
    const sent = await sendMessageImmediate({
      channel: 'email', recipientEmail: offer.email, subject: offerSubject(firstName, pictures.length, campaign?.subject), body: html, headers: extras.headers,
    });
    if (!sent.success) { await undo({ error: `Send failed: ${sent.error ?? 'unknown'}` }); return { result: 'failed', reason: sent.error ?? 'Send failed' }; }
    return { result: 'sent' };
  } catch (e: any) {
    await undo({ error: e instanceof Error ? e.message : 'Send failed' });
    return { result: 'failed', reason: e instanceof Error ? e.message : 'Send failed' };
  }
}
