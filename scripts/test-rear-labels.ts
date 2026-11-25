/**
 * Checks for rear labels (lib/fulfillment/rear-labels.ts) and the label sheet drawing (lib/stock/print-labels.ts).
 * No network, no database. Run: npx tsx scripts/test-rear-labels.ts
 * With --sample, also writes tmp-sample.pdf (a 6-label sheet with guides, from the mock-up) for a visual check.
 */
export {};
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { buildRearLabels, sizeCodeOf, sizeTextOf } = require('../lib/fulfillment/rear-labels');
const { itemRef, describeOrderItem } = require('../lib/fulfillment/shared');
const { generatePrintLabels, CL2163 } = require('../lib/stock/print-labels');
const { SITE_URL } = require('../lib/referrals/text');

let passed = 0;
const ok = (cond: unknown, msg: string) => { assert.ok(cond, msg); passed++; };
const eq = (a: unknown, b: unknown, msg: string) => { assert.deepEqual(a, b, msg); passed++; };

const item = (id: string, o: any = {}) => ({
  id, product_id: 'FOAM-PRINT-M', image_id: 'img-' + id, image_title: 'Game Day Glory', quantity: 1,
  product_data: { product_type: 'physical_print', width_cm: 20, height_cm: 30, medium: { name: 'Foamex' }, size_name: 'Medium' }, ...o,
});
const rates = { friendPct: 15, referrerPct: 5 };

// quantity, downloads, mixed
{
  const o = { id: 'o1', order_number: 'PW-1', order_items: [item('a', { quantity: 2 })] };
  const { labels } = buildRearLabels([o], null, rates);
  eq(labels.length, 2, 'quantity 2 gives two labels');
  eq(labels[0], labels[1], 'identical labels');
  const dl = { id: 'o2', order_number: 'PW-2', order_items: [item('d', { product_data: { product_type: 'digital_download' } })] };
  eq(buildRearLabels([dl], null, rates).labels.length, 0, 'download-only gives none');
  const stall = { id: 'o3', order_number: 'PW-3', order_items: [item('s', { product_data: { product_type: 'stall_print' } })] };
  eq(buildRearLabels([stall], null, rates).labels.length, 0, 'stall item gives none');
  const mixed = { id: 'o4', order_number: 'PW-4', order_items: [item('d2', { product_data: { product_type: 'digital_download' } }), item('p1'), item('p2', { quantity: 3 })] };
  eq(buildRearLabels([mixed], null, rates).labels.length, 4, 'mixed order counts only posted items');
  // refs use slip indexing (index within postedItems)
  const refs = buildRearLabels([mixed], null, rates).labels.map((l: any) => l.ref);
  eq(refs, ['PW-4-1', 'PW-4-2', 'PW-4-2', 'PW-4-2'], 'refs match the slip indexing');
  eq(refs[0], itemRef(mixed, 0), 'first ref is itemRef index 0');
}

// split order: labels only for the lines we print ourselves
{
  const split = { id: 'o5', order_number: 'PW-5', gelato_order_id: 'G1', order_items: [item('f', { quantity: 2, fulfillment_provider: 'self_print' }), item('m', { fulfillment_provider: 'gelato' })] };
  const { labels } = buildRearLabels([split], null, rates);
  eq(labels.length, 2, 'split order: two labels for the foamex, none for the Gelato line');
  eq(labels.map((l: any) => l.ref), ['PW-5-1', 'PW-5-1'], 'split order: refs follow our own lines');
}

// pet name
{
  const o = { id: 'o', order_number: 'PW-9', order_items: [item('a')] };
  const k = (name: any) => buildRearLabels([o], null, rates, { petNames: new Map([['a', name]]) }).labels[0].kicker;
  eq(k('Biscuit'), 'MADE FOR BISCUIT', 'pet name');
  eq(k(null), 'PAWTRAITS', 'null pet name');
  eq(k('   '), 'PAWTRAITS', 'blank pet name');
  eq(buildRearLabels([o], null, rates).labels[0].kicker, 'PAWTRAITS', 'no pet map');
  const long = k('Bartholomew Maximilian Fitzgerald the Third');
  ok(long.startsWith('MADE FOR ') && long.length <= 'MADE FOR '.length + 24, 'long pet name cut');
  eq(long, 'MADE FOR BARTHOLOMEW MAXIMILIAN F', 'cut at 24 characters');
}

// size code and text
{
  eq(sizeCodeOf('FOAM-PRINT-M'), 'M', 'M');
  eq(sizeCodeOf('ART-PAPER-XL'), 'XL', 'XL');
  eq(sizeCodeOf('FOAM-PRINT-S'), 'S', 'S');
  eq(sizeCodeOf('MUG-11OZ'), '', 'unknown');
  eq(sizeCodeOf(null), '', 'null product id');
  // Real order lines: product_id is the product's uuid, product_data is the products row
  eq(sizeCodeOf({ product_id: '6f1c2a3b-0000-4000-8000-000000000000', product_data: { size_code: 'm', sku: 'FOAM-PRINT-M' } }), 'M', 'size_code from product_data');
  eq(sizeCodeOf({ product_id: '6f1c2a3b-0000-4000-8000-000000000000', product_data: JSON.stringify({ sku: 'ART-PAPER-XL' }) }), 'XL', 'sku from JSON-string product_data');
  eq(sizeCodeOf({ product_id: '6f1c2a3b-0000-4000-8000-000000000000', product_data: { sku: 'MUG-11OZ' } }), '', 'uuid product, no size');
  eq(sizeTextOf(item('a')), '20×30 cm', 'object product_data');
  eq(sizeTextOf(item('a', { product_data: JSON.stringify({ width_cm: 30, height_cm: 40 }) })), '30×40 cm', 'JSON string product_data');
  const bare = item('a', { product_data: { product_type: 'physical_print', medium: { name: 'Foamex' }, size_name: 'Medium' } });
  eq(sizeTextOf(bare), describeOrderItem(bare), 'missing dims fall back');
  eq(sizeTextOf(item('a', { product_data: '{not json' })), 'Print', 'bad JSON falls back');
}

// referral
{
  const o = { id: 'o', order_number: 'PW-9', order_items: [item('a')] };
  const withRef = buildRearLabels([o], new Map([['o', { code: 'BISCUIT1', shareUrl: 'https://pawtraits.pics/c/BISCUIT1' }]]), rates).labels[0];
  eq(withRef.qrUrl, 'https://pawtraits.pics/c/BISCUIT1', 'QR is the share link');
  ok(withRef.cta.includes('BISCUIT1') && withRef.cta.includes('Give 15%, get 5%'), 'CTA has the code and custom rates');
  const none = buildRearLabels([o], new Map(), rates).labels[0];
  eq(none.qrUrl, SITE_URL, 'fallback QR');
  eq(none.cta, 'Scan to put your own pet in a Pawtrait', 'fallback CTA');
}

// breed
{
  const o = { id: 'o', order_number: 'PW-9', order_items: [item('a'), item('b')] };
  const r = buildRearLabels([o], null, rates, { breeds: new Map([['a', 'Cocker Spaniel']]) }).labels;
  eq(r[0].breed, 'Cocker Spaniel', 'breed passed through');
  eq(r[1].breed, null, 'missing breed is null (the label then shows the title)');
  eq(r[1].title, 'Game Day Glory', 'title kept for the fallback');
  eq(buildRearLabels([o], null, rates).labels[0].breed, null, 'no breed map');
  eq(r[0].ctaMaxLines, 2, 'rear labels may wrap to two lines');
}

// sheet
{
  eq([CL2163.labelWidthMm, CL2163.labelHeightMm, CL2163.marginTopMm, CL2163.marginLeftMm, CL2163.gapXMm, CL2163.gapYMm, CL2163.cornerRadiusMm, CL2163.columns, CL2163.rows],
    [63.5, 38.1, 15.15, 7.75, 2, 0, 1.5, 3, 7], 'CL2163 measurements');
}

// thumbnails
{
  const o = { id: 'o', order_number: 'PW-9', order_items: [item('a'), item('b')] };
  const r = buildRearLabels([o], null, rates, { publicIds: new Map([['a', 'pub/1'], ['b', 'pub/1']]) });
  eq(Array.from(r.thumbKeys.entries()), [['pub/1', 'pub/1']], 'distinct thumbnail keys');
  eq(r.labels[0].thumbnailKey, 'pub/1', 'thumbnail key set');
}

// PDF smoke tests
(async () => {
  const rear = [
    { title: 'Game Day Glory', kicker: 'MADE FOR BISCUIT', sizeCode: 'M', sizeText: '20×30 cm', ref: 'PW-1234-1', qrUrl: 'https://pawtraits.pics/c/BISCUIT1', cta: 'Give 10%, get 10%. Scan to share, or give a friend code BISCUIT1' },
    { title: 'Sir Barksalot of the Royal Garden Party', kicker: 'PAWTRAITS', sizeCode: '', sizeText: 'Foamex · Medium', ref: 'PW-1234-2', qrUrl: 'https://pawtraits.pics', cta: 'Scan to put your own pet in a Pawtrait' },
  ];
  const a = await generatePrintLabels(rear);
  ok(a.length > 1000 && Buffer.from(a.slice(0, 5)).toString() === '%PDF-', 'rear labels PDF');
  const stall = await generatePrintLabels([{ title: 'Game Day Glory', sizeCode: 'M', sizeText: '20×30 cm', qrUrl: 'https://pawtraits.pics/S/1M' }]);
  ok(stall.length > 1000, 'stall-style label PDF');
  const noBreed = await generatePrintLabels([{ title: 'Game Day Glory', breed: '', sizeCode: '', sizeText: '20×30 cm', qrUrl: 'https://pawtraits.pics/S/1M' }]);
  ok(noBreed.length > 1000, 'no breed and no size code still draws');
  const withBreed = await generatePrintLabels([{ title: 'T', breed: 'Cavalier King Charles Spaniel', kicker: 'MADE FOR SIR WIGGLESWORTH', sizeCode: 'XL', sizeText: '40×60 cm', qrUrl: 'https://pawtraits.pics/S/1', cta: 'Scan to purchase, or Pawsonalise with your own pet' }], { showGuides: true });
  ok(withBreed.length > 1000, 'long breed, long kicker, XL, guides');
  const empty = await generatePrintLabels([]);
  ok(empty.length > 500, 'empty sheet');
  if (process.argv.includes('--sample')) {
    const stallCta = 'Scan to purchase, or Pawsonalise with your own pet';
    const share = (c: string) => `Give 10%, get 10%. Scan to share, or give a friend code ${c}`;
    const rearCta = (c: string) => ({ cta: share(c), ctaMaxLines: 2 });
    const mk = (n: number) => { try { return new Uint8Array(fs.readFileSync(`/tmp/thumb${n}.jpg`)); } catch { return null; } };
    const thumbnails = new Map<string, Uint8Array>();
    [0, 1, 2].forEach(n => { const b = mk(n); if (b) thumbnails.set(`t${n}`, b); });
    const t = (n: number) => (thumbnails.has(`t${n}`) ? `t${n}` : null);
    const sample = [
      { title: 'x', breed: 'Labrador Retriever', kicker: 'PAWTRAITS', sizeCode: 'M', sizeText: '20×30 cm', qrUrl: 'https://pawtraits.pics/S/1123M/CAMDEN', thumbnailKey: t(0) },
      { title: 'x', breed: 'Cavalier King Charles Spaniel', kicker: 'PAWTRAITS', sizeCode: 'XL', sizeText: '40×60 cm', qrUrl: 'https://pawtraits.pics/S/1187', thumbnailKey: t(2) },
      { title: 'x', breed: 'British Shorthair', kicker: 'PAWTRAITS', sizeCode: 'S', sizeText: '15×20 cm', qrUrl: 'https://pawtraits.pics/S/1204S/CAMDEN', thumbnailKey: t(1) },
      { title: 'x', breed: 'Cocker Spaniel', kicker: 'MADE FOR BISCUIT', sizeCode: 'M', sizeText: '20×30 cm', ref: 'PW-1234-1', qrUrl: 'https://pawtraits.pics/c/STEVK8M2PQ7X', ...rearCta('STEVK8M2PQ7X'), thumbnailKey: t(2) },
      { title: 'x', breed: 'Maine Coon', kicker: 'PAWTRAITS', sizeCode: 'S', sizeText: '15×20 cm', ref: 'PW-1235-1', qrUrl: 'https://pawtraits.pics', cta: 'Scan to put your own pet in a Pawtrait', ctaMaxLines: 2, thumbnailKey: t(1) },
      { title: 'x', breed: 'Staffordshire Bull Terrier', kicker: 'MADE FOR SIR WIGGLESWORTH', sizeCode: 'L', sizeText: '30×40 cm', ref: 'PW-1236-2', qrUrl: 'https://pawtraits.pics/c/SIRW3K9ZP2QA', ...rearCta('SIRW3K9ZP2QA'), thumbnailKey: t(0) },
    ];
    // the first three are stall labels: the default call to action, one line
    fs.writeFileSync('tmp-sample.pdf', await generatePrintLabels(sample, { showGuides: true, cta: stallCta, thumbnails }));
  }
  console.log(`rear-labels: ${passed} passed`);
})().catch(e => { console.error(e); process.exit(1); });
