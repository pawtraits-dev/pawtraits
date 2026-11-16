/**
 * Offers: database side of who is due (server only). Gathers the facts for lib/offers/eligibility.ts.
 * Tables: preview_email_requests, preview_offers (db/migrations/2026-11-16-preview-offers.sql), orders, customer_custom_images.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { normaliseEmail } from '@/lib/marketing/preferences';
import type { OfferFacts, PersonFacts, RequestFacts } from './eligibility';

const PAGE = 1000;
const NOT_A_SALE = new Set(['cancelled', 'canceled', 'refunded', 'failed']);
const chunks = <T,>(xs: T[], n = 150): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
const ms = (v: unknown) => { const t = v ? Date.parse(String(v)) : NaN; return Number.isFinite(t) ? t : null; };

async function pages<T>(page: (a: number, b: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, max = 100_000): Promise<T[]> {
  const rows: T[] = [];
  for (let a = 0; a < max; a += PAGE) {
    const { data, error } = await page(a, a + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

/** Times (ms) of paid orders by lower-cased address (paid, and not cancelled or refunded) */
export async function loadPaidOrderTimes(supabase: SupabaseClient): Promise<Map<string, number[]>> {
  const rows = await pages<any>((a, b) => supabase.from('orders').select('id, status, customer_email, created_at').eq('payment_status', 'paid').order('id').range(a, b));
  const out = new Map<string, number[]>();
  for (const o of rows) {
    if (NOT_A_SALE.has(String(o.status || '').toLowerCase())) continue;
    const e = normaliseEmail(o.customer_email), t = ms(o.created_at);
    if (!e || t === null) continue;
    (out.get(e) ?? out.set(e, []).get(e)!).push(t);
  }
  return out;
}

/** Has this address a paid order at or after `since` (ms)? Used right before sending. */
export async function boughtSince(supabase: SupabaseClient, email: string, since: number): Promise<boolean> {
  const { data, error } = await supabase.from('orders').select('status, created_at').ilike('customer_email', email.replace(/[\\%_]/g, c => `\\${c}`))
    .eq('payment_status', 'paid').gte('created_at', new Date(since).toISOString());
  if (error) return true;   // cannot tell: do not send
  return (data ?? []).some((o: any) => !NOT_A_SALE.has(String(o.status || '').toLowerCase()));
}

/** Facts for these addresses: all their requests, their offers, their paid orders. `canEmail` is filled in by the caller (it asks the preferences table). */
export async function loadPeople(supabase: SupabaseClient, emails: string[], paid: Map<string, number[]>): Promise<PersonFacts[]> {
  const people = new Map<string, PersonFacts>();
  for (const e of emails) people.set(e, { email: e, requests: [], canEmail: true, paidOrders: paid.get(e) ?? [], offers: [] });
  for (const chunk of chunks(emails)) {
    const { data: reqs, error } = await supabase.from('preview_email_requests')
      .select('id, email, custom_image_id, created_at, photo_offers_ok, marketing_confirmed_at, offers_stopped_at').in('email', chunk);
    if (error) throw new Error(error.message);
    const imageIds = Array.from(new Set(((reqs ?? []) as any[]).map(r => r.custom_image_id)));
    const usable = new Set<string>();
    for (const ic of chunks(imageIds)) {
      const { data: imgs, error: ie } = await supabase.from('customer_custom_images').select('id, status, generated_cloudinary_id, pet_image_url, pet_cloudinary_id').in('id', ic);
      if (ie) throw new Error(ie.message);
      for (const i of (imgs ?? []) as any[]) if (i.status === 'complete' && i.generated_cloudinary_id && i.pet_image_url && i.pet_cloudinary_id) usable.add(i.id);
    }
    for (const r of (reqs ?? []) as any[]) {
      const p = people.get(r.email);
      if (!p) continue;
      p.requests.push({
        id: r.id, createdAt: ms(r.created_at) ?? 0, photoOffersOk: r.photo_offers_ok === true, marketingConfirmedAt: ms(r.marketing_confirmed_at),
        offersStoppedAt: ms(r.offers_stopped_at), sourceImageId: r.custom_image_id, sourceUsable: usable.has(r.custom_image_id),
      } as RequestFacts);
    }
    const { data: offers, error: oe } = await supabase.from('preview_offers').select('email, round, status, request_id, sent_at').in('email', chunk);
    if (oe) throw new Error(oe.message);
    for (const o of (offers ?? []) as any[]) people.get(o.email)?.offers.push({ round: o.round, status: o.status, requestId: o.request_id, sentAt: ms(o.sent_at) } as OfferFacts);
  }
  return Array.from(people.values());
}

/** Addresses that asked under the photo wording and confirmed (the only people offers can ever be for) */
export async function loadCandidateEmails(supabase: SupabaseClient): Promise<string[]> {
  const rows = await pages<any>((a, b) => supabase.from('preview_email_requests').select('id, email')
    .eq('photo_offers_ok', true).not('marketing_confirmed_at', 'is', null).order('id').range(a, b));
  return Array.from(new Set(rows.map(r => String(r.email))));
}
