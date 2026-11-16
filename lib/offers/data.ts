/**
 * Offers: database side of who is due (server only). Gathers the facts for lib/offers/eligibility.ts.
 * Tables: preview_email_requests, preview_offers (db/migrations/2026-11-16-preview-offers.sql), orders, customer_custom_images.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { normaliseEmail } from '@/lib/marketing/preferences';
import type { OfferFacts, PersonFacts, PetInfo, RequestFacts } from './eligibility';
import { birthdayFromDate, cleanBirthday } from './dates';
import { chooseBuyerPhoto, imageUsable, type ImageRow, type SavedPetRow } from './photo';
import { zodiacByKey } from '@/lib/zodiac';

const PAGE = 1000;
export const NOT_A_SALE = new Set(['cancelled', 'canceled', 'refunded', 'failed']);
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

export interface PaidOrder { id: string; email: string; at: number }

/** Paid orders that were not cancelled or refunded, with the lower-cased address and time */
export async function loadPaidOrders(supabase: SupabaseClient): Promise<PaidOrder[]> {
  const rows = await pages<any>((a, b) => supabase.from('orders').select('id, status, customer_email, created_at').eq('payment_status', 'paid').order('id').range(a, b));
  const out: PaidOrder[] = [];
  for (const o of rows) {
    if (NOT_A_SALE.has(String(o.status || '').toLowerCase())) continue;
    const e = normaliseEmail(o.customer_email), t = ms(o.created_at);
    if (e && t !== null) out.push({ id: o.id, email: e, at: t });
  }
  return out;
}
export function paidTimes(orders: PaidOrder[]): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const o of orders) (out.get(o.email) ?? out.set(o.email, []).get(o.email)!).push(o.at);
  return out;
}

/** Times (ms) of paid orders by lower-cased address (paid, and not cancelled or refunded) */
export async function loadPaidOrderTimes(supabase: SupabaseClient): Promise<Map<string, number[]>> {
  return paidTimes(await loadPaidOrders(supabase));
}

/** Has this address a paid order at or after `since` (ms)? Used right before sending. */
export async function boughtSince(supabase: SupabaseClient, email: string, since: number): Promise<boolean> {
  const { data, error } = await supabase.from('orders').select('status, created_at').ilike('customer_email', email.replace(/[\\%_]/g, c => `\\${c}`))
    .eq('payment_status', 'paid').gte('created_at', new Date(since).toISOString());
  if (error) return true;   // cannot tell: do not send
  return (data ?? []).some((o: any) => !NOT_A_SALE.has(String(o.status || '').toLowerCase()));
}

/** breed id -> 'dog' | 'cat' */
export async function loadBreedAnimals(supabase: SupabaseClient): Promise<Map<string, 'dog' | 'cat'>> {
  const rows = await pages<any>((a, b) => supabase.from('breeds').select('id, animal_type').order('id').range(a, b), 20_000);
  const m = new Map<string, 'dog' | 'cat'>();
  for (const r of rows) if (r.animal_type === 'dog' || r.animal_type === 'cat') m.set(r.id, r.animal_type);
  return m;
}

/** A select that is retried with fewer columns when the second migration (2026-11-16-offers-campaigns.sql) has not been run */
async function selectTolerant(build: (cols: string) => PromiseLike<{ data: any[] | null; error: { message: string } | null }>, full: string, base: string): Promise<any[]> {
  let r = await build(full);
  if (r.error) r = await build(base);
  if (r.error) throw new Error(r.error.message);
  return r.data ?? [];
}

const animalOf = (breedId: string | null, detected: unknown, breeds: Map<string, 'dog' | 'cat'>, fallback: unknown = null): 'dog' | 'cat' | null => {
  const b = breedId ? breeds.get(breedId) : null;
  if (b) return b;
  if (detected === 'dog' || detected === 'cat') return detected;
  return fallback === 'dog' || fallback === 'cat' ? fallback : null;
};

export interface LoadOptions {
  /** also find each buyer's photo and pet (needed for buyers and for the notice) */
  buyers?: boolean;
  paidOrders?: PaidOrder[];
  breeds?: Map<string, 'dog' | 'cat'>;
}

/**
 * Facts for these addresses: all their requests, their offers, their paid orders, their email preferences (subscribed to offers, shown the photo
 * words, opted out, birthday given) and, with `buyers`, the buyer's photo and pet. `canEmail` is worked out from the preferences row (the same rule as
 * canEmail(email, 'offers')); anything that queues or sends still asks canEmail() itself, as the gate.
 */
export async function loadPeople(supabase: SupabaseClient, emails: string[], paid: Map<string, number[]>, opts: LoadOptions = {}): Promise<PersonFacts[]> {
  const people = new Map<string, PersonFacts>();
  for (const e of emails) people.set(e, { email: e, requests: [], canEmail: false, paidOrders: paid.get(e) ?? [], offers: [], isBuyer: (paid.get(e) ?? []).length > 0, buyer: null });
  const breeds = opts.breeds ?? await loadBreedAnimals(supabase);
  const ordersByEmail = new Map<string, PaidOrder[]>();
  for (const o of opts.paidOrders ?? []) (ordersByEmail.get(o.email) ?? ordersByEmail.set(o.email, []).get(o.email)!).push(o);

  for (const chunk of chunks(emails)) {
    // Email preferences: the gate's inputs, the photo wording, the photo opt-out and a birthday given through an offer email
    const { data: prefs, error: pe } = await supabase.from('email_preferences').select('*').in('email', chunk);
    if (pe) throw new Error(pe.message);
    for (const r of (prefs ?? []) as any[]) {
      const p = people.get(r.email);
      if (!p) continue;
      p.canEmail = r.status === 'subscribed' && r.topics?.offers === true;
      p.photoWordsShownAt = ms(r.photo_words_shown_at);
      p.photoWordsSource = r.photo_words_source ?? null;
      p.photoOptOutAt = ms(r.photo_offers_opt_out_at);
      p.prefBirthday = cleanBirthday({ month: r.pet_birth_month, day: r.pet_birth_day, year: r.pet_birth_year });
    }

    const reqs = await selectTolerant(
      cols => supabase.from('preview_email_requests').select(cols).in('email', chunk),
      'id, email, custom_image_id, created_at, photo_offers_ok, marketing_confirmed_at, offers_stopped_at, pet_birth_month, pet_birth_day, pet_birth_year',
      'id, email, custom_image_id, created_at, photo_offers_ok, marketing_confirmed_at, offers_stopped_at');
    const imageIds = Array.from(new Set(reqs.map(r => r.custom_image_id)));
    const imgs = new Map<string, any>();
    for (const ic of chunks(imageIds)) {
      const { data, error: ie } = await supabase.from('customer_custom_images').select('id, status, generated_cloudinary_id, pet_image_url, pet_cloudinary_id, pet_name, pet_breed_id, pet_coat_id, metadata').in('id', ic);
      if (ie) throw new Error(ie.message);
      for (const i of (data ?? []) as any[]) imgs.set(i.id, i);
    }
    for (const r of reqs) {
      const p = people.get(r.email);
      if (!p) continue;
      const i = imgs.get(r.custom_image_id);
      p.requests.push({
        id: r.id, createdAt: ms(r.created_at) ?? 0, photoOffersOk: r.photo_offers_ok === true, marketingConfirmedAt: ms(r.marketing_confirmed_at),
        offersStoppedAt: ms(r.offers_stopped_at), sourceImageId: r.custom_image_id,
        sourceUsable: !!i && i.status === 'complete' && !!i.generated_cloudinary_id && !!i.pet_image_url && !!i.pet_cloudinary_id,
        birthday: cleanBirthday({ month: r.pet_birth_month, day: r.pet_birth_day, year: r.pet_birth_year }),
        pet: i ? { name: i.pet_name ?? null, animal: animalOf(i.pet_breed_id ?? null, i.metadata?.detected_breed?.animal, breeds), breedId: i.pet_breed_id ?? null, coatId: i.pet_coat_id ?? null } : undefined,
      } as RequestFacts);
    }
    const { data: offers, error: oe } = await supabase.from('preview_offers').select('email, round, status, request_id, sent_at').in('email', chunk);
    if (oe) throw new Error(oe.message);
    for (const o of (offers ?? []) as any[]) people.get(o.email)?.offers.push({ round: o.round, status: o.status, requestId: o.request_id, sentAt: ms(o.sent_at) } as OfferFacts);

    if (opts.buyers) await attachBuyers(supabase, chunk.filter(e => people.get(e)?.isBuyer), people, ordersByEmail, breeds);
  }
  return Array.from(people.values());
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IMAGE_COLS = 'id, status, pet_image_url, pet_cloudinary_id, created_at, pet_id, pet_name, pet_breed_id, pet_coat_id, customer_email, metadata';

/** Find each buyer's photo (lib/offers/photo.ts: bought, else made, else a saved pet) and the pet it shows */
async function attachBuyers(supabase: SupabaseClient, emails: string[], people: Map<string, PersonFacts>, ordersByEmail: Map<string, PaidOrder[]>, breeds: Map<string, 'dog' | 'cat'>) {
  if (!emails.length) return;
  // 1. what they bought
  const orderIds = emails.flatMap(e => (ordersByEmail.get(e) ?? []).map(o => o.id));
  const itemsByOrder = new Map<string, string[]>();
  for (const c of chunks(orderIds, 200)) {
    const { data, error } = await supabase.from('order_items').select('order_id, image_id').in('order_id', c);
    if (error) throw new Error(error.message);
    for (const it of (data ?? []) as any[]) if (UUID_RE.test(String(it.image_id))) (itemsByOrder.get(it.order_id) ?? itemsByOrder.set(it.order_id, []).get(it.order_id)!).push(String(it.image_id).toLowerCase());
  }
  const images = new Map<string, any>();
  const fetchImages = async (ids: string[]) => {
    for (const c of chunks(Array.from(new Set(ids)).filter(id => !images.has(id)))) {
      const { data, error } = await supabase.from('customer_custom_images').select(IMAGE_COLS).in('id', c);
      if (error) throw new Error(error.message);
      for (const i of (data ?? []) as any[]) images.set(i.id, i);
    }
  };
  await fetchImages(Array.from(itemsByOrder.values()).flat());
  // 2. what they made by address
  const madeByEmail = new Map<string, any[]>();
  const { data: made, error: me } = await supabase.from('customer_custom_images').select(IMAGE_COLS).in('customer_email', emails).eq('status', 'complete').order('created_at', { ascending: false }).limit(3000);
  if (me) throw new Error(me.message);
  for (const i of (made ?? []) as any[]) { const e = normaliseEmail(i.customer_email); if (e) { images.set(i.id, i); (madeByEmail.get(e) ?? madeByEmail.set(e, []).get(e)!).push(i); } }
  // 3. saved pets (account customers)
  const { data: cust } = await supabase.from('customers').select('id, email').in('email', emails);
  const customerEmail = new Map<string, string>(((cust ?? []) as any[]).map(c => [c.id as string, normaliseEmail(c.email) ?? '']));
  const petsByEmail = new Map<string, any[]>();
  const petCols = (z: boolean) => `id, customer_id, name, breed_id, coat_id, birthday, ${z ? 'zodiac_sign, ' : ''}animal_type, primary_photo_url, is_active, updated_at`;
  const savedPets = async (filter: (q: any) => any) => {
    let r = await filter(supabase.from('pets').select(petCols(true)));
    if (r.error) r = await filter(supabase.from('pets').select(petCols(false)));
    return (r.data ?? []) as any[];
  };
  const petById = new Map<string, any>();
  for (const c of chunks(Array.from(customerEmail.keys()))) {
    for (const pet of await savedPets(q => q.in('customer_id', c))) {
      petById.set(pet.id, pet);
      const e = customerEmail.get(pet.customer_id);
      if (e) (petsByEmail.get(e) ?? petsByEmail.set(e, []).get(e)!).push(pet);
    }
  }
  // pets the chosen images point at (for the birthday and quiz sign)
  const wantPets = Array.from(new Set(Array.from(images.values()).map(i => i.pet_id).filter(Boolean))).filter(id => !petById.has(id)) as string[];
  for (const c of chunks(wantPets)) for (const pet of await savedPets(q => q.in('id', c))) petById.set(pet.id, pet);

  for (const e of emails) {
    const p = people.get(e)!;
    const boughtInOrder: ImageRow[] = [];
    for (const o of [...(ordersByEmail.get(e) ?? [])].sort((a, b) => b.at - a.at)) for (const id of itemsByOrder.get(o.id) ?? []) { const i = images.get(id); if (i) boughtInOrder.push(i); }
    const photo = chooseBuyerPhoto({ boughtInOrder, byEmail: madeByEmail.get(e) ?? [], pets: (petsByEmail.get(e) ?? []) as SavedPetRow[] });
    if (!photo) continue;
    let pet: PetInfo;
    const petRow = (id: string | null | undefined) => (id ? petById.get(id) : null);
    if (photo.customImageId) {
      const i = images.get(photo.customImageId);
      const row = petRow(i.pet_id);
      pet = {
        name: i.pet_name ?? row?.name ?? null, breedId: i.pet_breed_id ?? row?.breed_id ?? null, coatId: i.pet_coat_id ?? row?.coat_id ?? null,
        animal: animalOf(i.pet_breed_id ?? row?.breed_id ?? null, i.metadata?.detected_breed?.animal, breeds, row?.animal_type),
        birthday: birthdayFromDate(row?.birthday), quizSign: zodiacByKey(row?.zodiac_sign)?.key ?? null,
      };
    } else {
      const row = petRow(photo.petId)!;
      pet = { name: row.name ?? null, breedId: row.breed_id ?? null, coatId: row.coat_id ?? null, animal: animalOf(row.breed_id ?? null, null, breeds, row.animal_type), birthday: birthdayFromDate(row.birthday), quizSign: zodiacByKey(row.zodiac_sign)?.key ?? null };
    }
    p.buyer = { photo, pet };
  }
}

/** Addresses that asked under the photo wording and confirmed (the only previewers offers can ever be for) */
export async function loadCandidateEmails(supabase: SupabaseClient): Promise<string[]> {
  const rows = await pages<any>((a, b) => supabase.from('preview_email_requests').select('id, email')
    .eq('photo_offers_ok', true).not('marketing_confirmed_at', 'is', null).order('id').range(a, b));
  return Array.from(new Set(rows.map(r => String(r.email))));
}

/** Subscribed buyers (paid order, subscribed to offers) who have / have not been shown the photo wording. [] when the migration has not been run. */
export async function loadBuyerEmails(supabase: SupabaseClient, paid: Map<string, number[]>, shown: boolean): Promise<string[]> {
  const rows: any[] = [];
  for (let a = 0; a < 200_000; a += PAGE) {
    let q = supabase.from('email_preferences').select('email, topics, photo_words_shown_at').eq('status', 'subscribed').order('email').range(a, a + PAGE - 1);
    q = shown ? q.not('photo_words_shown_at', 'is', null) : q.is('photo_words_shown_at', null);
    const { data, error } = await q;
    if (error) return [];
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows.filter(r => r.topics?.offers === true && paid.has(r.email)).map(r => String(r.email));
}

/** Everyone a campaign could reach: confirmed previewers plus buyers who have been shown the photo wording */
export async function loadCampaignPeople(supabase: SupabaseClient): Promise<PersonFacts[]> {
  const orders = await loadPaidOrders(supabase);
  const paid = paidTimes(orders);
  const breeds = await loadBreedAnimals(supabase);
  const [previewers, buyers] = await Promise.all([loadCandidateEmails(supabase), loadBuyerEmails(supabase, paid, true)]);
  const emails = Array.from(new Set([...previewers, ...buyers]));
  const out: PersonFacts[] = [];
  for (let i = 0; i < emails.length; i += 100) out.push(...await loadPeople(supabase, emails.slice(i, i + 100), paid, { buyers: true, paidOrders: orders, breeds }));
  return out;
}

/** Subscribed buyers who have not been shown the photo wording yet, with their photo (the people the one-off notice is for) */
export async function loadNoticePeople(supabase: SupabaseClient): Promise<PersonFacts[]> {
  const orders = await loadPaidOrders(supabase);
  const paid = paidTimes(orders);
  const breeds = await loadBreedAnimals(supabase);
  const emails = await loadBuyerEmails(supabase, paid, false);
  const out: PersonFacts[] = [];
  for (let i = 0; i < emails.length; i += 100) out.push(...await loadPeople(supabase, emails.slice(i, i + 100), paid, { buyers: true, paidOrders: orders, breeds }));
  return out;
}

/** True when the pet photo of a custom image row is usable (exported for the re-check before generating) */
export { imageUsable };
