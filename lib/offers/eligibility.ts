/**
 * Offers: who is due (pure; no database). The database side (lib/offers/data.ts) gathers the facts about each
 * address into a PersonFacts, this decides. One person (address) gets one offer per round however many previews they emailed.
 *
 * Round 1: asked under the words that say we keep the photo (photoOffersOk), confirmed (opened the link) at least round1Days ago,
 *   offers not stopped, source preview complete and still has its photo, can be emailed about offers, no paid order since
 *   the request, no round 1 yet, and at least 7 days since any offer email.
 * Round 2: round 1 was SENT at least round2Days ago, and the same checks again.
 * Campaign: the round 1 rules without the day count (and with the 7-day gap), for a campaign started by hand.
 */
import type { ZodiacKey } from '@/lib/zodiac';
import { signOfBirthday, type Birthday } from './dates';
import type { Animal } from './select-designs';
import { DAY_MS, MIN_GAP_DAYS, MIN_PICTURES } from './settings';

/** What we know about a person's pet, for choosing designs and for the birthday / zodiac campaigns */
export interface PetInfo {
  name: string | null;
  animal: Animal | null;
  breedId: string | null;
  coatId: string | null;
  /** from the saved pet (pets.birthday), when this is one */
  birthday: Birthday | null;
  /** the sign saved by the zodiac quiz (used only when there is no birthday) */
  quizSign: ZodiacKey | null;
}
export type PhotoSource = 'bought' | 'customisation' | 'saved_pet' | 'preview';
/** Where a person's pet photo is: a customisation (its stored pet photo) or a saved pet's primary photo */
export interface PhotoRef { customImageId: string | null; petId: string | null; source: PhotoSource }
export type AudienceKind = 'previewer' | 'buyer';
export type AudienceChoice = 'previewers' | 'buyers' | 'both';

export interface RequestFacts {
  id: string;
  createdAt: number;                // ms
  photoOffersOk: boolean;
  marketingConfirmedAt: number | null;
  offersStoppedAt: number | null;
  sourceImageId: string;
  /** the source preview is complete AND still has its pet photo */
  sourceUsable: boolean;
  /** the pet's birthday, when the visitor told us on the preview card */
  birthday?: Birthday | null;
  /** the pet in the source preview */
  pet?: Omit<PetInfo, 'birthday' | 'quizSign'>;
}

export interface OfferFacts {
  round: string;                    // '1' | '2' | 'campaign:<id>'
  status: string;
  requestId: string | null;
  sentAt: number | null;
}

export interface PersonFacts {
  email: string;
  requests: RequestFacts[];
  /** canEmail(email, 'offers') */
  canEmail: boolean;
  /** times (ms) of paid orders from this address */
  paidOrders: number[];
  offers: OfferFacts[];
  // ---- for buyers and the birthday / zodiac campaigns (all optional: absent = nothing known)
  /** has at least one paid order that was not cancelled or refunded */
  isBuyer?: boolean;
  /** the photo and pet to use for a buyer (null = none that is usable) */
  buyer?: { photo: PhotoRef; pet: PetInfo } | null;
  /** when this address was shown the words that say we keep the pet's photo (email_preferences.photo_words_shown_at) */
  photoWordsShownAt?: number | null;
  photoWordsSource?: string | null;
  /** "Please don't reuse my photo" (email_preferences.photo_offers_opt_out_at) */
  photoOptOutAt?: number | null;
  /** a birthday given through the link in an offer email (email_preferences.pet_birth_*) */
  prefBirthday?: Birthday | null;
}

export type Round = '1' | '2' | `campaign:${string}` | `birthday:${string}` | `zodiac:${string}`;
export interface Due { round: Round; requestId: string | null; sourceImageId: string | null; sourcePetId?: string | null; dueAt: number; audience?: AudienceKind; eventDate?: string | null }

const stopped = (p: PersonFacts) => p.requests.some(r => r.offersStoppedAt !== null);
/** "Please don't reuse my photo" (or the switch on the preferences page): no photo offers, for anyone */
const optedOut = (p: PersonFacts) => !!p.photoOptOutAt;
const boughtSince = (p: PersonFacts, since: number) => p.paidOrders.some(t => t >= since);
export const lastOfferSent = (p: PersonFacts) => p.offers.reduce((m, o) => (o.sentAt !== null && o.sentAt > m ? o.sentAt : m), 0);
export const gapOk = (p: PersonFacts, now: number) => now - lastOfferSent(p) >= MIN_GAP_DAYS * DAY_MS;

/** The person's most recent request that could start offers (day count left to the caller) */
export function latestUsable(p: PersonFacts): RequestFacts | null {
  const ok = p.requests.filter(r => r.photoOffersOk && r.marketingConfirmedAt !== null && r.offersStoppedAt === null && r.sourceUsable);
  return ok.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
}

export function round1Due(p: PersonFacts, now: number, round1Days: number): Due | null {
  if (!p.canEmail || stopped(p) || optedOut(p) || p.offers.some(o => o.round === '1')) return null;
  const req = latestUsable(p);
  if (!req) return null;
  const dueAt = req.marketingConfirmedAt! + round1Days * DAY_MS;
  if (now < dueAt || boughtSince(p, req.createdAt) || !gapOk(p, now)) return null;
  return { round: '1', requestId: req.id, sourceImageId: req.sourceImageId, dueAt, audience: 'previewer' };
}

export function round2Due(p: PersonFacts, now: number, round2Days: number): Due | null {
  if (!p.canEmail || stopped(p) || optedOut(p) || p.offers.some(o => o.round === '2')) return null;
  const r1 = p.offers.find(o => o.round === '1' && o.sentAt !== null);
  if (!r1) return null;
  const req = p.requests.find(r => r.id === r1.requestId);
  if (!req || !req.sourceUsable) return null;
  const dueAt = r1.sentAt! + round2Days * DAY_MS;
  if (now < dueAt || boughtSince(p, req.createdAt) || !gapOk(p, now)) return null;
  return { round: '2', requestId: req.id, sourceImageId: req.sourceImageId, dueAt, audience: 'previewer' };
}

/** A hand-started campaign: same rules as round 1 minus the day count, plus the 7-day gap; once per campaign per person */
export function campaignDue(p: PersonFacts, now: number, campaignId: string): Due | null {
  const round: Round = `campaign:${campaignId}`;
  if (!p.canEmail || stopped(p) || optedOut(p) || p.offers.some(o => o.round === round)) return null;
  const req = latestUsable(p);
  if (!req || boughtSince(p, req.createdAt) || !gapOk(p, now)) return null;
  return { round, requestId: req.id, sourceImageId: req.sourceImageId, dueAt: now, audience: 'previewer' };
}

/** Which offer, if any, is due now (round 1 before round 2; never both in one run) */
export function dueNow(p: PersonFacts, now: number, s: { round1Days: number; round2Days: number }): Due | null {
  return round1Due(p, now, s.round1Days) ?? round2Due(p, now, s.round2Days);
}

/** An offer that is about to be generated or sent: is it still allowed? (checked again at each step) */
export function stillAllowed(p: PersonFacts, requestId: string): { ok: true } | { ok: false; reason: string } {
  if (!p.canEmail) return { ok: false, reason: 'No longer subscribed to offers' };
  if (stopped(p)) return { ok: false, reason: 'Offers stopped for this person' };
  if (optedOut(p)) return { ok: false, reason: 'They asked us not to reuse their photo' };
  const req = p.requests.find(r => r.id === requestId);
  if (!req) return { ok: false, reason: 'The preview request is gone' };
  if (!req.sourceUsable) return { ok: false, reason: 'The preview or its photo is no longer there' };
  if (boughtSince(p, req.createdAt)) return { ok: false, reason: 'They have bought since' };
  return { ok: true };
}

/** An offer needs at least this many good pictures to be ready */
export const hasEnoughPictures = (good: number, min = MIN_PICTURES) => good >= min;

// ---------------------------------------------------------------------------------------------
// Campaigns for previewers AND buyers (hand-started campaigns, and the automatic birthday and zodiac ones)

/**
 * A buyer may be offered something only when ALL of these hold: they have a paid order that was not cancelled or refunded; they are subscribed
 * to offers; offers have not been stopped for them and they have not said "don't reuse my photo"; there is a usable pet photo; and they were
 * shown the words that say we keep the photo at least `graceDays` days ago (so the one-off notice email is read before the first offer).
 * Having bought is what makes them a buyer, so (unlike a previewer) it never rules them out.
 */
export function buyerReady(p: PersonFacts, now: number, graceDays: number): boolean {
  const shown = typeof p.photoWordsShownAt === 'number' ? p.photoWordsShownAt : null;
  return p.isBuyer === true && p.canEmail && !stopped(p) && !optedOut(p) && !!p.buyer && shown !== null && now - shown >= graceDays * DAY_MS;
}

/** A previewer for a campaign: the round 1 rules without the day count (asked under the photo wording, confirmed, not stopped, source still there) and nothing bought since */
export function previewerReady(p: PersonFacts): RequestFacts | null {
  if (!p.canEmail || stopped(p) || optedOut(p)) return null;
  const req = latestUsable(p);
  return req && !boughtSince(p, req.createdAt) ? req : null;
}

/** Who can be offered a campaign right now by the rules above (not yet the 7-day gap or "already has this round"). A person who is both counts once, as a buyer. */
export function audienceOf(p: PersonFacts, now: number, graceDays: number, choice: AudienceChoice = 'both'): AudienceKind | null {
  if (choice !== 'previewers' && buyerReady(p, now, graceDays)) return 'buyer';
  if (choice !== 'buyers' && previewerReady(p)) return 'previewer';
  return null;
}

/** One person in a campaign's audience */
export interface AudiencePerson {
  email: string;
  audience: AudienceKind;
  petName: string | null;
  animal: Animal | null;
  breedId: string | null;
  coatId: string | null;
  birthday: Birthday | null;
  sign: ZodiacKey | null;
  photo: PhotoRef;
  /** the preview request (previewers only) */
  requestId: string | null;
  lastOfferAt: number | null;
  /** previewers: a paid order since the request (always false here, they would not be in the audience otherwise); buyers: not applicable */
  hasBoughtSince: boolean;
  photoWordsShownAt: number | null;
  photoWordsSource: string | null;
  offers: OfferFacts[];
}

const NO_PET: Omit<PetInfo, 'birthday' | 'quizSign'> = { name: null, animal: null, breedId: null, coatId: null };

/** A birthday from the best place we have it: the saved pet, else what they told us on the preview card, else through the link in an offer email */
export function birthdayOf(p: PersonFacts, fromPet: Birthday | null | undefined): Birthday | null {
  if (fromPet) return fromPet;
  const fromRequests = p.requests.filter(r => r.birthday).sort((a, b) => b.createdAt - a.createdAt)[0]?.birthday ?? null;
  return fromRequests ?? p.prefBirthday ?? null;
}

/** The pure core: who is in the audience, as what, with which photo, birthday and sign. `choice` narrows it (a campaign's own audience field). */
export function buildAudience(people: PersonFacts[], now: number, opts: { graceDays: number; audience?: AudienceChoice }): AudiencePerson[] {
  const out: AudiencePerson[] = [];
  for (const p of people) {
    const kind = audienceOf(p, now, opts.graceDays, opts.audience ?? 'both');
    if (!kind) continue;
    const shown = typeof p.photoWordsShownAt === 'number' ? p.photoWordsShownAt : null;
    const base = { email: p.email, audience: kind, lastOfferAt: lastOfferSent(p) || null, photoWordsShownAt: shown, photoWordsSource: p.photoWordsSource ?? null, offers: p.offers };
    if (kind === 'buyer') {
      const b = p.buyer!;
      const birthday = birthdayOf(p, b.pet.birthday);
      out.push({ ...base, petName: b.pet.name, animal: b.pet.animal, breedId: b.pet.breedId, coatId: b.pet.coatId, birthday, sign: signOfBirthday(birthday) ?? b.pet.quizSign, photo: b.photo, requestId: null, hasBoughtSince: false });
    } else {
      const req = previewerReady(p)!;
      const pet = req.pet ?? NO_PET;
      const birthday = birthdayOf(p, null);
      out.push({ ...base, petName: pet.name, animal: pet.animal, breedId: pet.breedId, coatId: pet.coatId, birthday, sign: signOfBirthday(birthday), photo: { customImageId: req.sourceImageId, petId: null, source: 'preview' }, requestId: req.id, hasBoughtSince: false });
    }
  }
  return out;
}

/** The audience for a hand-started campaign: the audience rules, no round already queued or sent for it, and the 7-day gap */
export function campaignAudience(people: PersonFacts[], now: number, campaignId: string, opts: { graceDays: number; audience?: AudienceChoice }): AudiencePerson[] {
  const round = `campaign:${campaignId}`;
  const byEmail = new Map(people.map(p => [p.email, p] as const));
  return buildAudience(people, now, opts).filter(a => gapOk(byEmail.get(a.email)!, now) && !a.offers.some(o => o.round === round));
}

/** The queue entry for one audience person */
export function dueFor(a: AudiencePerson, round: string, now: number, eventDate: string | null = null): Due {
  return {
    round: round as Round, requestId: a.requestId, sourceImageId: a.photo.customImageId, sourcePetId: a.photo.source === 'saved_pet' ? a.photo.petId : null,
    dueAt: now, audience: a.audience, eventDate,
  };
}

/** Re-check, right before generating or sending, for a buyer's offer (the previewer re-check is stillAllowed) */
export function stillAllowedBuyer(p: PersonFacts, now: number, needPhoto = false): { ok: true } | { ok: false; reason: string } {
  if (!p.canEmail) return { ok: false, reason: 'No longer subscribed to offers' };
  if (stopped(p)) return { ok: false, reason: 'Offers stopped for this person' };
  if (optedOut(p)) return { ok: false, reason: 'They asked us not to reuse their photo' };
  if (typeof p.photoWordsShownAt !== 'number') return { ok: false, reason: 'They have not been shown the photo wording' };
  if (needPhoto && !p.buyer) return { ok: false, reason: 'There is no usable photo any more' };
  return { ok: true };
}

/**
 * The one-off "Tell past buyers" notice goes ONLY to: a paid order, subscribed to offers, a usable photo, not yet shown the photo
 * wording (no photo_words_shown_at), not stopped and not opted out. Never to anyone who unsubscribed.
 */
export function noticeAudience(people: PersonFacts[]): PersonFacts[] {
  return people.filter(p => p.isBuyer === true && p.canEmail && !!p.buyer && typeof p.photoWordsShownAt !== 'number' && !optedOut(p) && !stopped(p));
}
