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
import { DAY_MS, MIN_GAP_DAYS, MIN_PICTURES } from './settings';

export interface RequestFacts {
  id: string;
  createdAt: number;                // ms
  photoOffersOk: boolean;
  marketingConfirmedAt: number | null;
  offersStoppedAt: number | null;
  sourceImageId: string;
  /** the source preview is complete AND still has its pet photo */
  sourceUsable: boolean;
}

export interface OfferFacts {
  round: string;                    // '1' | '2' | 'campaign:<id>'
  status: string;
  requestId: string;
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
}

export type Round = '1' | '2' | `campaign:${string}`;
export interface Due { round: Round; requestId: string; sourceImageId: string; dueAt: number }

const stopped = (p: PersonFacts) => p.requests.some(r => r.offersStoppedAt !== null);
const boughtSince = (p: PersonFacts, since: number) => p.paidOrders.some(t => t >= since);
const lastOfferSent = (p: PersonFacts) => p.offers.reduce((m, o) => (o.sentAt !== null && o.sentAt > m ? o.sentAt : m), 0);
const gapOk = (p: PersonFacts, now: number) => now - lastOfferSent(p) >= MIN_GAP_DAYS * DAY_MS;

/** The person's most recent request that could start offers (day count left to the caller) */
function latestUsable(p: PersonFacts): RequestFacts | null {
  const ok = p.requests.filter(r => r.photoOffersOk && r.marketingConfirmedAt !== null && r.offersStoppedAt === null && r.sourceUsable);
  return ok.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
}

export function round1Due(p: PersonFacts, now: number, round1Days: number): Due | null {
  if (!p.canEmail || stopped(p) || p.offers.some(o => o.round === '1')) return null;
  const req = latestUsable(p);
  if (!req) return null;
  const dueAt = req.marketingConfirmedAt! + round1Days * DAY_MS;
  if (now < dueAt || boughtSince(p, req.createdAt) || !gapOk(p, now)) return null;
  return { round: '1', requestId: req.id, sourceImageId: req.sourceImageId, dueAt };
}

export function round2Due(p: PersonFacts, now: number, round2Days: number): Due | null {
  if (!p.canEmail || stopped(p) || p.offers.some(o => o.round === '2')) return null;
  const r1 = p.offers.find(o => o.round === '1' && o.sentAt !== null);
  if (!r1) return null;
  const req = p.requests.find(r => r.id === r1.requestId);
  if (!req || !req.sourceUsable) return null;
  const dueAt = r1.sentAt! + round2Days * DAY_MS;
  if (now < dueAt || boughtSince(p, req.createdAt) || !gapOk(p, now)) return null;
  return { round: '2', requestId: req.id, sourceImageId: req.sourceImageId, dueAt };
}

/** A hand-started campaign: same rules as round 1 minus the day count, plus the 7-day gap; once per campaign per person */
export function campaignDue(p: PersonFacts, now: number, campaignId: string): Due | null {
  const round: Round = `campaign:${campaignId}`;
  if (!p.canEmail || stopped(p) || p.offers.some(o => o.round === round)) return null;
  const req = latestUsable(p);
  if (!req || boughtSince(p, req.createdAt) || !gapOk(p, now)) return null;
  return { round, requestId: req.id, sourceImageId: req.sourceImageId, dueAt: now };
}

/** Which offer, if any, is due now (round 1 before round 2; never both in one run) */
export function dueNow(p: PersonFacts, now: number, s: { round1Days: number; round2Days: number }): Due | null {
  return round1Due(p, now, s.round1Days) ?? round2Due(p, now, s.round2Days);
}

/** An offer that is about to be generated or sent: is it still allowed? (checked again at each step) */
export function stillAllowed(p: PersonFacts, requestId: string): { ok: true } | { ok: false; reason: string } {
  if (!p.canEmail) return { ok: false, reason: 'No longer subscribed to offers' };
  if (stopped(p)) return { ok: false, reason: 'Offers stopped for this person' };
  const req = p.requests.find(r => r.id === requestId);
  if (!req) return { ok: false, reason: 'The preview request is gone' };
  if (!req.sourceUsable) return { ok: false, reason: 'The preview or its photo is no longer there' };
  if (boughtSince(p, req.createdAt)) return { ok: false, reason: 'They have bought since' };
  return { ok: true };
}

/** An offer needs at least this many good pictures to be ready */
export const hasEnoughPictures = (good: number, min = MIN_PICTURES) => good >= min;
