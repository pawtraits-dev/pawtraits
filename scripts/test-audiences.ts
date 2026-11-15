/**
 * Audiences: grouping, scanner stages and the Meta CSV (no database, no network).
 * Run: npx tsx scripts/test-audiences.ts
 */
import {
  groupBuyers, groupPreviewers, groupScanners, scannerStage, toMetaCsv, csvField, countryCode, dateBounds, designTitle,
  type OrderRow, type ScanRow, type ScannerContext, type PreviewRequestRow,
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

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
