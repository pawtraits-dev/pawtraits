/**
 * Checks for self-print fulfilment (routing, pick-pack-post actions, packing slips, Click & Drop CSV).
 * Uses an in-memory stand-in for Supabase — no network or database needed.
 * Run: NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:1 SUPABASE_SERVICE_ROLE_KEY=x npx tsx scripts/test-self-print-fulfilment.ts
 */
export {};
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { applyFulfilmentAction, fulfilmentStage, getFulfilmentQueue } = require('../lib/fulfillment/order-fulfilment');
const { isPostedPrintItem, postedItems } = require('../lib/fulfillment/shared');
const sh = require('../lib/fulfillment/shared');
const sr = require('../lib/fulfillment/split-routing');
const { generatePackingSlips, clickAndDropCsv } = require('../lib/fulfillment/packing-slips');
const { validateSetting } = require('../lib/app-settings');

// ---- tiny in-memory Supabase ------------------------------------------------------
function fakeDb(tables: Record<string, any[]>, opts: { missing?: string[] } = {}) {
  // opts.missing: column names that "do not exist", as "col" (any table) or "table.col"
  const isMissing = (table: string, key: string) => (opts.missing || []).some(m => m === key || m === `${table}.${key}`);
  const audit: any[] = [];
  const from = (table: string) => {
    const filters: Array<(r: any) => boolean> = [];
    let op: 'select' | 'update' | 'insert' = 'select';
    let patch: any = null;
    let cols = '*';
    const api: any = {
      select: (c?: string) => { cols = c || '*'; return api; },
      eq: (col: string, val: any) => { filters.push(r => r[col] === val); return api; },
      in: (col: string, vals: any[]) => { filters.push(r => vals.includes(r[col])); return api; },
      gte: (col: string, val: any) => { filters.push(r => r[col] >= val); return api; },
      is: (col: string, val: any) => { filters.push(r => (r[col] ?? null) === val); return api; },
      or: () => api,
      order: () => api,
      limit: () => api,
      update: (p: any) => { op = 'update'; patch = p; return api; },
      insert: (row: any) => { if (table === 'order_fulfillment_tracking') audit.push(row); return Promise.resolve({ error: null }); },
      maybeSingle: () => run().then((r: any) => ({ data: r.data?.[0] ?? null, error: r.error ?? null })),
      then: (res: any, rej: any) => run().then(res, rej),
    };
    const rows = () => (tables[table] ||= []);
    const run = async () => {
      const hit = rows().filter(r => filters.every(f => f(r)));
      if (op === 'update') {
        const bad = Object.keys(patch).find(k => isMissing(table, k));
        if (bad) return { data: null, error: { message: `Could not find the '${bad}' column of '${table}' in the schema cache`, code: 'PGRST204' } }; hit.forEach(r => Object.assign(r, patch)); return { data: hit, error: null }; }
      const badCol = cols.split(',').map(c => c.trim()).find(c => c !== '*' && isMissing(table, c));
      if (badCol) return { data: null, error: { message: `column ${table}.${badCol} does not exist`, code: '42703' } };
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
    const o = await applyFulfilmentAction(db3.client, '3', { action: 'release' }, { mode: 'self_print' });
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

  await t('packing slips PDF: a split order gets one page and does not throw', async () => {
    const o = { ...order('12', { gelato_order_id: 'G-12' }), order_items: [
      print('s1', '12', { fulfillment_provider: 'self_print', product_data: { product_type: 'physical_print', size_name: 'Medium', width_cm: 20, height_cm: 30, medium: { name: 'Foamex', slug: 'foamex' } } }),
      print('s2', '12', { fulfillment_provider: 'gelato', product_data: { product_type: 'physical_print', medium: { name: 'Mug', slug: 'mug' } } }),
    ] };
    assert.equal(sh.isSplitOrder(o), true);
    const { PDFDocument } = require('pdf-lib');
    const doc = await PDFDocument.load(await generatePackingSlips([o], { returnAddress: 'Pawtraits, 1 Example Street, London NW6 1AA' }));
    assert.equal(doc.getPageCount(), 1);
  });

  // ================= split by material =================
  const line = (id: string, orderId: string, slug: string, extra: any = {}, pd: any = {}) => print(id, orderId, {
    product_data: { product_type: 'physical_print', size_name: 'Medium', width_cm: 20, height_cm: 30, medium: { name: slug, slug }, gelato_sku: 'g-' + slug, ...pd },
    ...extra,
  });
  const foamex = (id: string, o: string, extra: any = {}) => line(id, o, 'foamex', extra, { gelato_sku: 'g-foam' });
  const foamPrint = (id: string, o: string, extra: any = {}) => line(id, o, 'foam-print', extra);
  const mug = (id: string, o: string, extra: any = {}) => line(id, o, 'mug', extra);
  const paper = (id: string, o: string, extra: any = {}) => line(id, o, 'art-paper', extra, { gelato_sku: undefined });
  const download = (id: string, o: string) => print(id, o, { product_data: { product_type: 'digital_download', medium: { slug: 'digital' } } });
  const D = sh.DEFAULT_SELF_PRINT_MATERIALS;
  const ids = (a: any[]) => a.map(i => i.id);
  const ord = (items: any[], extra: any = {}) => ({ ...order('x', extra), order_items: items });
  const stub = (result: any = { success: true, fulfillmentId: 'G-1' }) => {
    const calls: any[][] = [];
    return { calls, fn: async (_o: any, items: any[]) => { calls.push(items); return typeof result === 'function' ? result() : result; } };
  };
  const rowOf = async (db: any, id: string) => (await db.client.from('orders').select('*').eq('id', id)).data[0];
  const markOf = (r: any, id: string) => r.order_items.find((i: any) => i.id === id).fulfillment_provider;
  const unrouted = { fulfillment_provider: null, self_print_status: null };

  console.log('split: routeOrderItems');
  await t('foamex only goes to us', () => {
    const r = sh.routeOrderItems(ord([foamex('a', 'x')]), D);
    assert.deepEqual([ids(r.selfPrint), ids(r.gelato)], [['a'], []]);
  });
  await t('mug and art paper go to Gelato', () => {
    const r = sh.routeOrderItems(ord([mug('a', 'x'), paper('b', 'x')]), D);
    assert.deepEqual([ids(r.selfPrint), ids(r.gelato)], [[], ['a', 'b']]);
  });
  await t('foamex plus mug is split', () => {
    const r = sh.routeOrderItems(ord([foamex('a', 'x'), mug('b', 'x')]), D);
    assert.deepEqual([ids(r.selfPrint), ids(r.gelato)], [['a'], ['b']]);
  });
  await t('downloads are in neither list', () => {
    const r = sh.routeOrderItems(ord([download('d', 'x'), foamex('a', 'x')]), D);
    assert.deepEqual([ids(r.selfPrint), ids(r.gelato)], [['a'], []]);
  });
  await t('a line of quantity 3 is never divided', () => {
    const r = sh.routeOrderItems(ord([foamex('a', 'x', { quantity: 3 })]), D);
    assert.equal(r.selfPrint.length, 1); assert.equal(r.selfPrint[0].quantity, 3);
  });
  await t('stall lines and collected orders are in neither list', () => {
    const stall = print('s', 'x', { product_data: { product_type: 'stall_print', fulfillment_method: 'collected' } });
    const r = sh.routeOrderItems(ord([stall]), D);
    assert.deepEqual([r.selfPrint.length, r.gelato.length], [0, 0]);
    const c = sh.routeOrderItems(ord([foamex('a', 'x'), mug('b', 'x')], { fulfillment_type: 'collected' }), D);
    assert.deepEqual([c.selfPrint.length, c.gelato.length], [0, 0]);
  });
  await t('an unknown product goes to Gelato', () => {
    const unknown = print('u', 'x', { product_data: { product_type: 'physical_print', missing_product: 'x' } });
    const r = sh.routeOrderItems(ord([unknown]), D);
    assert.deepEqual([ids(r.selfPrint), ids(r.gelato)], [[], ['u']]);
  });
  await t('product_data as a JSON string works; slugs are matched in lower case', () => {
    const str = foamex('a', 'x', { product_data: JSON.stringify(foamex('a', 'x').product_data) });
    assert.equal(sh.routeOrderItems(ord([str]), D).selfPrint.length, 1);
    const upper = line('b', 'x', 'FOAMEX');
    assert.equal(sh.routeOrderItems(ord([upper]), ['foamex']).selfPrint.length, 1);
    assert.equal(sh.routeOrderItems(ord([foamPrint('c', 'x')]), D).selfPrint.length, 1);
  });

  console.log('split: settings helpers');
  await t('cleanMaterials falls back to the default for anything unusable', () => {
    for (const v of [undefined, 'foamex', [], [1, null]]) assert.deepEqual(sh.cleanMaterials(v), D);
    assert.deepEqual(sh.cleanMaterials([' Foamex ', 'foamex']), ['foamex']);
    const copy = sh.cleanMaterials(undefined); copy.push('x'); assert.deepEqual(D, ['foamex', 'foam-print']);
  });
  await t('cleanMode', () => {
    for (const m of ['split', 'gelato', 'self_print']) assert.equal(sh.cleanMode(m), m);
    assert.equal(sh.cleanMode('prodigi'), 'self_print'); assert.equal(sh.cleanMode(undefined), 'self_print');
  });

  console.log('split: line owners and stages');
  const marked = (extra: any = {}, mugExtra: any = {}) => ord([foamex('a', 'x', { fulfillment_provider: 'self_print' }), mug('b', 'x', { fulfillment_provider: 'gelato', ...mugExtra })], extra);
  await t('an unmarked self-print order: every line is ours, stage as before', () => {
    const o = ord([foamex('a', 'x'), mug('b', 'x')]);
    assert.equal(sh.selfPrintItems(o).length, 2); assert.equal(sh.gelatoItems(o).length, 0);
    assert.equal(sh.isSplitOrder(o), false); assert.equal(sh.fulfilmentStage(o), 'to_print');
  });
  await t('an unmarked order with a Gelato id is all Gelato, stage gelato', () => {
    const o = ord([foamex('a', 'x'), mug('b', 'x')], { gelato_order_id: 'G1', fulfillment_provider: null, self_print_status: null });
    assert.equal(sh.gelatoItems(o).length, 2); assert.equal(sh.fulfilmentStage(o), 'gelato');
  });
  await t('a marked split order with a Gelato id sits at its self-print stage', () => {
    const o = marked({ gelato_order_id: 'G1' });
    assert.equal(sh.fulfilmentStage(o), 'to_print'); assert.equal(sh.isSplitOrder(o), true);
    assert.deepEqual(ids(sh.gelatoItems(o)), ['b']); assert.equal(sh.gelatoPartWaiting(o), false);
  });
  await t('the same without a Gelato id is waiting', () => {
    assert.equal(sh.gelatoPartWaiting(marked()), true);
  });
  await t('every line marked Gelato with no provider and no id needs routing', () => {
    const o = ord([mug('a', 'x', { fulfillment_provider: 'gelato' })], unrouted);
    assert.equal(sh.fulfilmentStage(o), 'needs_routing');
  });
  await t('a split order on hold is on_hold', () => {
    assert.equal(sh.fulfilmentStage(marked({ status: 'on_hold' })), 'on_hold');
  });

  console.log('split: order status');
  await t('splitOrderStatus table', () => {
    const c = (ours: string, delivered: any, theirs: any) => sh.splitOrderStatus({ self_print_status: ours, delivered_at: delivered, gelato_status: theirs });
    const exp = (r: any, status: string, fs: string) => assert.deepEqual(r, { status, fulfillment_status: fs });
    exp(c('to_print', null, null), 'confirmed', 'processing');
    exp(c('posted', null, 'pending'), 'processing', 'partially_fulfilled');
    exp(c('packed', null, 'shipped'), 'processing', 'partially_fulfilled');
    exp(c('posted', null, 'shipped'), 'shipped', 'fulfilled');
    exp(c('posted', '2026-11-20', 'shipped'), 'shipped', 'fulfilled');
    exp(c('posted', null, 'delivered'), 'shipped', 'fulfilled');
    exp(c('posted', '2026-11-20', 'delivered'), 'delivered', 'fulfilled');
  });
  await t('splitStatusFields leaves cancelled and on_hold orders alone', () => {
    assert.deepEqual(sh.splitStatusFields({ status: 'cancelled', self_print_status: 'posted', gelato_status: 'shipped' }), {});
    assert.deepEqual(sh.splitStatusFields({ status: 'on_hold' }), {});
    assert.equal(sh.splitStatusFields({ status: 'confirmed' }).status, 'confirmed');
  });

  console.log('split: Gelato problems');
  await t('gelatoProblems', () => {
    assert.deepEqual(sh.gelatoProblems([mug('a', 'x')]), []);
    assert.match(sh.gelatoProblems([paper('a', 'x')])[0], /no Gelato product set/);
    assert.match(sh.gelatoProblems([mug('a', 'x', { print_image_url: null })])[0], /no print file/);
    assert.match(sh.gelatoProblems([mug('a', 'x', { print_file_meta: { print_master: 'pending' } })])[0], /still being made/);
    assert.match(sh.gelatoProblems([mug('a', 'x', { print_file_meta: { print_master: 'failed' } })])[0], /Rebuild print files/);
    assert.match(sh.gelatoProblems([line('a', 'x', 'mug', {}, { product_type: 'hybrid' })])[0], /cannot make this kind of item/);
  });
  await t('gelatoStatusForColumn maps every raw status to an allowed value', () => {
    const map: Record<string, string> = {
      created: 'pending', uploading: 'pending', passed: 'pending', pending: 'pending', draft: 'pending',
      in_production: 'processing', printed: 'processing', processing: 'processing',
      shipped: 'shipped', in_transit: 'shipped', delivered: 'delivered',
      failed: 'error', canceled: 'error', cancelled: 'error', on_hold: 'error',
    };
    for (const k of Object.keys(map)) assert.equal(sr.gelatoStatusForColumn(k), map[k], k);
    assert.equal(sr.gelatoStatusForColumn('something_new'), 'processing');
    assert.equal(sr.gelatoStatusForColumn(undefined), 'processing');
  });
  await t('settings: split and the materials list', () => {
    assert.equal(validateSetting('default_fulfillment_provider', 'split'), null);
    assert.ok(validateSetting('default_fulfillment_provider', 'prodigi'));
    assert.equal(validateSetting('self_print_materials', ['foamex']), null);
    for (const bad of [[], 'foamex', ['Bad Slug!'], Array.from({ length: 21 }, (_, i) => 'm' + i)]) assert.ok(validateSetting('self_print_materials', bad), JSON.stringify(bad).slice(0, 30));
  });

  console.log('split: applySplitRouting');
  const splitDb = (items: any[], extra: any = {}, opts: any = {}) => fakeDb({ orders: [order('x', { ...unrouted, ...extra })], order_items: items, user_profiles: [] }, opts);
  const runSplit = async (db: any, deps: any) => {
    const o = await rowOf(db, 'x');
    return sr.applySplitRouting(db.client, o, o.order_items, { materials: D, ...deps });
  };
  await t('foamex plus a mug: marks written, Gelato gets only the mug, order queued here', async () => {
    const db = splitDb([foamex('a', 'x'), mug('b', 'x', { quantity: 2 })]);
    const g = stub();
    const res = await runSplit(db, { send: true, sendGelato: g.fn });
    assert.equal(res.gelato, 'sent');
    assert.equal(g.calls.length, 1); assert.deepEqual(ids(g.calls[0]), ['b']); assert.equal(g.calls[0][0].quantity, 2);
    const r = await rowOf(db, 'x');
    assert.equal(markOf(r, 'b'), 'gelato'); assert.equal(markOf(r, 'a'), 'self_print');
    assert.equal(r.fulfillment_provider, 'self_print'); assert.equal(r.self_print_status, 'to_print');
    assert.equal(r.gelato_order_id, 'G-1'); assert.equal(r.gelato_status, 'pending'); assert.equal(r.error_message, null);
    assert.equal(r.fulfillment_status, 'processing');
    assert.ok(db.audit.some(a => a.fulfillment_method === 'gelato' && a.status === 'processing'));
  });
  await t('all foamex: no marks, Gelato never called', async () => {
    const db = splitDb([foamex('a', 'x')]);
    const g = stub();
    const res = await runSplit(db, { send: true, sendGelato: g.fn });
    assert.equal(res.gelato, 'none'); assert.equal(g.calls.length, 0);
    const r = await rowOf(db, 'x');
    assert.equal(markOf(r, 'a'), undefined); assert.equal(r.self_print_status, 'to_print'); assert.equal(r.fulfillment_provider, 'self_print');
  });
  await t('all Gelato and accepted: provider gelato, nothing queued here', async () => {
    const db = splitDb([mug('a', 'x')]);
    await runSplit(db, { send: true, sendGelato: stub().fn });
    const r = await rowOf(db, 'x');
    assert.equal(r.fulfillment_provider, 'gelato'); assert.equal(r.self_print_status, null); assert.equal(r.fulfillment_status, 'fulfilled');
  });
  await t('Gelato failing on a mixed order: foamex stays queued, the rest waits', async () => {
    const db = splitDb([foamex('a', 'x'), mug('b', 'x')]);
    const res = await runSplit(db, { send: true, sendGelato: stub({ success: false, error: 'bad address' }).fn });
    assert.equal(res.gelato, 'failed');
    const r = await rowOf(db, 'x');
    assert.equal(r.self_print_status, 'to_print'); assert.match(r.error_message, /^Gelato:/); assert.ok(!r.gelato_order_id);
    assert.equal(sh.gelatoPartWaiting(r), true);
  });
  await t('Gelato throwing is handled like a failure', async () => {
    const db = splitDb([foamex('a', 'x'), mug('b', 'x')]);
    const res = await runSplit(db, { send: true, sendGelato: async () => { throw new Error('network down'); } });
    assert.equal(res.gelato, 'failed'); assert.match((await rowOf(db, 'x')).error_message, /network down/);
  });
  await t('Gelato failing on an all-Gelato order: needs routing', async () => {
    const db = splitDb([mug('a', 'x')]);
    await runSplit(db, { send: true, sendGelato: stub({ success: false, error: 'no' }).fn });
    assert.equal(sh.fulfilmentStage(await rowOf(db, 'x')), 'needs_routing');
  });
  await t('a line without a Gelato product: Gelato is not called and the error names the line', async () => {
    const db = splitDb([foamex('a', 'x'), paper('b', 'x')]);
    const g = stub();
    const res = await runSplit(db, { send: true, sendGelato: g.fn });
    assert.equal(g.calls.length, 0); assert.equal(res.gelato, 'not_sent');
    const r = await rowOf(db, 'x');
    assert.match(r.error_message, /^Not sent to Gelato: .*art-paper.*no Gelato product set/);
    assert.equal(r.self_print_status, 'to_print');
  });
  await t('send false only marks: Gelato not called', async () => {
    const db = splitDb([foamex('a', 'x'), mug('b', 'x')]);
    const g = stub();
    await runSplit(db, { send: false, sendGelato: g.fn });
    assert.equal(g.calls.length, 0);
    assert.match((await rowOf(db, 'x')).error_message, /^Not sent to Gelato yet/);
  });
  await t('marks cannot be written: Gelato not called, everything queued here', async () => {
    const db = splitDb([foamex('a', 'x'), mug('b', 'x')], {}, { missing: ['order_items.fulfillment_provider'] });
    const g = stub();
    const res = await runSplit(db, { send: true, sendGelato: g.fn });
    assert.equal(g.calls.length, 0); assert.equal(res.gelato, 'not_sent');
    const r = await rowOf(db, 'x');
    assert.equal(r.fulfillment_provider, 'self_print'); assert.equal(r.self_print_status, 'to_print');
    assert.match(r.error_message, /^Could not split this order/);
  });
  await t('splitColumnsReady', async () => {
    assert.equal(await sr.splitColumnsReady(splitDb([]).client), true);
    assert.equal(await sr.splitColumnsReady(splitDb([], {}, { missing: ['fulfillment_provider'] }).client), false);
    assert.equal(await sr.splitColumnsReady(splitDb([], {}, { missing: ['orders.gelato_tracking_code'] }).client), false);
  });
  await t('splitRoutingFields: digital part not done makes it partially fulfilled', () => {
    assert.equal(sr.splitRoutingFields({ selfCount: 1, gelatoCount: 0, gelato: 'none', digitalOk: false }).fulfillment_status, 'partially_fulfilled');
    assert.equal(sr.splitRoutingFields({ selfCount: 0, gelatoCount: 1, gelato: 'failed', error: 'x', digitalOk: false }).fulfillment_status, 'failed');
  });

  console.log('split: admin actions');
  const splitOrderRows = (extra: any = {}, mugExtra: any = {}) => ({
    orders: [order('x', { gelato_order_id: 'G1', gelato_status: 'pending', ...extra })],
    order_items: [foamex('a', 'x', { fulfillment_provider: 'self_print' }), mug('b', 'x', { fulfillment_provider: 'gelato', ...mugExtra })],
    user_profiles: [],
  });
  await t('mark_posted with Gelato still pending: processing, partly fulfilled', async () => {
    const db = fakeDb(splitOrderRows());
    const o = await applyFulfilmentAction(db.client, 'x', { action: 'mark_posted', service: 'rm_tracked_48', trackingCode: 'AB123456789GB', notify: false });
    assert.equal(o.self_print_status, 'posted'); assert.equal(o.status, 'processing'); assert.equal(o.fulfillment_status, 'partially_fulfilled');
    assert.equal(o.tracking_code, 'AB123456789GB'); assert.ok(o.shipped_at);
  });
  await t('mark_posted with Gelato shipped: shipped', async () => {
    const db = fakeDb(splitOrderRows({ gelato_status: 'shipped' }));
    const o = await applyFulfilmentAction(db.client, 'x', { action: 'mark_posted', service: 'rm_2nd', notify: false });
    assert.equal(o.status, 'shipped'); assert.equal(o.fulfillment_status, 'fulfilled');
  });
  await t('undo from posted with Gelato shipped goes back to processing', async () => {
    const db = fakeDb(splitOrderRows({ gelato_status: 'shipped', status: 'shipped', self_print_status: 'posted', shipped_at: '2026-11-20' }));
    const o = await applyFulfilmentAction(db.client, 'x', { action: 'undo' });
    assert.equal(o.self_print_status, 'packed'); assert.equal(o.status, 'processing'); assert.equal(o.fulfillment_status, 'partially_fulfilled');
  });
  await t('send_to_gelato refuses an order that already has a Gelato id', async () => {
    const db = fakeDb(splitOrderRows()); const g = stub();
    await assert.rejects(applyFulfilmentAction(db.client, 'x', { action: 'send_to_gelato' }, { sendGelato: g.fn }), /Already sent/);
    assert.equal(g.calls.length, 0);
  });
  await t('send_to_gelato on a waiting split order sends only the Gelato lines and keeps it ours', async () => {
    const db = fakeDb(splitOrderRows({ gelato_order_id: null, gelato_status: null }));
    const g = stub({ success: true, fulfillmentId: 'G-9' });
    const o = await applyFulfilmentAction(db.client, 'x', { action: 'send_to_gelato' }, { sendGelato: g.fn });
    assert.deepEqual(ids(g.calls[0]), ['b']);
    assert.equal(o.gelato_order_id, 'G-9'); assert.equal(o.gelato_status, 'pending');
    assert.equal(o.fulfillment_provider, 'self_print'); assert.equal(o.self_print_status, 'to_print');
    assert.ok(db.audit.some(a => /Sent the rest to Gelato/.test(a.status_message)));
  });
  await t('send_to_gelato with a line that has no Gelato product is refused before Gelato is called', async () => {
    const db = fakeDb({ orders: [order('x', { ...unrouted })], order_items: [paper('a', 'x')], user_profiles: [] }); const g = stub();
    await assert.rejects(applyFulfilmentAction(db.client, 'x', { action: 'send_to_gelato' }, { sendGelato: g.fn }), /no Gelato product set/);
    assert.equal(g.calls.length, 0);
  });
  await t('use_self_print on a waiting split order brings the rest back and reopens printing', async () => {
    const db = fakeDb(splitOrderRows({ gelato_order_id: null, gelato_status: null, self_print_status: 'printed', printed_at: '2026-11-20' }));
    const o = await applyFulfilmentAction(db.client, 'x', { action: 'use_self_print' });
    assert.equal(markOf(o, 'b'), 'self_print'); assert.equal(o.self_print_status, 'to_print'); assert.equal(o.printed_at, null);
  });
  await t('release in split mode marks the lines, does not call Gelato, waits for the rest', async () => {
    const db = fakeDb({ orders: [order('x', { status: 'on_hold', ...unrouted, error_message: 'HELD' })], order_items: [foamex('a', 'x'), mug('b', 'x')], user_profiles: [] });
    const g = stub();
    const o = await applyFulfilmentAction(db.client, 'x', { action: 'release' }, { mode: 'split', materials: D, sendGelato: g.fn });
    assert.equal(g.calls.length, 0); assert.equal(o.status, 'confirmed');
    assert.equal(markOf(o, 'a'), 'self_print'); assert.equal(markOf(o, 'b'), 'gelato');
    assert.equal(sh.fulfilmentStage(o), 'to_print'); assert.equal(sh.gelatoPartWaiting(o), true);
  });
  await t('release outside split mode queues everything here, as before', async () => {
    const db = fakeDb({ orders: [order('x', { status: 'on_hold', ...unrouted })], order_items: [foamex('a', 'x'), mug('b', 'x')], user_profiles: [] });
    const o = await applyFulfilmentAction(db.client, 'x', { action: 'release' }, { mode: 'self_print' });
    assert.equal(o.status, 'confirmed'); assert.equal(o.fulfillment_provider, 'self_print'); assert.equal(o.self_print_status, 'to_print');
    assert.equal(markOf(o, 'b'), undefined);
  });

  console.log('split: paperwork');
  const paperwork = ord([foamex('a', 'x', { quantity: 2, fulfillment_provider: 'self_print' }), mug('b', 'x', { fulfillment_provider: 'gelato' })], { gelato_order_id: 'G1' });
  await t('Click & Drop lists only our foamex, with its count', () => {
    const csv = clickAndDropCsv([paperwork]);
    const row = csv.replace(/^﻿/, '').trim().split('\r\n')[1];
    assert.match(row, /2 x foamex · Medium 20×30 cm print,2,/); assert.ok(!/mug/i.test(row));
  });
  await t('planShipment counts only our prints', () => {
    let plan: any;
    try { plan = require('../lib/shipping/royal-mail/server').planShipment; } catch (e: any) { console.log('    (skipped: could not load royal-mail/server:', String(e.message).slice(0, 60), ')'); return; }
    const p = plan(paperwork, { packaging_grams: 120, print_grams_per_100cm2: 25, large_letter_max_prints: 2, service_uk: '', service_europe: '', service_world: '' });
    assert.equal(p.prints, 2);
  });

  console.log('split: print files and Gelato webhook');
  await t('isOpenForPrintFiles', () => {
    const o = (extra: any) => ({ gelato_order_id: null, self_print_status: 'to_print', ...extra });
    assert.equal(sh.isOpenForPrintFiles(o({ gelato_order_id: 'G1' }), {}), false);
    assert.equal(sh.isOpenForPrintFiles(o({}), { fulfillment_provider: 'self_print' }), true);
    assert.equal(sh.isOpenForPrintFiles(o({ self_print_status: 'printed' }), { fulfillment_provider: 'self_print' }), false);
    assert.equal(sh.isOpenForPrintFiles(o({ gelato_order_id: 'G1' }), { fulfillment_provider: 'gelato' }), false);
    assert.equal(sh.isOpenForPrintFiles(o({ self_print_status: 'printed' }), { fulfillment_provider: 'gelato' }), true);
  });
  await t('a Gelato status update only changes the Gelato part', () => {
    const f = sr.gelatoSplitStatusFields({ status: 'confirmed', self_print_status: 'to_print', gelato_status: 'pending' }, 'in_transit');
    assert.equal(f.gelato_status, 'shipped'); assert.equal(f.status, 'processing');
    const done = sr.gelatoSplitStatusFields({ status: 'shipped', self_print_status: 'posted', delivered_at: '2026-11-20', gelato_status: 'shipped' }, 'delivered');
    assert.equal(done.status, 'delivered');
    assert.equal('status' in sr.gelatoSplitStatusFields({ status: 'cancelled', self_print_status: 'posted' }, 'shipped'), false);
    assert.match(sr.gelatoSplitStatusFields({ status: 'confirmed' }, 'failed').error_message, /Gelato reported this order as failed/);
  });
  await t('Gelato tracking never touches our own parcel fields', () => {
    const f = sr.gelatoSplitTrackingFields({ status: 'confirmed', self_print_status: 'to_print', gelato_status: 'pending' }, { trackingCode: 'T1', trackingUrl: 'https://track.example/T1' }, '2026-11-20T10:00:00Z');
    for (const k of ['tracking_code', 'tracking_url', 'tracking_number', 'carrier', 'carrier_name', 'shipped_at']) assert.ok(!(k in f), k);
    assert.equal(f.gelato_tracking_code, 'T1'); assert.equal(f.gelato_tracking_url, 'https://track.example/T1'); assert.equal(f.gelato_status, 'shipped');
    assert.equal(sr.gelatoSplitTrackingFields({ status: 'confirmed' }, { trackingUrl: 'javascript:alert(1)' }, 'n').gelato_tracking_url, null);
    assert.equal(sr.gelatoSplitTrackingFields({ status: 'cancelled' }, {}, 'n').status, undefined);
  });

  console.log('Gelato webhook: whole-order statuses the database accepts');
  await t('raw Gelato statuses become values the CHECK allows', () => {
    const allowed = ['pending', 'processing', 'shipped', 'delivered', 'error'];
    for (const raw of ['created', 'uploading', 'passed', 'in_production', 'printed', 'shipped', 'in_transit', 'delivered', 'failed', 'canceled', 'cancelled', 'on_hold', 'something_new', undefined]) {
      assert.ok(allowed.includes(sr.gelatoWholeOrderStatusFields({ status: 'confirmed' }, raw).gelato_status), String(raw));
    }
    assert.equal(sr.gelatoWholeOrderStatusFields({ status: 'confirmed' }, 'created').gelato_status, 'pending');
    assert.equal(sr.gelatoWholeOrderStatusFields({ status: 'confirmed' }, 'canceled').gelato_status, 'error');
  });
  await t('non-split: gelato_status always written, orders.status only for shipped/delivered on an overwritable order', () => {
    const f = sr.gelatoWholeOrderStatusFields;
    assert.deepEqual(f({ status: 'cancelled', gelato_status: 'processing' }, 'shipped'), { gelato_status: 'shipped' });
    assert.deepEqual(f({ status: 'refunded', gelato_status: 'processing' }, 'delivered'), { gelato_status: 'delivered' });
    assert.deepEqual(f({ status: 'confirmed', gelato_status: 'pending' }, 'in_production'), { gelato_status: 'processing' });
    assert.deepEqual(f({ status: 'confirmed' }, 'failed'), { gelato_status: 'error' });
    assert.deepEqual(f({ status: 'processing', gelato_status: 'shipped' }, 'delivered'), { gelato_status: 'delivered', status: 'delivered' });
    assert.deepEqual(f({ status: 'confirmed' }, 'shipped'), { gelato_status: 'shipped', status: 'shipped' });
    assert.deepEqual(f({ status: 'delivered', gelato_status: 'delivered' }, 'shipped'), { gelato_status: 'delivered', status: 'delivered' });
    assert.deepEqual(sr.gelatoWholeOrderTrackingStatusFields({ status: 'cancelled' }), { gelato_status: 'shipped' });
    assert.deepEqual(sr.gelatoWholeOrderTrackingStatusFields({ status: 'processing', gelato_status: 'delivered' }), { gelato_status: 'delivered', status: 'delivered' });
  });
  await t('Gelato webhook token check', async () => {
    const gw = await import('../lib/fulfillment/gelato-webhook');
    assert.equal(gw.webhookTokenOk('s3cret', 's3cret'), true);
    assert.equal(gw.webhookTokenOk('wrong!', 's3cret'), false);
    assert.equal(gw.webhookTokenOk('short', 's3cret-long'), false);
    assert.equal(gw.webhookTokenOk('', ''), false);
    assert.equal(gw.webhookTokenOk('x', ''), false);
    assert.equal(gw.webhookTokenOk('x', undefined), false);
    assert.equal(gw.webhookTokenOk(null, 's3cret'), false);
    assert.equal(gw.webhookTokenOk(undefined, 's3cret'), false);
    assert.equal(gw.validGelatoOrderId('abc-123_X'), true);
    assert.equal(gw.validGelatoOrderId('a,b.eq.1'), false);
    assert.equal(gw.validGelatoOrderId(''), false);
    assert.equal(gw.validGelatoOrderId('a'.repeat(101)), false);
    assert.equal(gw.validGelatoOrderId(5), false);
  });
  await t('download failure stays in error_message', () => {
    const r = sr.splitRoutingFields({ selfCount: 1, gelatoCount: 1, gelato: 'sent', gelatoOrderId: 'g1', digitalOk: false, digitalError: 'link failed' });
    assert.equal(r.error_message, 'link failed');
    const r2 = sr.splitRoutingFields({ selfCount: 1, gelatoCount: 1, gelato: 'not_sent', error: 'Not sent to Gelato yet', digitalOk: false, digitalError: 'link failed' });
    assert.equal(r2.error_message, 'link failed | Not sent to Gelato yet');
    assert.equal(sr.splitRoutingFields({ selfCount: 1, gelatoCount: 0, gelato: 'none', digitalOk: true }).error_message, null);
  });

  console.log(`\n${n} checks passed`);
})().catch(e => { console.error('\n✗ FAILED:', e); process.exit(1); });
