// Run: NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x SUPABASE_SERVICE_ROLE_KEY=x CLOUDINARY_CLOUD_NAME=x CLOUDINARY_API_KEY=x CLOUDINARY_API_SECRET=x NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=x npx tsx scripts/test-offers.ts   (no network, no database)
import { audienceOf, buildAudience, buyerReady, campaignAudience, campaignDue, dueFor, dueNow, hasEnoughPictures, noticeAudience, round1Due, round2Due, stillAllowed, stillAllowedBuyer, type PersonFacts, type RequestFacts } from '../lib/offers/eligibility';
import { pickZodiacCard, plainPortrait, rankDesigns, rootOf, suitableCount, zodiacOfferPicks, type DesignRow, type RankInput } from '../lib/offers/select-designs';
import { MIN_BIRTHDAY_LEAD_DAYS, birthdayDue, birthdayFromDate, birthdayIn, cleanBirthday, eventPassed, nextBirthday, offerLabel, nextSignStart, pickAutomatic, signOfBirthday, signOfRound, utcDay, zodiacDue } from '../lib/offers/dates';
import { chooseBuyerPhoto, cloudinaryIdFromUrl } from '../lib/offers/photo';
import { birthdayAskUrl, birthdayFromForm, signBirthdayToken, verifyBirthdayToken } from '../lib/offers/birthday';
import { CAMPAIGN_EMAIL, NOTICE_EMAIL } from '../lib/offers/copy';
import { offerWords } from '../lib/offers/send';
import { checkoutWords } from '../lib/marketing/preferences';
import { CHECKOUT_CONSENT_VERSION } from '../lib/marketing/consent-copy';
import { signOfferToken, verifyOfferToken, offerUrl } from '../lib/offers/link';
import { signPreviewToken } from '../lib/previews/email-link';
import { OFFER_EMAIL } from '../lib/offers/copy';
import { offerSubject } from '../lib/offers/send';
import { dayUsage } from '../lib/offers/usage';
import { parseDesignIds } from '../lib/offers/parse';
import { isOriginalRow } from '../lib/catalog/originals';
import { computeLowestPrices, gbp } from '../lib/pricing/lowest-prices';
import { PREVIEW_COPY, PREVIEW_EMAIL } from '../lib/previews/copy';
import { DAY_MS, MIN_GAP_DAYS } from '../lib/offers/settings';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra?: unknown) => { if (cond) pass++; else { fail++; console.log('FAIL', name, extra ?? ''); } };
const now = Date.UTC(2026, 11, 1, 12);
const S = { round1Days: 3, round2Days: 14 };

// ---- eligibility
const req = (over: Partial<RequestFacts> = {}): RequestFacts => ({
  id: 'r1', createdAt: now - 5 * DAY_MS, photoOffersOk: true, marketingConfirmedAt: now - 4 * DAY_MS, offersStoppedAt: null, sourceImageId: 'img1', sourceUsable: true, ...over,
});
const person = (over: Partial<PersonFacts> = {}): PersonFacts => ({ email: 'a@b.co', requests: [req()], canEmail: true, paidOrders: [], offers: [], ...over });

ok('due for round 1 four days after opening', dueNow(person(), now, S)?.round === '1');
ok('round 1 names the request and the preview whose photo is used', dueNow(person(), now, S)?.requestId === 'r1' && dueNow(person(), now, S)?.sourceImageId === 'img1');
ok('an old-wording request (photo_offers_ok false) is never eligible', dueNow(person({ requests: [req({ photoOffersOk: false })] }), now, S) === null
  && campaignDue(person({ requests: [req({ photoOffersOk: false })] }), now, 'c1') === null);
ok('not confirmed (link never opened) is not eligible', dueNow(person({ requests: [req({ marketingConfirmedAt: null })] }), now, S) === null);
ok('too soon: 2 days after opening', dueNow(person({ requests: [req({ marketingConfirmedAt: now - 2 * DAY_MS })] }), now, S) === null);
ok('exactly 3 days is due', dueNow(person({ requests: [req({ marketingConfirmedAt: now - 3 * DAY_MS })] }), now, S)?.round === '1');
ok('the day count is a setting', dueNow(person({ requests: [req({ marketingConfirmedAt: now - 4 * DAY_MS })] }), now, { ...S, round1Days: 5 }) === null);
ok('unsubscribed (cannot be emailed about offers) is not eligible, for any round', dueNow(person({ canEmail: false }), now, S) === null && campaignDue(person({ canEmail: false }), now, 'c1') === null);
ok('bought since the request: not eligible', dueNow(person({ paidOrders: [now - 2 * DAY_MS] }), now, S) === null && campaignDue(person({ paidOrders: [now - 2 * DAY_MS] }), now, 'c1') === null);
ok('an order from before the request does not stop offers', dueNow(person({ paidOrders: [now - 40 * DAY_MS] }), now, S)?.round === '1');
ok('offers stopped (on any of their requests) is not eligible', dueNow(person({ requests: [req(), req({ id: 'r2', offersStoppedAt: now - DAY_MS })] }), now, S) === null);
ok('the preview or photo gone: not eligible', dueNow(person({ requests: [req({ sourceUsable: false })] }), now, S) === null);
ok('already has a round 1 row (any status): not queued again', dueNow(person({ offers: [{ round: '1', status: 'failed', requestId: 'r1', sentAt: null }] }), now, S) === null);

// one per email per round: several previews, the most recent eligible one is used
const many = person({ requests: [
  req({ id: 'old', createdAt: now - 20 * DAY_MS, marketingConfirmedAt: now - 19 * DAY_MS, sourceImageId: 'imgOld' }),
  req({ id: 'new', createdAt: now - 6 * DAY_MS, marketingConfirmedAt: now - 5 * DAY_MS, sourceImageId: 'imgNew' }),
  req({ id: 'newest-unusable', createdAt: now - 5 * DAY_MS, marketingConfirmedAt: now - 4 * DAY_MS, sourceImageId: 'imgGone', sourceUsable: false }),
  req({ id: 'newest-oldwording', createdAt: now - 4 * DAY_MS, marketingConfirmedAt: now - 4 * DAY_MS, photoOffersOk: false }),
] });
const d = dueNow(many, now, S);
ok('several previews: ONE offer, from the most recent eligible request', d?.round === '1' && d.requestId === 'new' && d.sourceImageId === 'imgNew', d);

// round 2
const sent1 = (daysAgo: number): PersonFacts => person({ offers: [{ round: '1', status: 'sent', requestId: 'r1', sentAt: now - daysAgo * DAY_MS }] });
ok('round 2 not due 13 days after round 1 was sent', dueNow(sent1(13), now, S) === null);
ok('round 2 due 14 days after round 1 was sent', dueNow(sent1(14), now, S)?.round === '2');
ok('round 2 counts from the SENT time, not the opening', round2Due(person({ requests: [req({ marketingConfirmedAt: now - 60 * DAY_MS })], offers: [{ round: '1', status: 'sent', requestId: 'r1', sentAt: now - 5 * DAY_MS }] }), now, 14) === null);
ok('round 2 needs round 1 sent: a skipped round 1 gives no round 2', round2Due(person({ offers: [{ round: '1', status: 'skipped', requestId: 'r1', sentAt: null }] }), now, 14) === null);
ok('round 2 only if they have not bought', dueNow({ ...sent1(20), paidOrders: [now - 2 * DAY_MS] }, now, S) === null);
ok('round 2 not queued twice', dueNow(person({ offers: [{ round: '1', status: 'sent', requestId: 'r1', sentAt: now - 20 * DAY_MS }, { round: '2', status: 'queued', requestId: 'r1', sentAt: null }] }), now, S) === null);
ok('round 2 uses the same preview as round 1', round2Due(sent1(15), now, 14)?.sourceImageId === 'img1');
ok('round 1 comes before round 2 and never both', (() => { const x = person({ requests: [req({ marketingConfirmedAt: now - 30 * DAY_MS })] }); return dueNow(x, now, S)?.round === '1'; })());

// 7-day gap since the last offer email of any kind
ok('minimum gap is 7 days', MIN_GAP_DAYS === 7);
const gap = (daysAgo: number, round = 'campaign:x') => person({ offers: [{ round, status: 'sent', requestId: 'r1', sentAt: now - daysAgo * DAY_MS }] });
ok('a campaign email 6 days ago blocks round 1; 7 days ago does not', dueNow(gap(6), now, S) === null && dueNow(gap(7), now, S)?.round === '1');
ok('round 2 is held back by a campaign sent 3 days ago', dueNow(person({ offers: [{ round: '1', status: 'sent', requestId: 'r1', sentAt: now - 20 * DAY_MS }, { round: 'campaign:x', status: 'sent', requestId: 'r1', sentAt: now - 3 * DAY_MS }] }), now, S) === null);

// campaigns: no day count, but the gap, once per campaign
ok('campaign: due right after opening (no day count)', campaignDue(person({ requests: [req({ marketingConfirmedAt: now - 60_000 })] }), now, 'c1')?.round === 'campaign:c1');
ok('campaign: a round 1 sent 3 days ago blocks it (gap)', campaignDue(sent1(3), now, 'c1') === null && campaignDue(sent1(8), now, 'c1') !== null);
ok('campaign: once per campaign per person', campaignDue(person({ offers: [{ round: 'campaign:c1', status: 'failed', requestId: 'r1', sentAt: null }] }), now, 'c1') === null && campaignDue(person({ offers: [{ round: 'campaign:c1', status: 'sent', requestId: 'r1', sentAt: now - 30 * DAY_MS }] }), now, 'c2') !== null);

// the re-check before generating and sending
ok('re-check: fine', stillAllowed(person(), 'r1').ok === true);
ok('re-check: unsubscribed, stopped, bought, photo gone all refuse', !stillAllowed(person({ canEmail: false }), 'r1').ok && !stillAllowed(person({ requests: [req({ offersStoppedAt: now })] }), 'r1').ok
  && !stillAllowed(person({ paidOrders: [now] }), 'r1').ok && !stillAllowed(person({ requests: [req({ sourceUsable: false })] }), 'r1').ok && !stillAllowed(person(), 'nope').ok);
ok('at least 2 good pictures', !hasEnoughPictures(0) && !hasEnoughPictures(1) && hasEnoughPictures(2) && hasEnoughPictures(3));

// ---- ranking
const D = (id: string, over: Partial<DesignRow> = {}): DesignRow => ({
  id, variationOf: null, isOriginal: true, title: `Design ${id}`, animal: 'dog', isPublic: true, listed: true, framed: false, caption: false, words: false, kit: false,
  multiPet: false, wraparound: false, hasPicture: true, customerMade: false, ...over,
});
const input = (over: Partial<RankInput> = {}): RankInput => ({
  designs: [D('a'), D('b'), D('c'), D('d'), D('e'), D('f')], sales: [], previews: [], petBreedId: 'lab', petBreedName: 'Labrador', petAnimal: 'dog', excludeDesignIds: [], ...over,
});
const ids = (r: { id: string }[]) => r.map(x => x.id).join(',');

let r = rankDesigns(input({ sales: [
  { designId: 'a', breedId: 'lab', qty: 1 }, { designId: 'b', breedId: 'lab', qty: 3 }, { designId: 'c', breedId: 'pug', qty: 9 }, { designId: 'd', breedId: null, qty: 4 }, { designId: 'e', breedId: null, qty: 2 },
], previews: [{ designId: 'f', count: 7 }, { designId: 'a', count: 50 }] }));
ok('same-breed best sellers first, then overall best sellers, then most previewed', ids(r) === 'b,a,c,d,e,f', ids(r));
ok('the reason says why', r[0].reason.includes('Labrador') && r[2].reason.startsWith('Best seller overall') && r[5].reason.startsWith('Popular to preview'), r.map(x => x.reason));
ok('with nothing sold or previewed there is nothing to offer', ids(rankDesigns(input())) === '');
ok('thin sales: fills from previews', ids(rankDesigns(input({ sales: [{ designId: 'a', breedId: 'lab', qty: 1 }], previews: [{ designId: 'c', count: 5 }, { designId: 'd', count: 9 }] }))) === 'a,d,c');
ok('ties are broken by overall sales, then id (stable)', ids(rankDesigns(input({ sales: [{ designId: 'a', breedId: 'lab', qty: 2 }, { designId: 'b', breedId: 'lab', qty: 2 }, { designId: 'b', breedId: null, qty: 5 }] }))) === 'b,a');

const rows = [D('o1'), D('v1', { variationOf: 'o1', isOriginal: false }), D('o2'), D('o3'), D('o4')];
ok('sales of a version are credited to its original; only originals are offered', ids(rankDesigns(input({ designs: rows, sales: [{ designId: 'v1', breedId: 'lab', qty: 5 }, { designId: 'o2', breedId: 'lab', qty: 1 }] }))) === 'o1,o2', ids(rankDesigns(input({ designs: rows, sales: [{ designId: 'v1', breedId: 'lab', qty: 5 }] }))));
ok('rootOf follows variation_of', rootOf('v1', new Map(rows.map(x => [x.id, x] as const))) === 'o1');
const sales = (...xs: string[]) => xs.map((designId, i) => ({ designId, breedId: 'lab', qty: 10 - i }));
ok('a design already previewed is left out, and so is its whole family (by original)', ids(rankDesigns(input({ designs: rows, sales: sales('o1', 'o2', 'o3'), excludeDesignIds: ['o1'] }))) === 'o2,o3'
  && ids(rankDesigns(input({ designs: rows, sales: sales('o1', 'o2', 'o3'), excludeDesignIds: ['v1'] }))) === 'o2,o3');
ok('framed card designs are left out', ids(rankDesigns(input({ designs: [D('a', { framed: true }), D('b')], sales: sales('a', 'b') }))) === 'b');
ok('anything that is not a plain portrait is left out (caption plate, words, kit, several pets, mug, customer-made, hidden, link-only, no picture)',
  ['caption', 'words', 'kit', 'multiPet', 'wraparound', 'customerMade'].every(k => ids(rankDesigns(input({ designs: [D('a', { [k]: true } as any), D('b')], sales: sales('a', 'b') }))) === 'b')
  && ids(rankDesigns(input({ designs: [D('a', { isPublic: false }), D('b', { listed: false }), D('c', { hasPicture: false }), D('d')], sales: sales('a', 'b', 'c', 'd') }))) === 'd');
ok('plainPortrait', plainPortrait(D('a')) && !plainPortrait(D('a', { framed: true })));
ok('the other animal is left out when the animal is known; kept when it is not', ids(rankDesigns(input({ designs: [D('a', { animal: 'cat' }), D('b', { animal: 'dog' }), D('c', { animal: null })], sales: sales('a', 'b', 'c') }))) === 'b,c'
  && ids(rankDesigns(input({ designs: [D('a', { animal: 'cat' }), D('b', { animal: 'dog' })], sales: sales('a', 'b'), petAnimal: null }))) === 'a,b'
  && ids(rankDesigns(input({ designs: [D('a', { animal: 'cat' }), D('b', { animal: 'dog' })], sales: sales('a', 'b'), petAnimal: 'cat' }))) === 'a');
ok('a campaign draws only from its own set (same exclusions), then in its own order', ids(rankDesigns(input({ campaignDesignIds: ['d', 'c', 'a'], excludeDesignIds: ['a'], sales: sales('b') }))) === 'd,c'
  && rankDesigns(input({ campaignDesignIds: ['d', 'c'] }))[0].reason === 'Chosen for this campaign'
  && ids(rankDesigns(input({ campaignDesignIds: ['d', 'c', 'a'], sales: [{ designId: 'a', breedId: null, qty: 3 }] }))) === 'a,d,c');
ok('a campaign design that is framed or hidden is still left out', ids(rankDesigns(input({ designs: [D('a', { framed: true }), D('b', { isPublic: false }), D('c')], campaignDesignIds: ['a', 'b', 'c'] }))) === 'c');
ok('sales of designs no longer in the catalogue are ignored', ids(rankDesigns(input({ sales: [{ designId: 'gone', breedId: 'lab', qty: 99 }, { designId: 'a', breedId: null, qty: 1 }] }))) === 'a');
ok('an original is recognised like onlyOriginals()', isOriginalRow({}) && !isOriginalRow({ variation_of: 'x' }) && !isOriginalRow({ tags: ['team-variant'] }) && !isOriginalRow({ cloudinary_public_id: 'pawtraits/variations/abc' }) && isOriginalRow({ tags: ['dog'], cloudinary_public_id: 'pawtraits/catalog/abc' }));

// ---- offer link token
const offerId = '0b6f1c2e-3d4a-4e5f-8a9b-1c2d3e4f5a6b', imgId = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const t = signOfferToken(offerId, imgId, now);
ok('offer token verifies and carries the offer and the picture', JSON.stringify(verifyOfferToken(t, now + 1000)) === JSON.stringify({ ok: true, offerId, imageId: imgId }));
ok('offer token carries no address', !/@/.test(t));
ok('valid for 30 days, then expired', verifyOfferToken(t, now + 29 * DAY_MS).ok && (verifyOfferToken(t, now + 31 * DAY_MS) as any).reason === 'expired');
const [o1, i1, e1, s1] = t.split('.');
ok('tampered signature, expiry, offer, picture or shape is bad',
  (verifyOfferToken(`${o1}.${i1}.${e1}.${s1}x`, now) as any).reason === 'bad'
  && (verifyOfferToken(`${o1}.${i1}.${(parseInt(e1, 36) + 1e9).toString(36)}.${s1}`, now) as any).reason === 'bad'
  && (verifyOfferToken(`${o1}.2c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f.${e1}.${s1}`, now) as any).reason === 'bad'
  && (verifyOfferToken(`1b6f1c2e-3d4a-4e5f-8a9b-1c2d3e4f5a6b.${i1}.${e1}.${s1}`, now) as any).reason === 'bad'
  && (verifyOfferToken('rubbish', now) as any).reason === 'bad' && (verifyOfferToken(undefined, now) as any).reason === 'bad' && (verifyOfferToken(`${o1}.${i1}..${s1}`, now) as any).reason === 'bad');
ok('a preview link token is not an offer token', (verifyOfferToken(signPreviewToken(offerId, now), now) as any).reason === 'bad');
ok('link shape', offerUrl('https://pawtraits.pics/', offerId, imgId, now) === `https://pawtraits.pics/po/${t}`);

// ---- subject and wording
ok('subject with a pet name; the number matches the pictures', offerSubject('Biscuit', 3) === "Pawcasso couldn't resist: 3 more of Biscuit" && offerSubject('Biscuit', 2) === "Pawcasso couldn't resist: 2 more of Biscuit");
ok('subject without a pet name', offerSubject(null, 3) === "Pawcasso couldn't resist: 3 more Pawtraits of your pet" && offerSubject(null, 2) === "Pawcasso couldn't resist: 2 more Pawtraits of your pet");
ok('a campaign subject overrides it; blank does not', offerSubject('Biscuit', 3, 'Christmas is coming') === 'Christmas is coming' && offerSubject('Biscuit', 3, '  ') === OFFER_EMAIL.subject('Biscuit', 3));
ok('email copy: pet not dog, no exclamation marks, no promises of money back or discount', ![OFFER_EMAIL.heading('Biscuit'), OFFER_EMAIL.heading(null), OFFER_EMAIL.preheader, OFFER_EMAIL.intro(null), OFFER_EMAIL.why(null), OFFER_EMAIL.subject(null, 3)].some(s => /!|\bdog\b|money.?back|discount/i.test(s)));
ok('why line', OFFER_EMAIL.why('Biscuit') === 'You asked us to email a preview of Biscuit and said yes to the occasional treat.');
ok('price line only from a real price', OFFER_EMAIL.priceLine(gbp(1500)) === 'Prints from £15.' && OFFER_EMAIL.priceLine(null) === null);
ok('lowest price comes from the catalogue rows', computeLowestPrices([{ id: 'p', is_active: true, product_type: 'print' }], [{ product_id: 'p', country_code: 'GB', sale_price: 1250, is_current: true }]).lowestPrint === 1250);
ok('the new card wording, exactly', PREVIEW_COPY.line === "Send me this design, and the occasional special treat. We'll keep your pet's photo so Pawcasso can paint them into a few more. Say 'Stop it' at any time and we will be very obedient.");
ok('the signed-in line does not mention the photo, and the email line matches the new voice', !/photo/.test(PREVIEW_COPY.lineSignedIn) && /keep your pet's photo/.test(PREVIEW_EMAIL.marketingLine) && !/photo/.test(PREVIEW_EMAIL.marketingLineV1));

// ---- daily cap bookkeeping, pasted ids
const ago = (h: number) => new Date(now - h * 3600_000).toISOString();
ok('day usage: generating counts, older than a day does not, a replacement adds one', dayUsage([
  { status: 'generating', generated_at: null, designs: [] },
  { status: 'ready', generated_at: ago(2), designs: [{ replacedAt: ago(1) }, { id: 'x' }] },
  { status: 'sent', generated_at: ago(30), designs: [{ replacedAt: ago(29) }] },
  { status: 'ready', generated_at: ago(5), designs: [] },
], now) === 4);
ok('pasted design ids and links', parseDesignIds(`https://pawtraits.pics/customise/${offerId}?src=x\n${imgId.toUpperCase()}\n${offerId}`).join() === [offerId, imgId].join());

// =============================================================================================
// Birthday and zodiac campaigns, and buyers

const day = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d, 13, 30);   // a time of day that must not matter
// ---- birthdays: the window
let bd = birthdayDue({ month: 3, day: 20 }, day(2027, 2, 27), 21);
ok('birthday: due 21 days before (27 Feb for 20 Mar)', bd?.round === 'birthday:2027' && bd.daysUntil === 21 && bd.eventDate === '2027-03-20', bd);
ok('birthday: 22 days before is not due yet; 6 days before is due', birthdayDue({ month: 3, day: 20 }, day(2027, 2, 26), 21) === null && birthdayDue({ month: 3, day: 20 }, day(2027, 3, 14), 21)?.daysUntil === 6);
ok('birthday: learned too late (fewer than 5 days to go) is skipped this year; exactly 5 is still due', MIN_BIRTHDAY_LEAD_DAYS === 5 && birthdayDue({ month: 3, day: 20 }, day(2027, 3, 16), 21) === null && birthdayDue({ month: 3, day: 20 }, day(2027, 3, 15), 21)?.daysUntil === 5 && birthdayDue({ month: 3, day: 20 }, day(2027, 3, 20), 21) === null);
ok('birthday: the day after it, the next one is a year off (no offer)', birthdayDue({ month: 3, day: 20 }, day(2027, 3, 21), 21) === null && nextBirthday({ month: 3, day: 20 }, day(2027, 3, 21)).year === 2028);
ok('birthday: year roll-over: 5 Jan, seen on 20 Dec, is the January of NEXT year', (() => { const b = birthdayDue({ month: 1, day: 5 }, day(2026, 12, 20), 21); return b?.round === 'birthday:2027' && b.eventDate === '2027-01-05' && b.daysUntil === 16; })());
ok('birthday: seen in January after the day has passed, the round is that same year only for the next one', birthdayDue({ month: 1, day: 5 }, day(2027, 1, 6), 21) === null);
ok('birthday: 1 Jan seen on 12 Dec is round birthday:2027', birthdayDue({ month: 1, day: 1 }, day(2026, 12, 12), 21)?.round === 'birthday:2027');
ok('29 Feb: in a leap year it is 29 Feb, otherwise 28 Feb', new Date(birthdayIn({ month: 2, day: 29 }, 2028)).toISOString().slice(0, 10) === '2028-02-29' && new Date(birthdayIn({ month: 2, day: 29 }, 2027)).toISOString().slice(0, 10) === '2027-02-28');
ok('29 Feb: due 21 days before 28 Feb in 2027 (7 Feb), and before 29 Feb in 2028', birthdayDue({ month: 2, day: 29 }, day(2027, 2, 7), 21)?.eventDate === '2027-02-28' && birthdayDue({ month: 2, day: 29 }, day(2027, 2, 6), 21) === null
  && birthdayDue({ month: 2, day: 29 }, day(2028, 2, 8), 21)?.eventDate === '2028-02-29' && birthdayDue({ month: 2, day: 29 }, day(2028, 2, 7), 21) === null);
ok('29 Feb: on 1 Mar 2027 the next one is in 2028', nextBirthday({ month: 2, day: 29 }, day(2027, 3, 1)).year === 2028);
ok('birthday: the days-before setting is honoured', birthdayDue({ month: 3, day: 20 }, day(2027, 3, 1), 10) === null && birthdayDue({ month: 3, day: 20 }, day(2027, 3, 10), 10)?.daysUntil === 10 && birthdayDue(null, now, 21) === null);
ok('birthday: UTC calendar days, whatever the time of day', birthdayDue({ month: 3, day: 20 }, Date.UTC(2027, 1, 27, 0, 0, 1), 21)?.daysUntil === 21 && birthdayDue({ month: 3, day: 20 }, Date.UTC(2027, 1, 27, 23, 59, 59), 21)?.daysUntil === 21);

// ---- impossible birthdays are ignored
ok('cleanBirthday: 30 Feb, month 13, day 0, nothing: ignored', cleanBirthday({ month: 2, day: 30 }) === null && cleanBirthday({ month: 13, day: 1 }) === null && cleanBirthday({ month: 4, day: 31 }) === null && cleanBirthday({ month: 1, day: 0 }) === null && cleanBirthday({}) === null && cleanBirthday(null) === null && cleanBirthday({ month: '', day: '' }) === null);
ok('cleanBirthday: real dates kept, numbers as text too; 29 Feb needs no year; 29 Feb of a year that had none is ignored', JSON.stringify(cleanBirthday({ month: '3', day: '20' })) === JSON.stringify({ month: 3, day: 20, year: null })
  && cleanBirthday({ month: 2, day: 29 })?.day === 29 && cleanBirthday({ month: 2, day: 29, year: 2020 })?.year === 2020 && cleanBirthday({ month: 2, day: 29, year: 2021 }) === null);
ok('cleanBirthday: a silly year is dropped, the day and month kept', cleanBirthday({ month: 3, day: 20, year: 1850 })?.year === null && cleanBirthday({ month: 3, day: 20, year: 'abc' })?.month === 3);
ok('birthdayFromDate reads pets.birthday as written', JSON.stringify(birthdayFromDate('2019-01-20')) === JSON.stringify({ month: 1, day: 20, year: 2019 }) && birthdayFromDate(null) === null && birthdayFromDate('nonsense') === null);
ok('the form: day, month, optional year; an impossible date is null', (() => { const f = (o: any) => ({ get: (k: string) => o[k] }); return birthdayFromForm(f({ day: '14', month: '2' }))?.day === 14 && birthdayFromForm(f({ day: '30', month: '2' })) === null && birthdayFromForm(f({ day: '14' })) === null; })());
ok('the sign comes from the birthday (day and month are enough), 20 Jan is Aquarius, 19 Jan Capricorn', signOfBirthday({ month: 1, day: 20 }) === 'aquarius' && signOfBirthday({ month: 1, day: 19 }) === 'capricorn' && signOfBirthday({ month: 7, day: 23 }) === 'leo' && signOfBirthday(null) === null);

// ---- zodiac: the window and round keys
let zd = zodiacDue('leo', day(2027, 7, 9), 14);
ok('zodiac: Leo starts 23 Jul, due 14 days before (9 Jul), round zodiac:leo:2027', zd?.round === 'zodiac:leo:2027' && zd.eventDate === '2027-07-23' && zd.daysUntil === 14, zd);
ok('zodiac: 15 days before is too early; the day it starts is still due; the day after it is not', zodiacDue('leo', day(2027, 7, 8), 14) === null && zodiacDue('leo', day(2027, 7, 23), 14)?.daysUntil === 0 && zodiacDue('leo', day(2027, 7, 24), 14) === null);
ok('zodiac: Capricorn starts 22 Dec: due from 8 Dec, round zodiac:capricorn:<that year>', zodiacDue('capricorn', day(2026, 12, 8), 14)?.round === 'zodiac:capricorn:2026' && zodiacDue('capricorn', day(2026, 12, 7), 14) === null && zodiacDue('capricorn', day(2026, 12, 22), 14)?.eventDate === '2026-12-22');
ok('zodiac: Capricorn in January (the season is on) looks ahead to the next December, not due', zodiacDue('capricorn', day(2027, 1, 5), 14) === null && nextSignStart('capricorn', day(2027, 1, 5))?.year === 2027 && zodiacDue('capricorn', day(2027, 1, 5), 14) === null);
ok('zodiac: Aquarius (20 Jan) is due from 6 Jan, across the new year for a big setting (30 days: 21 Dec), round names the year it starts', zodiacDue('aquarius', day(2027, 1, 6), 14)?.round === 'zodiac:aquarius:2027' && zodiacDue('aquarius', day(2026, 12, 21), 30)?.round === 'zodiac:aquarius:2027' && zodiacDue('aquarius', day(2026, 12, 20), 30) === null);
ok('zodiac: no sign or an unknown sign: nothing', zodiacDue(null, now, 14) === null && nextSignStart('nope' as any, now) === null && signOfRound('zodiac:leo:2027') === 'leo' && signOfRound('birthday:2027') === null);

// ---- birthday beats zodiac in the same week
const cfg = { birthdayOn: true, zodiacOn: true, birthdayDays: 21, zodiacDays: 14 };
const noRounds = () => false;
// Leo starts 23 Jul (window opens 9 Jul); a 20 Jul birthday window opens 29 Jun and is open on 9 Jul
ok('both due: the birthday wins', pickAutomatic({ birthday: { month: 7, day: 20 }, sign: 'leo' }, day(2027, 7, 9) - 0, cfg, noRounds)?.kind === 'birthday');
ok('both due the same week: the birthday wins, the zodiac waits (nothing for the zodiac while the birthday is pending)', (() => {
  const p = { birthday: { month: 7, day: 29 } as any, sign: 'leo' as const };
  const t = day(2027, 7, 9);   // zodiac window open; the birthday (29 Jul) window opens 8 Jul: already open too
  const a = pickAutomatic(p, t, cfg, noRounds);
  return a?.kind === 'birthday';
})());
ok('the birthday window opens within a week: the zodiac waits for it', (() => {
  const p = { birthday: { month: 8, day: 2 } as any, sign: 'leo' as const };   // window opens 12 Jul; on 9 Jul the zodiac is open, the birthday opens in 3 days
  return pickAutomatic(p, day(2027, 7, 9), cfg, noRounds) === null && pickAutomatic(p, day(2027, 7, 12), cfg, noRounds)?.kind === 'birthday';
})());
ok('birthday already queued/sent this year (or its campaign off): the zodiac goes', pickAutomatic({ birthday: { month: 7, day: 29 }, sign: 'leo' }, day(2027, 7, 9), cfg, r => r === 'birthday:2027')?.kind === 'zodiac'
  && pickAutomatic({ birthday: { month: 7, day: 29 }, sign: 'leo' }, day(2027, 7, 9), { ...cfg, birthdayOn: false }, noRounds)?.kind === 'zodiac');
ok('birthday window past its last useful day: the zodiac goes (no waiting for something that cannot happen)', pickAutomatic({ birthday: { month: 7, day: 12 }, sign: 'leo' }, day(2027, 7, 9), cfg, noRounds)?.kind === 'zodiac');
ok('zodiac off: only the birthday; both off: nothing; zodiac already done this year: nothing', pickAutomatic({ birthday: null, sign: 'leo' }, day(2027, 7, 9), { ...cfg, zodiacOn: false }, noRounds) === null
  && pickAutomatic({ birthday: null, sign: 'leo' }, day(2027, 7, 9), { ...cfg, birthdayOn: false, zodiacOn: false }, noRounds) === null && pickAutomatic({ birthday: null, sign: 'leo' }, day(2027, 7, 9), cfg, r => r === 'zodiac:leo:2027') === null
  && pickAutomatic({ birthday: null, sign: 'leo' }, day(2027, 7, 9), cfg, noRounds)?.round === 'zodiac:leo:2027');
ok('an automatic offer is not sent after its day', eventPassed('2027-07-23', day(2027, 7, 23)) === false && eventPassed('2027-07-23', day(2027, 7, 24)) === true && eventPassed(null, now) === false && utcDay(day(2027, 7, 23)) === Date.UTC(2027, 6, 23));

// ---- buyers
const GRACE = 2;
const buyerOf = (over: Partial<PersonFacts> = {}): PersonFacts => ({
  email: 'buyer@b.co', requests: [], canEmail: true, paidOrders: [now - 40 * DAY_MS], offers: [], isBuyer: true,
  buyer: { photo: { customImageId: 'imgB', petId: null, source: 'bought' }, pet: { name: 'Biscuit', animal: 'dog', breedId: 'lab', coatId: null, birthday: null, quizSign: null } },
  photoWordsShownAt: now - 3 * DAY_MS, photoWordsSource: 'checkout', photoOptOutAt: null, prefBirthday: null, ...over,
});
ok('buyer: shown the words more than the grace days ago: in', buyerReady(buyerOf(), now, GRACE) && audienceOf(buyerOf(), now, GRACE) === 'buyer');
ok('buyer: not shown the words: out', !buyerReady(buyerOf({ photoWordsShownAt: null }), now, GRACE) && !buyerReady(buyerOf({ photoWordsShownAt: undefined }), now, GRACE));
ok('buyer: shown but inside the grace days: out; exactly the grace days: in', !buyerReady(buyerOf({ photoWordsShownAt: now - 1 * DAY_MS }), now, GRACE) && !buyerReady(buyerOf({ photoWordsShownAt: now - 2 * DAY_MS + 1000 }), now, GRACE) && buyerReady(buyerOf({ photoWordsShownAt: now - 2 * DAY_MS }), now, GRACE));
ok('buyer: opted out of photo offers: out', !buyerReady(buyerOf({ photoOptOutAt: now - DAY_MS }), now, GRACE));
ok('buyer: unsubscribed (cannot be emailed about offers): out', !buyerReady(buyerOf({ canEmail: false }), now, GRACE));
ok('buyer: no usable photo: out', !buyerReady(buyerOf({ buyer: null }), now, GRACE));
ok('buyer: no paid order: not a buyer', !buyerReady(buyerOf({ isBuyer: false }), now, GRACE));
ok('buyer: offers stopped for them by the owner: out', !buyerReady(buyerOf({ requests: [req({ offersStoppedAt: now - DAY_MS })] }), now, GRACE));
ok('buyers are NOT skipped for having bought (previewers are)', buyerReady(buyerOf({ paidOrders: [now - DAY_MS] }), now, GRACE) && campaignAudience([buyerOf({ paidOrders: [now - DAY_MS] })], now, 'c1', { graceDays: GRACE }).length === 1
  && audienceOf(person({ paidOrders: [now - 2 * DAY_MS] }), now, GRACE) === null);
// both a previewer and a buyer: once, as a buyer
const both = buyerOf({ requests: [req()], paidOrders: [now - 2 * DAY_MS] });
const bothAud = buildAudience([both], now, { graceDays: GRACE });
ok('previewer who is also a buyer counts once, as a buyer, with the buyer photo', bothAud.length === 1 && bothAud[0].audience === 'buyer' && bothAud[0].photo.customImageId === 'imgB' && bothAud[0].requestId === null && bothAud[0].petName === 'Biscuit');
ok('a previewer who bought since and is not (yet) a buyer is out (phase-1 rule)', buildAudience([person({ paidOrders: [now - 2 * DAY_MS] })], now, { graceDays: GRACE }).length === 0);
ok('narrowed by the campaign audience: previewers-only skips buyers; buyers-only skips previewers', buildAudience([buyerOf()], now, { graceDays: GRACE, audience: 'previewers' }).length === 0
  && buildAudience([person()], now, { graceDays: GRACE, audience: 'buyers' }).length === 0 && buildAudience([person()], now, { graceDays: GRACE, audience: 'previewers' })[0].audience === 'previewer'
  && buildAudience([buyerOf()], now, { graceDays: GRACE, audience: 'buyers' })[0].audience === 'buyer');
// the previewer part is exactly phase 1
const pv = buildAudience([person()], now, { graceDays: GRACE })[0];
ok('previewer audience person: request, source preview, no buyer fields', pv.audience === 'previewer' && pv.requestId === 'r1' && pv.photo.customImageId === 'img1' && pv.photo.source === 'preview');
ok('previewers: opted out of photo offers, stopped, unsubscribed, old wording are all out (rounds and campaigns)', [person({ photoOptOutAt: now }), person({ requests: [req({ offersStoppedAt: now })] }), person({ canEmail: false }), person({ requests: [req({ photoOffersOk: false })] })]
  .every(p => audienceOf(p, now, GRACE) === null && dueNow(p, now, S) === null && campaignDue(p, now, 'c1') === null));
ok('previewer rounds 1 and 2 are unchanged by all this', dueNow(person(), now, S)?.round === '1' && dueNow(sent1(14), now, S)?.round === '2' && dueNow(person({ paidOrders: [now - DAY_MS] }), now, S) === null && dueNow(buyerOf({ photoWordsShownAt: now - 5 * DAY_MS }), now, S) === null);
ok('the re-check refuses an opted-out previewer, and for a buyer needs the words shown', !stillAllowed(person({ photoOptOutAt: now }), 'r1').ok && stillAllowedBuyer(buyerOf(), now, true).ok && !stillAllowedBuyer(buyerOf({ photoWordsShownAt: null }), now).ok
  && !stillAllowedBuyer(buyerOf({ photoOptOutAt: now }), now).ok && !stillAllowedBuyer(buyerOf({ canEmail: false }), now).ok && !stillAllowedBuyer(buyerOf({ buyer: null }), now, true).ok);
// campaigns: the 7-day gap and once per campaign still apply to buyers
ok('campaign audience: the 7-day gap and once per campaign apply to buyers too', campaignAudience([buyerOf({ offers: [{ round: '1', status: 'sent', requestId: null, sentAt: now - 3 * DAY_MS }] })], now, 'c1', { graceDays: GRACE }).length === 0
  && campaignAudience([buyerOf({ offers: [{ round: 'campaign:c1', status: 'sent', requestId: null, sentAt: now - 30 * DAY_MS }] })], now, 'c1', { graceDays: GRACE }).length === 0
  && campaignAudience([buyerOf({ offers: [{ round: 'birthday:2026', status: 'sent', requestId: null, sentAt: now - 30 * DAY_MS }] })], now, 'c1', { graceDays: GRACE }).length === 1);
const qd = dueFor(buildAudience([buyerOf()], now, { graceDays: GRACE })[0], 'birthday:2027', now, '2027-03-20');
ok('the queue entry of a buyer: no request, the photo, the audience and the day', qd.requestId === null && qd.sourceImageId === 'imgB' && qd.audience === 'buyer' && qd.eventDate === '2027-03-20' && qd.sourcePetId === null);
const petBuyer = buyerOf({ buyer: { photo: { customImageId: null, petId: 'pet1', source: 'saved_pet' }, pet: { name: 'Luna', animal: 'cat', breedId: null, coatId: null, birthday: { month: 1, day: 20, year: 2020 }, quizSign: 'leo' } } });
const pq = buildAudience([petBuyer], now, { graceDays: GRACE })[0];
ok('a saved pet: its id is the source, its birthday wins and the sign comes from it (not the quiz)', dueFor(pq, 'zodiac:aquarius:2027', now).sourcePetId === 'pet1' && dueFor(pq, 'x', now).sourceImageId === null && pq.sign === 'aquarius' && pq.animal === 'cat');
ok('no birthday: the quiz sign is used; where the birthday is known from elsewhere (link in an email, preview card) it is found', buildAudience([buyerOf({ buyer: { ...buyerOf().buyer!, pet: { ...buyerOf().buyer!.pet, quizSign: 'virgo' } } })], now, { graceDays: GRACE })[0].sign === 'virgo'
  && buildAudience([buyerOf({ prefBirthday: { month: 5, day: 5 } })], now, { graceDays: GRACE })[0].sign === 'taurus'
  && buildAudience([person({ requests: [req({ birthday: { month: 12, day: 25 } })] })], now, { graceDays: GRACE })[0].birthday?.day === 25);

// ---- which photo for a buyer
const im = (id: string, over: any = {}) => ({ id, status: 'complete', pet_image_url: `https://x/${id}.jpg`, pet_cloudinary_id: id, created_at: new Date(now - DAY_MS).toISOString(), ...over });
ok('photo: the most recent customisation they BOUGHT first, even when a newer one was only made', chooseBuyerPhoto({ boughtInOrder: [im('b1'), im('b2')], byEmail: [im('m1', { created_at: new Date(now).toISOString() })], pets: [] })?.customImageId === 'b1');
ok('photo: skips a bought one that is not usable (failed, no photo)', chooseBuyerPhoto({ boughtInOrder: [im('b1', { status: 'failed' }), im('b2', { pet_cloudinary_id: null })], byEmail: [], pets: [] }) === null
  && chooseBuyerPhoto({ boughtInOrder: [im('b1', { status: 'failed' }), im('b2')], byEmail: [], pets: [] })?.customImageId === 'b2');
ok('photo: nothing bought: their most recent customisation', (() => { const r = chooseBuyerPhoto({ boughtInOrder: [], byEmail: [im('m1', { created_at: '2026-01-01T00:00:00Z' }), im('m2', { created_at: '2026-06-01T00:00:00Z' }), im('m3', { status: 'generating', created_at: '2026-09-01T00:00:00Z' })], pets: [] }); return r?.customImageId === 'm2' && r.source === 'customisation'; })());
ok('photo: else a saved pet with a photo (most recently updated), never an inactive one or one without a photo', (() => { const r = chooseBuyerPhoto({ boughtInOrder: [], byEmail: [], pets: [{ id: 'p0', primary_photo_url: null }, { id: 'p1', primary_photo_url: 'https://x/p1.jpg', updated_at: '2026-01-01' }, { id: 'p2', primary_photo_url: 'https://x/p2.jpg', updated_at: '2026-05-01' }, { id: 'p3', primary_photo_url: 'https://x/p3.jpg', is_active: false, updated_at: '2026-09-01' }] }); return r?.petId === 'p2' && r.customImageId === null && r.source === 'saved_pet'; })());
ok('photo: none usable = null (the person is not in the audience)', chooseBuyerPhoto({ boughtInOrder: [], byEmail: [], pets: [] }) === null);
ok('a saved pet photo URL: the Cloudinary id is worked out, otherwise a placeholder (as the customise route)', cloudinaryIdFromUrl('https://res.cloudinary.com/demo/image/upload/v123/pets/abc.jpg') === 'pets/abc' && cloudinaryIdFromUrl('https://elsewhere.co/a.jpg') === 'non-cloudinary' && cloudinaryIdFromUrl(null) === 'non-cloudinary');

// ---- the notice audience
const withNotice = (over: Partial<PersonFacts> = {}) => buyerOf({ photoWordsShownAt: null, photoWordsSource: null, ...over });
ok('notice: subscribed buyers with a photo who have not been shown the words', noticeAudience([withNotice()]).length === 1);
ok('notice: not those already shown (checkout, preview card, or an earlier notice), nor the unsubscribed, opted out, photo-less, stopped or non-buyers', noticeAudience([
  buyerOf(), buyerOf({ photoWordsSource: 'notice_email' }), withNotice({ canEmail: false }), withNotice({ photoOptOutAt: now }), withNotice({ buyer: null }), withNotice({ isBuyer: false }), withNotice({ requests: [req({ offersStoppedAt: now })] }),
]).length === 0);
ok('notice: a mixed list keeps exactly the right people', noticeAudience([withNotice({ email: 'a@x.co' }), buyerOf({ email: 'b@x.co' }), withNotice({ email: 'c@x.co', canEmail: false }), withNotice({ email: 'd@x.co' })]).map(p => p.email).join() === 'a@x.co,d@x.co');
ok('a stale checkout page (old version or none) is never marked as having shown the photo words; only the current version is', !checkoutWords(undefined).photoShown && !checkoutWords('2026-11').photoShown && checkoutWords(CHECKOUT_CONSENT_VERSION).photoShown);

// ---- designs: birthday and zodiac
const dd = (id: string, over: Partial<DesignRow> = {}) => D(id, over);
const zrows = [dd('z-dog', { framed: true, animal: 'dog' }), dd('z-cat', { framed: true, animal: 'cat' }), dd('z-nope', { framed: true, animal: 'dog', isPublic: false }), dd('a'), dd('b'), dd('c'), dd('f2', { framed: true, animal: 'dog' })];
const zin = { ...input({ designs: zrows, sales: [{ designId: 'a', breedId: null, qty: 5 }, { designId: 'b', breedId: null, qty: 4 }, { designId: 'c', breedId: null, qty: 3 }, { designId: 'f2', breedId: null, qty: 99 }, { designId: 'z-dog', breedId: null, qty: 1 }] }), signDesignIds: ['z-dog', 'z-cat', 'z-nope'], animal: 'dog' as const };
let zp = zodiacOfferPicks(zin);
ok('zodiac: the sign\'s framed card for the pet\'s animal is FIRST, then 2 best sellers', zp.length === 3 && zp[0].id === 'z-dog' && zp[0].card === true && zp.slice(1).map(p => p.id).join() === 'a,b', zp);
ok('zodiac: never another framed design (even a big seller), and the card is the only one marked', zp.slice(1).every(p => !zrows.find(r => r.id === p.id)!.framed && !p.card) && !zp.some(p => p.id === 'f2'));
ok('zodiac: a cat gets the cat card; the other animal\'s card is never used', zodiacOfferPicks({ ...zin, animal: 'cat', petAnimal: 'cat' })[0].id === 'z-cat' && pickZodiacCard({ designs: zrows, sales: [], signDesignIds: ['z-dog'], animal: 'cat', excludeDesignIds: [] }) === null);
ok('zodiac: a card already seen is not offered; hidden cards are not offered; no card = no offer', pickZodiacCard({ designs: zrows, sales: [], signDesignIds: ['z-dog'], animal: 'dog', excludeDesignIds: ['z-dog'] }) === null
  && pickZodiacCard({ designs: zrows, sales: [], signDesignIds: ['z-nope'], animal: 'dog', excludeDesignIds: [] }) === null && zodiacOfferPicks({ ...zin, signDesignIds: [] }).length === 0);
ok('birthday designs: a campaign pool of the birthday collection, the standard exclusions, the animal matched', ids(rankDesigns(input({ designs: [dd('p1'), dd('p2'), dd('p3', { animal: 'cat' }), dd('p4', { framed: true }), dd('p5', { caption: true })], campaignDesignIds: ['p1', 'p2', 'p3', 'p4', 'p5'] }))) === 'p1,p2'
  && suitableCount([dd('p1'), dd('p2'), dd('p3', { animal: 'cat' }), dd('p4', { framed: true })], ['p1', 'p2', 'p3', 'p4'], 'dog') === 2 && suitableCount([dd('p1')], ['p1'], 'dog') === 1 && suitableCount([dd('p1'), dd('p2', { animal: 'cat' })], ['p1', 'p2'], null) === 2);

// ---- the birthday link
const bt = signBirthdayToken(offerId, now);
ok('birthday token verifies, carries the offer and no address, 30 days', JSON.stringify(verifyBirthdayToken(bt, now + 1000)) === JSON.stringify({ ok: true, offerId }) && !/@/.test(bt) && verifyBirthdayToken(bt, now + 29 * DAY_MS).ok && (verifyBirthdayToken(bt, now + 31 * DAY_MS) as any).reason === 'expired');
ok('birthday token: tampered or another kind of token is bad (an offer token, a preview token)', (verifyBirthdayToken(bt + 'x', now) as any).reason === 'bad' && (verifyBirthdayToken('rubbish', now) as any).reason === 'bad' && (verifyBirthdayToken(t, now) as any).reason === 'bad' && (verifyBirthdayToken(signPreviewToken(offerId, now), now) as any).reason === 'bad' && (verifyOfferToken(bt, now) as any).reason === 'bad');
ok('birthday link shape: /po/<token>/birthday', birthdayAskUrl('https://pawtraits.pics/', offerId, now) === `https://pawtraits.pics/po/${bt}/birthday`);

// ---- wording
ok('subjects: birthday', offerSubject('Biscuit', 3, null, 'birthday:2027') === "Biscuit's birthday is coming: Pawcasso got in early" && offerSubject(null, 3, null, 'birthday:2027') === 'A birthday Pawtrait, painted early');
ok('subjects: zodiac', offerSubject('Biscuit', 3, null, 'zodiac:leo:2027') === 'Leo season is coming, and Biscuit is ready' && offerSubject(null, 3, null, 'zodiac:leo:2027') === 'Leo season is coming');
ok('subjects: a campaign subject overrides; rounds 1/2/campaigns unchanged', offerSubject('Biscuit', 3, 'Happy birthday', 'birthday:2027') === 'Happy birthday' && offerSubject('Biscuit', 3, null, '1') === "Pawcasso couldn't resist: 3 more of Biscuit" && offerSubject('Biscuit', 3, null, 'campaign:x') === OFFER_EMAIL.subject('Biscuit', 3));
ok('intro lines: one sentence each, a campaign intro wins, the zodiac never mentions Dr Katrina Warren', (() => {
  const w1 = offerWords('birthday:2027', 'Biscuit'), w2 = offerWords('zodiac:leo:2027', 'Biscuit'), w3 = offerWords('zodiac:leo:2027', null, 'Roar.');
  return w1.intro === "Biscuit's big day is coming up, so Pawcasso got in early with a few party-ready paintings." && /Leo/.test(w2.intro) && w3.intro === 'Roar.' && !/katrina|warren/i.test(JSON.stringify([w2, w3, CAMPAIGN_EMAIL.zodiac.subject('Biscuit', 'Leo'), CAMPAIGN_EMAIL.zodiac.heading('Biscuit', 'Leo')]))
    && offerWords('1', 'Biscuit').intro === OFFER_EMAIL.intro('Biscuit');
})());
ok('the birthday ask line and the notice email subject, exactly', CAMPAIGN_EMAIL.askBirthday('Biscuit').lead === "When's Biscuit's birthday?" && `${CAMPAIGN_EMAIL.askBirthday('Biscuit').lead} ${CAMPAIGN_EMAIL.askBirthday('Biscuit').link} ${CAMPAIGN_EMAIL.askBirthday('Biscuit').tail}` === "When's Biscuit's birthday? Tell us and Pawcasso will paint something for the big day."
  && NOTICE_EMAIL.subject('Biscuit') === 'Pawcasso would love to paint Biscuit again' && NOTICE_EMAIL.subject(null) === 'Pawcasso would love to paint your pet again');
ok('new copy: no exclamation marks, no emoji, "pet" not "dog", no discount', ![CAMPAIGN_EMAIL.birthday.subject('Biscuit'), CAMPAIGN_EMAIL.birthday.intro('Biscuit'), CAMPAIGN_EMAIL.zodiac.intro('Biscuit', 'Leo'), CAMPAIGN_EMAIL.whyBuyer('Biscuit'), CAMPAIGN_EMAIL.whyBuyer(null), ...NOTICE_EMAIL.lines('Biscuit'), ...NOTICE_EMAIL.lines(null), NOTICE_EMAIL.heading('Biscuit'), NOTICE_EMAIL.why].some(x => /!|\bdogs?\b|discount|[\uD83C-\uDBFF][\uDC00-\uDFFF]/.test(x)));
ok('labels on the approval queue', offerLabel('1', null) === 'Round 1' && offerLabel('2', null) === 'Round 2' && offerLabel('birthday:2027', null) === 'Birthday' && offerLabel('zodiac:leo:2027', null) === 'Zodiac: Leo' && offerLabel('campaign:x', 'Christmas 2026') === 'Christmas 2026');

console.log(fail ? `${fail} failed, ${pass} passed` : `${pass} passed`);
process.exit(fail ? 1 : 0);
