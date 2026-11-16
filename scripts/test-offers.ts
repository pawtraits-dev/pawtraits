// Run: NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x SUPABASE_SERVICE_ROLE_KEY=x CLOUDINARY_CLOUD_NAME=x CLOUDINARY_API_KEY=x CLOUDINARY_API_SECRET=x NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=x npx tsx scripts/test-offers.ts   (no network, no database)
import { campaignDue, dueNow, hasEnoughPictures, round1Due, round2Due, stillAllowed, type PersonFacts, type RequestFacts } from '../lib/offers/eligibility';
import { plainPortrait, rankDesigns, rootOf, type DesignRow, type RankInput } from '../lib/offers/select-designs';
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

console.log(fail ? `${fail} failed, ${pass} passed` : `${pass} passed`);
process.exit(fail ? 1 : 0);
