/**
 * Checks for self-print fulfilment (routing, pick-pack-post actions, packing slips, Click & Drop CSV).
 * Uses an in-memory stand-in for Supabase — no network or database needed.
 * Run: NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:1 SUPABASE_SERVICE_ROLE_KEY=x npx tsx scripts/test-self-print-fulfilment.ts
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { applyFulfilmentAction, fulfilmentStage, getFulfilmentQueue } = require('../lib/fulfillment/order-fulfilment');
const { isPostedPrintItem, postedItems } = require('../lib/fulfillment/shared');
const { generatePackingSlips, clickAndDropCsv } = require('../lib/fulfillment/packing-slips');
const { validateSetting } = require('../lib/app-settings');

// ---- tiny in-memory Supabase ------------------------------------------------------
function fakeDb(tables: Record<string, any[]>) {
  const audit: any[] = [];
  const from = (table: string) => {
    const filters: Array<(r: any) => boolean> = [];
    let op: 'select' | 'update' | 'insert' = 'select';
    let patch: any = null;
    const api: any = {
      select: () => api,
      eq: (col: string, val: any) => { filters.push(r => r[col] === val); return api; },
      in: (col: string, vals: any[]) => { filters.push(r => vals.includes(r[col])); return api; },
      gte: (col: string, val: any) => { filters.push(r => r[col] >= val); return api; },
      or: () => api,
      order: () => api,
      limit: () => api,
      update: (p: any) => { op = 'update'; patch = p; return api; },
      insert: (row: any) => { if (table === 'order_fulfillment_tracking') audit.push(row); return Promise.resolve({ error: null }); },
      maybeSingle: () => run().then((r: any) => ({ data: r.data?.[0] ?? null, error: null })),
      then: (res: any, rej: any) => run().then(res, rej),
    };
    const rows = () => (tables[table] ||= []);
    const run = async () => {
      const hit = rows().filter(r => filters.every(f => f(r)));
      if (op === 'update') { hit.forEach(r => Object.assign(r, patch)); return { data: hit, error: null }; }
      return { data: hit.map(r => ({ ...r, order_items: (tables.order_items || []).filter(i => i.order_id === r.id) })), error: null };
    };
    return api;
  };
  return { client: { from } as any, audit };
}

const print = (id: string, orderId: string, extra: any = {}) => ({
  id, order_id: orderId, image_id: 'img-' + id, image_title: '**Duchess of Barkingham** takes tea', image_url: null,
  print_image_url: 'https://res.cloudinary.com/x/image/upload/print.jpg', quantity: 1, unit_price: 3500,
  product_data: { product_type: 'physical_print', size_name: 'Medium', width_cm: 20, height_cm: 30, medium: { name: 'Foamex' }, gelato_sku: 'g-m' },
  ...extra,
});
const order = (id: string, extra: any = {}) => ({
  id, order_number: `PW-${id}`, status: 'confirmed', payment_status: 'paid', created_at: new Date().toISOString(),
  customer_email: 'jane@example.com', shipping_first_name: 'Jane', shipping_last_name: 'Smith',
  shipping_address: '12 Mill Lane', shipping_address_line_1: '12 Mill Lane', shipping_address_line_2: 'Flat 3',
  shipping_city: 'London', shipping_postcode: 'nw6 1aa', shipping_country: 'GB', shipping_amount: 399, total_amount: 3899,
  fulfillment_type: 'physical', fulfillment_provider: 'self_print', self_print_status: 'to_print', metadata: {},
  ...extra,
});

let n = 0;
const t = async (name: string, fn: () => any) => { await fn(); n++; console.log('  ✓', name); };

(async () => {
  console.log('what needs posting');
  await t('prints are posted; downloads and stall prints are not', () => {
    assert.ok(isPostedPrintItem({ product_data: { product_type: 'physical_print' } }));
    assert.ok(isPostedPrintItem({ product_data: {} }), 'legacy item without a type is a print');
    assert.ok(!isPostedPrintItem({ product_data: { product_type: 'digital_download' } }));
    assert.ok(!isPostedPrintItem({ product_data: { product_type: 'stall_print', fulfillment_method: 'collected' } }));
    assert.ok(isPostedPrintItem({ product_data: JSON.stringify({ product_type: 'physical_print' }) }), 'legacy JSON string');
  });
  await t('collected-at-stall orders have nothing to post', () => {
    assert.equal(postedItems({ fulfillment_type: 'collected', order_items: [print('a', 'o')] }).length, 0);
    assert.equal(fulfilmentStage({ ...order('o'), fulfillment_type: 'collected', order_items: [print('a', 'o')] }), null);
  });
  await t('stages', () => {
    const items = [print('a', 'o')];
    assert.equal(fulfilmentStage({ ...order('o'), order_items: items }), 'to_print');
    assert.equal(fulfilmentStage({ ...order('o', { status: 'on_hold' }), order_items: items }), 'on_hold');
    assert.equal(fulfilmentStage({ ...order('o', { fulfillment_provider: null, self_print_status: null }), order_items: items }), 'needs_routing');
    assert.equal(fulfilmentStage({ ...order('o', { gelato_order_id: 'g1', fulfillment_provider: null }), order_items: items }), 'gelato');
  });
  await t('settings validation', () => {
    assert.equal(validateSetting('default_fulfillment_provider', 'self_print'), null);
    assert.equal(validateSetting('default_fulfillment_provider', 'gelato'), null);
    assert.ok(validateSetting('default_fulfillment_provider', 'prodigi'));
    assert.equal(validateSetting('return_address', 'Pawtraits, PO Box 1, London'), null);
    assert.ok(validateSetting('return_address', 'x'.repeat(200)));
  });

  console.log('pick → pack → post');
  const db = fakeDb({ orders: [order('1')], order_items: [print('i1', '1'), print('i2', '1', { product_data: { product_type: 'digital_download' } })], user_profiles: [] });
  await t('to print → printed', async () => {
    const o = await applyFulfilmentAction(db.client, '1', { action: 'mark_printed' });
    assert.equal(o.self_print_status, 'printed'); assert.ok(o.printed_at);
  });
  await t('cannot skip back to printed twice', async () => {
    await assert.rejects(applyFulfilmentAction(db.client, '1', { action: 'mark_printed' }), /not "To print"/);
  });
  await t('printed → packed', async () => {
    const o = await applyFulfilmentAction(db.client, '1', { action: 'mark_packed' });
    assert.equal(o.self_print_status, 'packed'); assert.ok(o.packed_at);
  });
  await t('tracked service needs a tracking number', async () => {
    await assert.rejects(applyFulfilmentAction(db.client, '1', { action: 'mark_posted', service: 'rm_tracked_48', notify: false }), /enter the tracking number/);
  });
  await t('rejects a junk tracking number', async () => {
    await assert.rejects(applyFulfilmentAction(db.client, '1', { action: 'mark_posted', service: 'rm_tracked_48', trackingCode: '<script>', notify: false }), /doesn't look right/);
  });
  await t('posted with Royal Mail tracking link filled in', async () => {
    const o = await applyFulfilmentAction(db.client, '1', { action: 'mark_posted', service: 'rm_tracked_48', trackingCode: 'ab 1234 5678 9gb', notify: false });
    assert.equal(o.self_print_status, 'posted');
    assert.equal(o.status, 'shipped');
    assert.equal(o.fulfillment_status, 'fulfilled');
    assert.equal(o.tracking_code, 'AB123456789GB');
    assert.equal(o.carrier, 'Royal Mail Tracked 48');
    assert.match(o.tracking_url, /royalmail\.com\/track-your-item#\/tracking-results\/AB123456789GB/);
  });
  await t('cannot post twice', async () => {
    await assert.rejects(applyFulfilmentAction(db.client, '1', { action: 'mark_posted', service: 'rm_2nd', notify: false }), /already been posted/);
  });
  await t('undo from posted goes back to packed and reopens the order', async () => {
    const o = await applyFulfilmentAction(db.client, '1', { action: 'undo' });
    assert.equal(o.self_print_status, 'packed'); assert.equal(o.shipped_at, null); assert.equal(o.status, 'confirmed');
  });
  await t('untracked 2nd class can be posted straight from To print; email failure is reported but the order is posted', async () => {
    const db2 = fakeDb({ orders: [order('2')], order_items: [print('j1', '2')], user_profiles: [] });
    await assert.rejects(applyFulfilmentAction(db2.client, '2', { action: 'mark_posted', service: 'rm_2nd', notify: true }), /email failed|Order updated/);
    const { data: [row] } = await db2.client.from('orders').select('*').eq('id', '2');
    assert.equal(row.self_print_status, 'posted'); assert.ok(row.printed_at && row.packed_at); assert.equal(row.tracking_code, null);
  });
  await t('every change is audited', () => {
    assert.ok(db.audit.length >= 4);
    assert.ok(db.audit.every(a => a.order_id === '1' && a.fulfillment_method === 'self_print'));
  });

  console.log('routing choices');
  await t('held order is released to self-print', async () => {
    const db3 = fakeDb({ orders: [order('3', { status: 'on_hold', fulfillment_provider: null, self_print_status: null, error_message: 'HELD' })], order_items: [print('k1', '3')] });
    const o = await applyFulfilmentAction(db3.client, '3', { action: 'release' });
    assert.equal(o.status, 'confirmed'); assert.equal(o.fulfillment_provider, 'self_print'); assert.equal(o.self_print_status, 'to_print'); assert.equal(o.error_message, null);
  });
  await t('an order already at Gelato cannot be switched to self-print', async () => {
    const db4 = fakeDb({ orders: [order('4', { fulfillment_provider: 'gelato', gelato_order_id: 'g-1', self_print_status: null })], order_items: [print('l1', '4')] });
    await assert.rejects(applyFulfilmentAction(db4.client, '4', { action: 'use_self_print' }), /already been sent to Gelato/);
    await assert.rejects(applyFulfilmentAction(db4.client, '4', { action: 'send_to_gelato' }), /Already sent/);
  });
  await t('download-only orders are refused', async () => {
    const db5 = fakeDb({ orders: [order('5')], order_items: [print('m1', '5', { product_data: { product_type: 'digital_download' } })] });
    await assert.rejects(applyFulfilmentAction(db5.client, '5', { action: 'mark_printed' }), /nothing to post/);
  });
  await t('queue groups by stage and skips download-only orders', async () => {
    const db6 = fakeDb({
      orders: [order('6'), order('7', { self_print_status: 'packed' }), order('8')],
      order_items: [print('n1', '6'), print('n2', '7'), print('n3', '8', { product_data: { product_type: 'digital_download' } })],
    });
    const q = await getFulfilmentQueue(db6.client);
    assert.deepEqual(q.counts, { to_print: 1, packed: 1 });
    assert.equal(q.orders.length, 2);
  });

  console.log('paperwork');
  await t('Click & Drop CSV: header, upper-case postcode, country code, formula guard', () => {
    const csv = clickAndDropCsv([{ ...order('9', { shipping_first_name: '=HYPERLINK("x")' }), order_items: [print('p1', '9', { quantity: 2 })] }]);
    const lines = csv.replace(/^﻿/, '').trim().split('\r\n');
    assert.equal(lines.length, 2);
    assert.match(lines[0], /^Order reference,Order date,Full name/);
    assert.match(lines[1], /NW6 1AA,GB,jane@example.com/);
    assert.match(lines[1], /2 x Foamex · Medium 20×30 cm print/);
    assert.match(lines[1], /"'=HYPERLINK\(""x""\) Smith"/);
  });
  await t('packing slips PDF: summary page + one slip per order', async () => {
    const orders = [
      { ...order('10'), order_items: [print('q1', '10'), print('q2', '10', { quantity: 2, print_image_url: null })], fulfillment_notes: 'Gift — no receipt' },
      { ...order('11', { shipping_first_name: 'Zoë', shipping_last_name: 'O’Brien' }), order_items: [print('r1', '11')] },
    ];
    const bytes = await generatePackingSlips(orders, { returnAddress: 'Pawtraits, 1 Example Street, London NW6 1AA' });
    const { PDFDocument } = require('pdf-lib');
    const doc = await PDFDocument.load(bytes);
    assert.equal(doc.getPageCount(), 3);
    fs.writeFileSync(process.env.SLIP_OUT || '/tmp/packing-slips-test.pdf', bytes);
  });

  console.log(`\n${n} checks passed`);
})().catch(e => { console.error('\n✗ FAILED:', e); process.exit(1); });
