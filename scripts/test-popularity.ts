// Run: npx tsx scripts/test-popularity.ts
import assert from 'node:assert/strict';
import {
  buildBreeds, buildPrints, countVersions, periodRanges, printsCsv, breedsCsv, ratio, resolveRoots,
  type PreviewRecord, type PrintContext, type PrintEvents, type PetNames,
} from '../lib/admin/popularity';
import { matchCoat, parseCoatReply, parseReply } from '../lib/customise/detect-breed';

let failed = 0;
const t = (name: string, fn: () => void) => { try { fn(); console.log('ok  ', name); } catch (e: any) { failed++; console.log('FAIL', name, '\n    ', e.message); } };

// --- roots
t('root through a chain', () => {
  const r = resolveRoots([{ id: 'c', variation_of: 'b' }, { id: 'b', variation_of: 'a' }, { id: 'a', variation_of: null }]);
  assert.equal(r.get('c')!.rootId, 'a'); assert.equal(r.get('b')!.rootId, 'a'); assert.equal(r.get('a')!.rootId, 'a');
});
t('cycle does not loop and members agree', () => {
  const r = resolveRoots([{ id: 'x', variation_of: 'y' }, { id: 'y', variation_of: 'z' }, { id: 'z', variation_of: 'x' }, { id: 'w', variation_of: 'x' }]);
  assert.equal(r.get('x')!.rootId, 'x'); assert.equal(r.get('y')!.rootId, 'x'); assert.equal(r.get('z')!.rootId, 'x'); assert.equal(r.get('w')!.rootId, 'x');
});
t('missing parent ends at the child; unlinked flag only for legacy rows without a link', () => {
  const r = resolveRoots([{ id: 'k', variation_of: 'gone' }, { id: 'old', variation_of: null, legacy: true }, { id: 'o', variation_of: null }]);
  assert.equal(r.get('k')!.rootId, 'k'); assert.equal(r.get('k')!.unlinked, false);
  assert.equal(r.get('old')!.unlinked, true); assert.equal(r.get('o')!.unlinked, false);
});
t('countVersions below a root, cycle safe', () => {
  const m = countVersions(['a'], [{ id: 'b', parent: 'a' }, { id: 'c', parent: 'b' }, { id: 'a', parent: 'c' }]);
  assert.equal(m.get('a'), 2);
});

// --- prints
const now = Date.UTC(2026, 10, 16);
const day = 86_400_000;
const { current, previous } = periodRanges('30', now);
const ctx: PrintContext = {
  versions: new Map([
    ['d1', { rootId: 'd1', unlinked: false, breedId: 'lab' }],
    ['d1-pug', { rootId: 'd1', unlinked: false, breedId: 'pug' }],
    ['d2', { rootId: 'd2', unlinked: false, breedId: 'siam' }],
  ]),
  designs: new Map([['d1', { title: 'Astronaut', stockRef: 1001, thumb: null }], ['d2', { title: 'Chef', stockRef: 1002, thumb: null }]]),
  breeds: new Map([['lab', { name: 'Labrador', animal: 'dog' }], ['pug', { name: 'Pug', animal: 'dog' }], ['siam', { name: 'Siamese', animal: 'cat' }]]),
};
const ago = (d: number) => now - d * day;
const ev: PrintEvents = {
  scans: [
    { at: ago(1), imageId: 'd1', visitor: 'v1', locationId: 's1' },
    { at: ago(2), imageId: 'd1-pug', visitor: 'v1', locationId: 's1' },
    { at: ago(3), imageId: 'd1-pug', visitor: 'v2', locationId: 's2' },
    { at: ago(4), imageId: 'd2', visitor: 'v3', locationId: 's1' },
    { at: ago(40), imageId: 'd1', visitor: 'v9', locationId: 's1' }, // previous period
  ],
  previews: [{ at: ago(1), imageId: 'd1' }, { at: ago(2), imageId: 'd1-pug' }, { at: ago(5), imageId: 'd2' }],
  emails: [{ at: ago(1), imageId: 'd1', locationId: 's1' }],
  sales: [
    { at: ago(1), orderId: 'o1', imageId: 'd1-pug', locationId: 's1', qty: 2, pence: 3000 },
    { at: ago(1), orderId: 'o1', imageId: 'd1', locationId: 's1', qty: 1, pence: 1500 },
    { at: ago(45), orderId: 'o0', imageId: 'd1', locationId: 's1', qty: 1, pence: 1500 },
  ],
};
t('two versions roll into one design', () => {
  const r = buildPrints(ev, ctx, { current, previous });
  assert.equal(r.total, 2);
  const d1 = r.rows[0];
  assert.equal(d1.id, 'd1'); assert.equal(d1.scans, 3); assert.equal(d1.scanners, 2); assert.equal(d1.previews, 2);
  assert.equal(d1.orders, 1); assert.equal(d1.sold, 3); assert.equal(d1.revenue, 45); assert.equal(d1.emails, 1);
  assert.deepEqual(d1.breeds.map(b => [b.breed, b.sold]), [['Pug', 2], ['Labrador', 1]]);
});
t('percentages and zero denominators', () => {
  const r = buildPrints(ev, ctx, { current, previous });
  assert.equal(r.rows[0].scanToPreview, 2 / 3); assert.equal(r.rows[0].previewToOrder, 1 / 2);
  const chef = r.rows[1]; assert.equal(chef.sold, 0); assert.equal(chef.previewToOrder, 0);
  assert.equal(ratio(1, 0), null);
  const none = buildPrints({ ...ev, scans: [], sales: [] }, ctx, { current, previous });
  assert.equal(none.rows[0].scanToPreview, null);
});
t('change on the previous period; none for all time', () => {
  const r = buildPrints(ev, ctx, { current, previous });
  assert.equal(r.rows[0].change, 2); // sold 3 now, 1 before
  const s = buildPrints(ev, ctx, { current, previous, sort: 'scans' });
  assert.equal(s.rows[0].change, 2); // scans 3 now, 1 before
  const all = periodRanges('all', now);
  assert.equal(buildPrints(ev, ctx, { current: all.current, previous: all.previous }).rows[0].change, null);
});
t('stall filter narrows scans and sales, not previews; ratios hidden', () => {
  const r = buildPrints(ev, ctx, { current, previous, locationId: 's2' });
  const d1 = r.rows.find(x => x.id === 'd1')!; assert.equal(d1.scans, 1); assert.equal(d1.sold, 0); assert.equal(d1.previews, 2);
  assert.equal(d1.scanToPreview, null); assert.equal(r.stallFiltered, true);
});
t('animal filter uses the breed of the version', () => {
  const cats = buildPrints(ev, ctx, { current, previous, animal: 'cat' });
  assert.deepEqual(cats.rows.map(r => r.id), ['d2']);
  const dogs = buildPrints(ev, ctx, { current, previous, animal: 'dog' });
  assert.deepEqual(dogs.rows.map(r => r.id), ['d1']);
});
t('print CSV has no personal columns', () => {
  const csv = printsCsv(buildPrints(ev, ctx, { current, previous }).rows);
  assert.ok(csv.startsWith('Design,Stock ref,Versions')); assert.ok(!/email@|visitor/i.test(csv));
});

// --- breeds
const names: PetNames = {
  breeds: new Map([['lab', { name: 'Labrador', animal: 'dog' }], ['pug', { name: 'Pug', animal: 'dog' }], ['siam', { name: 'Siamese', animal: 'cat' }]]),
  coats: new Map([['black', { name: 'Black', animal: 'dog' }], ['yellow', { name: 'Yellow', animal: 'dog' }], ['seal', { name: 'Seal Point', animal: 'cat' }]]),
};
const rec = (d: number, o: Partial<PreviewRecord>): PreviewRecord => ({ at: ago(d), breedId: null, coatId: null, person: null, bought: false, detected: null, ...o });
const recs: PreviewRecord[] = [
  rec(1, { breedId: 'lab', coatId: 'black', person: 'a@x.com', bought: true }),
  rec(2, { breedId: 'lab', coatId: 'black', person: 'a@x.com' }),
  rec(3, { breedId: 'lab', coatId: 'yellow', person: 'b@x.com' }),
  rec(4, { breedId: 'lab', person: 'g1' }),
  rec(5, { breedId: 'siam', coatId: 'seal', person: 'c@x.com' }),
  rec(6, { detected: { name: 'Xoloitzcuintli', matched: false, animal: 'dog' }, person: 'd@x.com' }),
  rec(7, { detected: { name: 'xoloitzcuintli', matched: false, animal: 'dog' }, person: 'e@x.com' }),
  rec(8, { detected: { name: 'Tonkinese', matched: false, animal: 'cat' } }),
  rec(9, {}),
  rec(40, { breedId: 'lab', person: 'old' }), // previous period
];
t('breeds with coats nested, not recognised and coat not known', () => {
  const r = buildBreeds(recs, names, current, previous, null);
  assert.equal(r.summary.previews, 9); assert.equal(r.summary.breedKnown, 5); assert.equal(r.summary.coatKnown, 4);
  const lab = r.rows[0];
  assert.equal(lab.name, 'Labrador'); assert.equal(lab.previews, 4); assert.equal(lab.people, 3); assert.equal(lab.bought, 1);
  assert.equal(lab.change, 3); assert.equal(lab.share, 4 / 9);
  assert.deepEqual(lab.coats.map(c => [c.name, c.previews]), [['Black', 2], ['Yellow', 1], ['Coat not known', 1]]);
  assert.equal(lab.coats[0].share, 0.5);
  assert.equal(r.notRecognised.previews, 4); assert.equal(r.notRecognised.name, 'Not recognised');
});
t('unmatched names counted case-insensitively', () => {
  const r = buildBreeds(recs, names, current, previous, null);
  assert.deepEqual(r.notRecognised.names, [{ name: 'Xoloitzcuintli', count: 2 }, { name: 'Tonkinese', count: 1 }]);
});
t('animal filter on breeds', () => {
  const cats = buildBreeds(recs, names, current, previous, 'cat');
  assert.deepEqual(cats.rows.map(r => r.name), ['Siamese']); assert.equal(cats.notRecognised.previews, 1); assert.equal(cats.summary.previews, 2);
  const dogs = buildBreeds(recs, names, current, previous, 'dog');
  assert.equal(dogs.notRecognised.previews, 2); // the record with no animal at all is left out
});
t('zero previews and all-time change', () => {
  const empty = buildBreeds([], names, current, previous, null);
  assert.equal(empty.summary.breedShare, null); assert.equal(empty.notRecognised.share, null);
  const all = periodRanges('all', now);
  assert.equal(buildBreeds(recs, names, all.current, all.previous, null).rows[0].change, null);
});
t('breeds CSV has counts only', () => {
  const csv = breedsCsv(buildBreeds(recs, names, current, previous, null));
  assert.ok(csv.includes('Labrador,Black,2')); assert.ok(!csv.includes('@'));
});

// --- coat matching and reply parsing (no network)
const coats = [
  { id: 'c1', name: 'Black & White', animal_type: 'dog' as const }, { id: 'c2', name: 'Golden', animal_type: 'dog' as const },
  { id: 'c3', name: 'Golden', animal_type: 'cat' as const }, { id: 'c4', name: 'Seal Point', animal_type: 'cat' as const },
];
t('matchCoat', () => {
  assert.equal(matchCoat(coats, 'dog', 'black and white')?.id, 'c1');
  assert.equal(matchCoat(coats, 'dog', ' Black & White ')?.id, 'c1');
  assert.equal(matchCoat(coats, 'cat', 'Golden')?.id, 'c3');
  assert.equal(matchCoat(coats, 'dog', 'golden coat')?.id, 'c2');
  assert.equal(matchCoat(coats, 'dog', 'Seal Point'), null);
  assert.equal(matchCoat(coats, 'other', 'Golden'), null);
  assert.equal(matchCoat(coats, 'dog', ''), null);
});
t('parseReply and parseCoatReply', () => {
  assert.deepEqual(parseReply('Here: {"animal":"dog","breed":"Pug","confidence":0.9,"coat":"Fawn"}'), { animal: 'dog', breed: 'Pug', confidence: 0.9, coat: 'Fawn' });
  assert.deepEqual(parseReply('{"animal":"bird","breed":"","confidence":7}'), { animal: 'other', breed: '', confidence: 1, coat: '' });
  assert.equal(parseReply('no json'), null); assert.equal(parseReply('{broken'), null);
  assert.deepEqual(parseCoatReply('{"coat":"Black"}'), { coat: 'Black' }); assert.equal(parseCoatReply('nope'), null);
});

if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log('all passed');
