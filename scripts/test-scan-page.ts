/**
 * The design page opened from a stall scan: print in hand selected, same size not repeated,
 * More like this order. Pure functions only: no network, no database.
 * Run: npx tsx scripts/test-scan-page.ts
 */
import assert from 'node:assert/strict';
import { STALL_OPTION, defaultSelection, madeToOrderRows, isStallOfferUsable, selectionLine, gbp, type BuyRow } from '../lib/customise/buy-options';
import { mergeMoreLikeThis, needsFallback, type MoreItem } from '../lib/catalog/more-like-this';

let n = 0;
const ok = (cond: unknown, msg: string) => { assert.ok(cond, msg); n++; };
const eq = (a: unknown, b: unknown, msg: string) => { assert.deepEqual(a, b, msg); n++; };

const row = (id: string, size: string, media: string, type = 'print'): BuyRow => ({ id, product_type: type, size_code: size, media_name: media });
const rows: BuyRow[] = [
  row('foam-S', 'S', 'Foamex'), row('foam-M', 'M', 'Foamex'), row('foam-L', 'L', 'Foamex'),
  row('art-M', 'M', 'Art paper'), row('art-L', 'L', 'Art paper'),
  row('dl', '', 'Digital', 'digital_download'),
];
const base = { rows, kind: 'catalog' as const, frame: false, physicalOnly: false, inline: true };

// Stall offer present: the print in hand is selected, whatever size was scanned
eq(defaultSelection({ ...base, stallAvailable: true, scannedSize: 'M' }), [STALL_OPTION], 'stall offer selects print in hand');
eq(defaultSelection({ ...base, stallAvailable: true, scannedSize: null }), [STALL_OPTION], 'stall offer, no size');
// No stall offer: today's defaults
eq(defaultSelection({ ...base, stallAvailable: false, scannedSize: 'L' }), ['foam-L'], 'no offer: scanned size in foamex');
eq(defaultSelection({ ...base, stallAvailable: false, scannedSize: null }), ['foam-M'], 'no offer: medium foamex');
eq(defaultSelection({ ...base, stallAvailable: false, scannedSize: 'XL' }), [], 'no offer, size not sold: nothing ticked (as before)');
eq(defaultSelection({ ...base, stallAvailable: false, kind: 'custom' }), ['dl'], 'custom portrait: download');
eq(defaultSelection({ ...base, rows: [row('dl', '', 'Digital', 'digital_download')], stallAvailable: false }), ['dl'], 'download-only design');
eq(defaultSelection({ ...base, rows: [row('mug', '', 'Mug')], inline: false, physicalOnly: true, stallAvailable: false }), ['mug'], 'single physical product');

// Same-size foamex removed, same size in art paper kept
const left = madeToOrderRows(rows.filter(r => r.product_type !== 'digital_download'), true, 'M').map(r => r.id);
ok(!left.includes('foam-M'), 'same-size foamex removed');
ok(left.includes('art-M'), 'same size in art paper kept');
eq(left, ['foam-S', 'foam-L', 'art-M', 'art-L'], 'other foamex sizes kept');
eq(madeToOrderRows(rows, false, 'M').length, rows.length, 'no stall offer: nothing removed');
ok(madeToOrderRows(rows, true, null).length === rows.length, 'no stall size: nothing removed');
ok(madeToOrderRows(rows, true, 'M').some(r => r.id === 'dl'), 'download row untouched');

// Offer usable
ok(isStallOfferUsable('catalog', { available: true, size: 'M', pricePence: 3000 }), 'offer usable');
ok(!isStallOfferUsable('custom', { available: true, size: 'M', pricePence: 3000 }), 'custom portraits never');
ok(!isStallOfferUsable('catalog', { available: true, size: 'M' }), 'no price');
ok(!isStallOfferUsable('catalog', null), 'no offer');

// Selected line
eq(selectionLine(['The print in your hand · Medium'], 3000), 'The print in your hand · Medium · £30', 'selected line');
eq(selectionLine(['A', 'B'], 4550), 'A + B · £45.50', 'two items');
eq(selectionLine([], 0), 'Nothing chosen yet', 'nothing chosen');
eq(gbp(3000), '£30', 'gbp whole');

// More like this
const it = (id: string): MoreItem => ({ id });
const ids = (l: MoreItem[]) => l.map(i => i.id);
const versions = [it('v1'), it('cur'), it('v2')];
const breed = [it('v2'), it('b1'), it('b2'), it('b3'), it('b4')];
const fallback = [it('f1'), it('b1'), it('f2')];
eq(ids(mergeMoreLikeThis([versions, breed, fallback], 'cur', 4)), ['v1', 'v2', 'b1', 'b2'], 'versions, then breed; no current, no duplicates, capped');
eq(ids(mergeMoreLikeThis([[], breed, fallback], 'cur', 4)), ['v2', 'b1', 'b2', 'b3'], 'no versions: breed');
eq(ids(mergeMoreLikeThis([[it('v1')], [it('b1')], fallback], 'cur', 4)), ['v1', 'b1', 'f1', 'f2'], 'short: fallback fills, deduplicated');
eq(ids(mergeMoreLikeThis([[], [], fallback], 'cur', 4)), ['f1', 'b1', 'f2'], 'design with no breed: fallbacks only');
eq(ids(mergeMoreLikeThis([[], [], []], 'cur', 4)), [], 'nothing found');
eq(ids(mergeMoreLikeThis([versions, breed], 'cur', 2)), ['v1', 'v2'], 'cap applies to versions');
ok(needsFallback(3, 4) && !needsFallback(4, 4), 'fallback only when short');

console.log(`scan-page: ${n} passed`);
