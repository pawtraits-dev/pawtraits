/**
 * Audiences: grouping, scanner stages and the Meta CSV (no database, no network).
 * Run: npx tsx scripts/test-audiences.ts
 */
import {
  groupBuyers, groupPreviewers, groupScanners, scannerStage, toMetaCsv, csvField, countryCode, dateBounds, designTitle,
  applySegmentFilter, segmentFacets, scannerFacets, scannerBreakdown, previewerBreakdown, pctLabel, emptyNames, withoutSeg,
  type OrderRow, type ScanRow, type ScannerContext, type PreviewRequestRow, type SegmentNames, type PreviewMeta,
} from '../lib/marketing/audiences';

let pass = 0, fail = 0;
const ok = (name: string, cond: unknown) => { if (cond) pass++; else { fail++; console.log('FAIL', name); } };

// ---- Buyers: grouped by lower-cased email
const locs = new Map([['L1', 'Camden'], ['L2', 'Greenwich']]);
const order = (o: Partial<OrderRow> & { id: string }): OrderRow => ({ customer_email: 'a@x.com', total_amount: 1000, created_at: '2026-10-01T10:00:00Z', ...o });
const buyers = groupBuyers([
  order({ id: '1', customer_email: 'Sam@Example.com', total_amount: 2500, created_at: '2026-10-01T10:00:00Z', pos_location_id: 'L1', shipping_first_name: 'Sam', shipping_last_name: 'Old', shipping_postcode: 'N1 1AA' }),
  order({ id: '2', customer_email: ' sam@example.COM ', total_amount: 1999, created_at: '2026-10-09T10:00:00Z', pos_location_id: 'L2', shipping_first_name: 'Samantha', shipping_last_name: 'New', shipping_postcode: 'NW6 2BB' }),
  order({ id: '3', customer_email: 'other@example.com', total_amount: 500, created_at: '2026-10-05T10:00:00Z' }),
  order({ id: '4', customer_email: '', total_amount: 500 }),
], locs);
ok('buyers: two people', buyers.length === 2);
ok('buyers: newest first', buyers[0].email === 'sam@example.com');
ok('buyers: orders counted case-insensitively', buyers[0].orders === 2);
ok('buyers: total in pounds', buyers[0].totalSpent === 44.99);
ok('buyers: first and last order', buyers[0].firstOrderAt === '2026-10-01T10:00:00Z' && buyers[0].lastOrderAt === '2026-10-09T10:00:00Z');
ok('buyers: stalls from both orders', buyers[0].stalls.join() === 'Camden,Greenwich');
ok('buyers: latest order name and postcode', buyers[0].name === 'Samantha New' && buyers[0].postcode === 'NW6 2BB');
ok('buyers: no stall when none', buyers[1].stalls.length === 0);

// ---- Scanner stage
ok('stage: bought wins', scannerStage({ bought: true, leftEmail: true, madePreview: true }) === 'Bought');
ok('stage: email beats preview', scannerStage({ bought: false, leftEmail: true, madePreview: true }) === 'Left an email');
ok('stage: preview', scannerStage({ bought: false, leftEmail: false, madePreview: true }) === 'Made a preview');
ok('stage: scanned only', scannerStage({ bought: false, leftEmail: false, madePreview: false }) === 'Scanned only');

const scan = (s: Partial<ScanRow> & { id: string; visitor_id: string }): ScanRow =>
  ({ stock_ref: 1001, location_id: 'L1', location_code: 'CAMDEN', is_repeat: false, order_id: null, created_at: '2026-10-01T10:00:00Z', ...s });
const ctx = (over: Partial<ScannerContext> = {}): ScannerContext => ({
  locNames: locs, paidOrderIds: new Set(['O1']), paidOrderScanIds: new Set(['S-linked']), paidOrderVisitors: new Set(['V-guest']),
  emailVisitors: new Set(['V-email']), previewVisitors: new Set(['V-preview', 'V-email']), ...over,
});
const scanners = groupScanners([
  scan({ id: 'S1', visitor_id: 'V-only' }),
  scan({ id: 'S2', visitor_id: 'V-only', is_repeat: true, created_at: '2026-10-01T10:10:00Z', stock_ref: 1002 }),
  scan({ id: 'S3', visitor_id: 'V-only', created_at: '2026-10-03T10:00:00Z', stock_ref: 1002 }),
  scan({ id: 'S4', visitor_id: 'V-only', created_at: '2026-10-04T10:00:00Z', stock_ref: 1003, location_id: 'L2' }),
  scan({ id: 'S5', visitor_id: 'V-only', created_at: '2026-10-05T10:00:00Z', stock_ref: 1004 }),
  scan({ id: 'S6', visitor_id: 'V-email' }),
  scan({ id: 'S7', visitor_id: 'V-preview' }),
  scan({ id: 'S8', visitor_id: 'V-order', order_id: 'O1' }),
  scan({ id: 'S-linked', visitor_id: 'V-linked' }),
  scan({ id: 'S9', visitor_id: 'V-guest' }),
  scan({ id: 'S10', visitor_id: 'V-unpaid', order_id: 'O-not-paid' }),
  scan({ id: 'S11', visitor_id: 'V-nostall', location_id: null, location_code: 'NEWCODE' }),
], ctx());
const byV = (v: string) => scanners.find(s => s.visitorId === v)!;
ok('scanners: one row per visitor', scanners.length === 8);
ok('scanners: scanned only', byV('V-only').stage === 'Scanned only');
ok('scanners: left an email beats preview', byV('V-email').stage === 'Left an email');
ok('scanners: made a preview', byV('V-preview').stage === 'Made a preview');
ok('scanners: scan.order_id on a paid order', byV('V-order').stage === 'Bought');
ok('scanners: order references scan via qr_scan_id', byV('V-linked').stage === 'Bought');
ok('scanners: order made on this device', byV('V-guest').stage === 'Bought');
ok('scanners: unpaid order is not bought', byV('V-unpaid').stage === 'Scanned only');
ok('scanners: counts', byV('V-only').scans === 5 && byV('V-only').newScans === 4);
ok('scanners: first and last', byV('V-only').firstScanAt === '2026-10-01T10:00:00Z' && byV('V-only').lastScanAt === '2026-10-05T10:00:00Z');
ok('scanners: up to 3 designs, most scanned first', byV('V-only').designs.join() === '#1002,#1001,#1003');
ok('scanners: stalls by name', byV('V-only').stalls.join() === 'Camden,Greenwich');
ok('scanners: raw code when stall unknown', byV('V-nostall').stalls.join() === 'NEWCODE');
ok('scanners: newest first', scanners[0].visitorId === 'V-only');

// ---- Preview emailers
const req = (r: Partial<PreviewRequestRow> & { id: string }): PreviewRequestRow => ({
  custom_image_id: 'C1', email: 'p@x.com', guest_session_id: null, pos_location_id: null, last_sent_at: null, opened_at: null, created_at: '2026-10-01T10:00:00Z', ...r,
});
const prev = groupPreviewers([
  req({ id: 'a', email: 'p@x.com', custom_image_id: 'C1', last_sent_at: '2026-10-01T10:01:00Z' }),
  req({ id: 'b', email: 'P@X.com', custom_image_id: 'C2', created_at: '2026-10-02T10:00:00Z', last_sent_at: '2026-10-02T10:01:00Z', opened_at: '2026-10-03T00:00:00Z', pos_location_id: 'L1' }),
  req({ id: 'c', email: 'bought@x.com', created_at: '2026-09-01T10:00:00Z' }),
], {
  boughtEmails: new Set(['bought@x.com']), marketing: new Map([['p@x.com', 'subscribed' as const]]), locNames: locs,
  designs: new Map([['C2', { title: 'Sir Biscuit', stockRef: 1005, thumb: null }]]),
});
ok('previewers: grouped by email', prev.length === 2 && prev[0].email === 'p@x.com');
ok('previewers: counts, opened, stall, design', prev[0].previews === 2 && prev[0].opened && prev[0].stall === 'Camden' && prev[0].design?.title === 'Sir Biscuit');
ok('previewers: marketing default is not asked', prev[1].marketing === 'not asked' && prev[0].marketing === 'subscribed');
ok('previewers: hasBought', prev[1].hasBought && !prev[0].hasBought);
ok('previewers: last sent', prev[0].lastSentAt === '2026-10-02T10:01:00Z');

// ---- Meta CSV
const csv = toMetaCsv([
  { email: 'yes@x.com', marketing: 'subscribed', firstName: 'Ann', lastName: "O'Neil", postcode: 'N1 1AA', country: 'United Kingdom', totalSpent: 44.9 },
  { email: 'no@x.com', marketing: 'unsubscribed', totalSpent: 10 },
  { email: 'never@x.com', marketing: 'not asked', totalSpent: 10 },
  { email: 'prev@x.com', marketing: 'subscribed' },
  { email: 'q@x.com', marketing: 'subscribed', firstName: 'Quote "Q", Jr', lastName: '=HYPERLINK("x")', postcode: '+44', country: '', totalSpent: 0 },
  { email: 'ie@x.com', marketing: 'subscribed', country: 'Ireland', totalSpent: 5 },
]);
const lines = csv.trimEnd().split('\n');
ok('csv: header exact', lines[0] === 'email,fn,ln,zip,country,value');
ok('csv: only subscribed rows', lines.length === 5 && !csv.includes('no@x.com') && !csv.includes('never@x.com'));
ok('csv: full row', lines[1] === "yes@x.com,Ann,O'Neil,N1 1AA,GB,44.90");
ok('csv: value empty for preview emailer', lines[2] === 'prev@x.com,,,,GB,');
ok('csv: quoting and formula guard', lines[3] === `q@x.com,"Quote ""Q"", Jr","'=HYPERLINK(""x"")",'+44,GB,0.00`);
ok('csv: known country', lines[4] === 'ie@x.com,,,,IE,5.00');
ok('csv: empty list is header only', toMetaCsv([]) === 'email,fn,ln,zip,country,value\n');
ok('csvField: guards = + - @', ['=1', '+1', '-1', '@a'].every(s => csvField(s) === `'${s}`));
ok('csvField: plain untouched', csvField('hello') === 'hello' && csvField(null) === '');
ok('country: blank is GB, unknown is blank, code kept', countryCode('') === 'GB' && countryCode('Atlantis') === '' && countryCode('fr') === 'FR');

// ---- Small helpers
const b = dateBounds('2026-10-01', '2026-10-31');
ok('dates: inclusive end', b.fromTs === '2026-10-01T00:00:00.000Z' && b.toTs === '2026-11-01T00:00:00.000Z');
ok('dates: bad input ignored', dateBounds('nope', null).fromTs === null);
ok('designTitle', designTitle('**Sir Biscuit** at the races') === 'Sir Biscuit' && designTitle(null) === 'Untitled design');

// ---- Segments: breed, coat, design
const names: SegmentNames = {
  designs: new Map([
    ['IMG-lab', { id: 'IMG-lab', title: 'Sir Biscuit', stockRef: 1001, breedId: 'B-lab', coatId: 'C-black', thumb: null }],
    ['IMG-pug', { id: 'IMG-pug', title: 'Lady Pug', stockRef: 1002, breedId: 'B-pug', coatId: 'C-fawn', thumb: null }],
    ['IMG-none', { id: 'IMG-none', title: 'Mystery', stockRef: 1003, breedId: null, coatId: null, thumb: null }],
  ]),
  breeds: new Map([['B-lab', 'Labrador'], ['B-pug', 'Pug'], ['B-cav', 'Cavalier']]),
  coats: new Map([['C-black', 'Black'], ['C-fawn', 'Fawn'], ['C-red', 'Red']]),
};
const sctx = (over: Partial<ScannerContext> = {}): ScannerContext => ({
  locNames: locs, paidOrderIds: new Set(), paidOrderScanIds: new Set(), paidOrderVisitors: new Set(['V-buyer']),
  emailVisitors: new Set(['V-mail']), previewVisitors: new Set(['V-mail', 'V-prev']), names, ...over,
});
const segScans = [
  scan({ id: 'A1', visitor_id: 'V-two', image_id: 'IMG-lab', stock_ref: 1001 }),
  scan({ id: 'A2', visitor_id: 'V-two', image_id: 'IMG-lab', stock_ref: 1001, is_repeat: true }),
  scan({ id: 'A3', visitor_id: 'V-two', image_id: 'IMG-pug', stock_ref: 1002 }),
  scan({ id: 'B1', visitor_id: 'V-mail', image_id: 'IMG-pug', stock_ref: 1002 }),
  scan({ id: 'C1', visitor_id: 'V-buyer', image_id: 'IMG-lab', stock_ref: 1001 }),
  scan({ id: 'D1', visitor_id: 'V-prev', image_id: 'IMG-none', stock_ref: 1003 }),
  scan({ id: 'E1', visitor_id: 'V-gone', image_id: null, stock_ref: 1999 }),
];
const sRows = groupScanners(segScans, sctx());
const sv = (v: string) => sRows.find(r => r.visitorId === v)!;
ok('segments: scanner row shows most scanned design with breed and coat', sv('V-two').topDesign?.title === 'Sir Biscuit' && sv('V-two').breed?.name === 'Labrador' && sv('V-two').coat?.name === 'Black');
ok('segments: +1 more when two designs', sv('V-two').moreDesigns === 1 && sv('V-mail').moreDesigns === 0);
ok('segments: image with no breed gives no breed label', sv('V-prev').breed === null && sv('V-prev').topDesign?.stockRef === 1003);
ok('segments: scan without an image has no design', sv('V-gone').topDesign === null);
const labF = applySegmentFilter(sRows, { breed: 'B-lab' }).map(r => r.visitorId).sort().join();
const pugF = applySegmentFilter(sRows, { breed: 'B-pug' }).map(r => r.visitorId).sort().join();
ok('filter: scanner of two breeds matches the first breed', labF === 'V-buyer,V-two');
ok('filter: scanner of two breeds matches the second breed', pugF === 'V-mail,V-two');
ok('filter: coat and design', applySegmentFilter(sRows, { coat: 'C-fawn' }).length === 2 && applySegmentFilter(sRows, { design: 'IMG-none' }).length === 1);
ok('filter: all filters must match', applySegmentFilter(sRows, { breed: 'B-lab', coat: 'C-fawn' }).map(r => r.visitorId).join() === 'V-two');
ok('filter: empty filter keeps everything', applySegmentFilter(sRows, {}).length === sRows.length);

// facets are computed on rows BEFORE the segment filter, so choosing a breed does not empty the dropdowns
const facets = scannerFacets(sRows, names);
const afterFilter = applySegmentFilter(sRows, { breed: 'B-lab' });
ok('facets: all breeds present, sorted, with counts', facets.breeds.map(b => `${b.name}:${b.count}`).join() === 'Labrador:2,Pug:2');
ok('facets: unknown is not an option', facets.designs.every(d => d.id !== null) && facets.designs.length === 3);
ok('facets: designs carry title and ref', facets.designs.find(d => d.id === 'IMG-lab')?.stockRef === 1001);
ok('facets: taken before the filter keep the other breed', afterFilter.length === 2 && segmentFacets(sRows, names).breeds.some(b => b.id === 'B-pug'));
ok('facets: taken after the filter would have dropped it (so the route must not)', !segmentFacets(afterFilter, names).breeds.some(b => b.id === 'B-cav') && segmentFacets(afterFilter, names).breeds.length === 2);

const bb = scannerBreakdown(sRows, 'breed', false, names);
const row = (id: string | null) => bb.find(r => r.id === id)!;
ok('breakdown: visitor of two breeds appears in both rows', row('B-lab').scanners === 1 && row('B-pug').scanners === 2);
ok('breakdown: scans counted per breed', row('B-lab').scans === 2 && row('B-pug').scans === 2);
ok('breakdown: sorted by scans, descending', bb[0].scans >= bb[1].scans);
ok('breakdown: Unknown row where breed missing, and last', row(null).name === 'Unknown' && row(null).scanners === 2 && bb[bb.length - 1].id === null);
ok('breakdown: made a preview, left email', row('B-pug').madePreview === 1 && row('B-pug').leftEmail === 1);
ok('breakdown: scan to preview is progressed / scanners', row('B-pug').scanToPreview === '50%');
ok('breakdown: Bought ignores the include-bought toggle', row('B-lab').bought === 1 && scannerBreakdown(sRows, 'breed', true, names).find(r => r.id === 'B-lab')!.bought === 1);
ok('breakdown: buyers left out of the other columns when hidden', row('B-lab').scanners === 1 && scannerBreakdown(sRows, 'breed', true, names).find(r => r.id === 'B-lab')!.scanners === 2);
ok('breakdown: include-bought counts buyer as progressed', scannerBreakdown(sRows, 'breed', true, names).find(r => r.id === 'B-lab')!.scanToPreview === '50%');
const onlyBuyer = scannerBreakdown(applySegmentFilter(sRows, { design: 'IMG-lab' }).filter(r => r.visitorId === 'V-buyer'), 'design', false, names)[0];
ok('breakdown: zero scanners shows a dash but still counts the buyer', onlyBuyer.scanners === 0 && onlyBuyer.scanToPreview === '–' && onlyBuyer.bought === 1);
ok('pctLabel: dash on zero', pctLabel(0, 0) === '–' && pctLabel(1, 3) === '33%' && pctLabel(0, 4) === '0%');
const byDesign = scannerBreakdown(sRows, 'design', false, names);
ok('breakdown: by design has a title and ref, and an Unknown for no image', byDesign.find(r => r.id === 'IMG-pug')?.stockRef === 1002 && byDesign.find(r => r.id === null)!.scanners === 1);
ok('breakdown: by coat', scannerBreakdown(sRows, 'coat', false, names).find(r => r.id === 'C-black')!.scanners === 1);
ok('withoutSeg removes the internal lists', !('seg' in withoutSeg(sRows)[0]));
ok('scanners without names are all unknown', scannerBreakdown(groupScanners(segScans, sctx({ names: undefined })), 'breed', true, emptyNames()).length === 1);

// previews: pet breed, else design breed
const pmeta = new Map<string, PreviewMeta>([
  ['C-pet', { catalogImageId: 'IMG-lab', petBreedId: 'B-cav', petCoatId: 'C-red' }],
  ['C-nopet', { catalogImageId: 'IMG-pug', petBreedId: null, petCoatId: null }],
  ['C-nobreed', { catalogImageId: 'IMG-none', petBreedId: null, petCoatId: null }],
  ['C-old', { catalogImageId: 'IMG-lab', petBreedId: 'B-cav', petCoatId: null }],
]);
const pRows = groupPreviewers([
  req({ id: 'p1', email: 'pet@x.com', custom_image_id: 'C-pet', last_sent_at: '2026-10-01T10:01:00Z', opened_at: '2026-10-02T00:00:00Z' }),
  req({ id: 'p2', email: 'nopet@x.com', custom_image_id: 'C-nopet', last_sent_at: '2026-10-01T10:01:00Z' }),
  req({ id: 'p3', email: 'nobreed@x.com', custom_image_id: 'C-nobreed', last_sent_at: '2026-10-01T10:01:00Z' }),
  req({ id: 'p4', email: 'buyer@x.com', custom_image_id: 'C-old', last_sent_at: '2026-10-01T10:01:00Z' }),
  req({ id: 'p5', email: 'buyer@x.com', custom_image_id: 'C-nopet', created_at: '2026-10-05T10:00:00Z', last_sent_at: '2026-10-05T10:01:00Z' }),
], {
  boughtEmails: new Set(['buyer@x.com']), marketing: new Map([['pet@x.com', 'subscribed' as const], ['nopet@x.com', 'subscribed' as const]]),
  locNames: locs, designs: new Map(), meta: pmeta, names,
});
const pv = (e: string) => pRows.find(r => r.email === e)!;
ok('preview: pet breed wins over the design breed', pv('pet@x.com').breed?.name === 'Cavalier' && !pv('pet@x.com').breed?.fromDesign);
ok('preview: coat is the pet coat when stored', pv('pet@x.com').coat?.name === 'Red' && !pv('pet@x.com').coat?.fromDesign);
ok('preview: falls back to the design breed and coat, marked as design', pv('nopet@x.com').breed?.name === 'Pug' && pv('nopet@x.com').breed?.fromDesign === true && pv('nopet@x.com').coat?.name === 'Fawn' && pv('nopet@x.com').coat?.fromDesign === true);
ok('preview: unknown when neither has a breed', pv('nobreed@x.com').breed === null && pv('nobreed@x.com').designId === 'IMG-none');
ok('preview: latest emailed preview decides', pv('buyer@x.com').breed?.name === 'Pug' && pv('buyer@x.com').designId === 'IMG-pug');
ok('preview filter: by the effective breed', applySegmentFilter(pRows, { breed: 'B-pug' }).map(r => r.email).sort().join() === 'buyer@x.com,nopet@x.com');
const pb = previewerBreakdown(pRows, 'breed', false, names);
const prow = (id: string | null) => pb.find(r => r.id === id)!;
ok('preview breakdown: people, opened, subscribed', prow('B-cav').people === 1 && prow('B-cav').opened === 1 && prow('B-cav').subscribed === 1);
ok('preview breakdown: buyers hidden from people but counted as bought', prow('B-pug').people === 1 && prow('B-pug').bought === 1);
ok('preview breakdown: include-bought adds them to people', previewerBreakdown(pRows, 'breed', true, names).find(r => r.id === 'B-pug')!.people === 2);
ok('preview breakdown: Unknown row last', pb[pb.length - 1].id === null && pb[pb.length - 1].people === 1);
ok('preview breakdown: sorted by people', pb.every((r, i) => i === 0 || pb[i - 1].id === null || r.id === null || pb[i - 1].people >= r.people));
ok('preview facets: before filter, from the effective breed', segmentFacets(pRows, names).breeds.map(b => b.name).join() === 'Cavalier,Pug');

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
