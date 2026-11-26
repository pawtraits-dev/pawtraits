/**
 * Stall multi-buy saving: tiers, the saving by number of prints, the upsell wording, the setting's validation
 * and the server's price floor. Pure functions only: no network, no database.
 * Run: npx tsx scripts/test-stall-multibuy.ts
 */
import assert from 'node:assert/strict';
import { stallMultibuySaving as save, nextMultibuyStep as next, parseMultibuyTiers as parse, validateMultibuyPence as validate, multibuyMessage as msg, marginalMultibuySaving as marginal, basketStallSummary as basket, DEFAULT_MULTIBUY_PENCE } from '../lib/stall/multibuy';
import { evaluatePriceCheck as evalCheck, goodsFloorPence } from '../lib/checkout/price-check';
import { SETTING_DEFAULTS, validateSetting } from '../lib/app-settings';

let n = 0;
const eq = (a: unknown, b: unknown, m: string) => { assert.deepEqual(a, b, m); n++; };
const ok = (c: unknown, m: string) => { assert.ok(c, m); n++; };

const T = parse(DEFAULT_MULTIBUY_PENCE);
eq(T, [{ count: 2, savingPence: 500 }, { count: 3, savingPence: 1500 }], 'default tiers');
eq(parse(undefined), T, 'missing setting = defaults');
eq(parse(null), T, 'null setting = defaults');
eq(SETTING_DEFAULTS.stall_multibuy_pence, { '2': 500, '3': 1500 }, 'default in settings');

// Saving by number of stall prints (subtotal large enough)
for (const [count, want] of [[0, 0], [1, 0], [2, 500], [3, 1500], [4, 1500], [10, 1500]] as const) eq(save(count, 20000, T), want, `${count} prints`);
// Custom tiers: highest key at or below the count applies
const C = parse({ '2': 300, '4': 1000 });
eq([1, 2, 3, 4, 5].map(c => save(c, 99999, C)), [0, 300, 300, 1000, 1000], 'custom tiers');
// Off
eq(parse({}), [], 'empty = off');
eq(save(5, 99999, []), 0, 'off saves nothing');
// Bad data = off (never guess money)
for (const bad of ['x', 5, [], { '1': 100 }, { '2': -1 }, { '2': 1.5 }, { a: 1 }, { '2': 1500, '3': 500 }, { '2': '500' }]) eq(parse(bad), [], `bad data off: ${JSON.stringify(bad)}`);
// Capped by what the prints cost
eq(save(3, 1000, T), 1000, 'saving capped at the stall subtotal');
eq(save(2, 0, T), 0, 'nothing to save on nothing');
eq(save(3, -50, T), 0, 'negative subtotal');
eq(save(NaN, 5000, T), 0, 'NaN count');

// Validation (admin write)
eq(validate({}), null, 'empty valid');
eq(validate({ '2': 500, '3': 1500 }), null, 'default valid');
eq(validate({ '2': 500, '3': 500 }), null, 'equal is fine');
ok(validate({ '2': 500, '3': 100 }) !== null, 'a higher count must not save less');
ok(validate({ '1': 500 }) !== null, 'count below 2');
ok(validate({ '2': -5 }) !== null, 'negative pence');
ok(validate({ '2': 5.5 }) !== null, 'fractional pence');
ok(validate({ two: 5 }) !== null, 'non-numeric key');
ok(validate([]) !== null && validate(null) !== null && validate('x') !== null, 'not an object');
eq(validateSetting('stall_multibuy_pence', { '2': 500, '3': 1500 }), null, 'validateSetting accepts');
ok(validateSetting('stall_multibuy_pence', { '2': 1500, '3': 500 }) !== null, 'validateSetting rejects');

// Next step
eq(next(0, T), null, 'no prints, no step');
eq(next(1, T), { addOne: true, totalSavingAfter: 500, extraSaving: 500 }, 'one print: add one to save £5');
eq(next(2, T), { addOne: true, totalSavingAfter: 1500, extraSaving: 1000 }, 'two prints: add one to save £15 in total');
eq(next(3, T), null, 'three prints: nothing more');
eq(next(1, []), null, 'off: no step');

// Words (amounts come from the tiers)
eq(msg(0, T), null, 'no prints: no note');
eq(msg(1, T), 'Add another print from the stall and save £5. Scan the sticker on the back of it.', 'message for 1');
eq(msg(2, T), "You're saving £5. Add a third print and save £15 in total. Scan the sticker on the back of it.", 'message for 2');
eq(msg(3, T), "Multi-buy: you're saving £15.", 'message for 3');
eq(msg(7, T), "Multi-buy: you're saving £15.", 'message for 7');
eq(msg(2, []), null, 'off: no note');
eq(msg(1, parse({ '2': 750, '3': 2000 })), 'Add another print from the stall and save £7.50. Scan the sticker on the back of it.', 'amounts follow the setting');

// Joining a basket: the extra saving the buy sheet takes off the total shown
eq(marginal(0, 0, 3000, T), 0, 'first print: nothing off');
eq(marginal(1, 3000, 3000, T), 500, 'second print: £5 off');
eq(marginal(2, 6000, 3000, T), 1000, 'third print: a further £10 (£15 in total)');
eq(marginal(3, 9000, 3000, T), 0, 'fourth print: nothing more');

// Basket reading: only stall lines count
eq(basket([
  { productId: 'stall_print_M', quantity: 1, pricing: { sale_price: 3000 } },
  { productId: 'stall_print_XL', quantity: 1, pricing: { sale_price: 5000 } },
  { productId: '3f8c2a41-0000-4000-8000-000000000000', quantity: 2, pricing: { sale_price: 4500 } },
]), { count: 2, subtotalPence: 8000 }, 'made-to-order lines neither count nor add to the stall subtotal');

// The server's floor: stall prints + catalogue - saving, then referral %, then credit
const stall = 6000;                         // two prints at £30
const saving = save(2, stall, T);           // £5
eq(goodsFloorPence(0, stall, saving), 5500, 'floor = stall - saving');
eq(goodsFloorPence(2500, stall, saving), 8000, 'catalogue goods are untouched by the saving');
eq(goodsFloorPence(0, 1000, 1500), 0, 'saving never takes the floor below the stall prints');
const floor = goodsFloorPence(0, stall, saving);
const st = (amount: number, over: Partial<{ discountRate: number; rewardsAllowed: number; goodsFloor: number; shipping: number }> = {}) =>
  evalCheck({ amount, goodsFloor: floor, shipping: 0, discountRate: 0, rewardsAllowed: 0, ...over }).status;
eq(st(5500), 'ok', 'exact amount with the saving is ok');
eq(st(6000), 'ok', 'an old page that skips the saving is not low');
eq(st(5000), 'low', '£5 under the floor is low');
// Referral 10% comes off the goods after the saving: 5500 * 0.9 = 4950
eq(evalCheck({ amount: 4950, goodsFloor: floor, shipping: 0, discountRate: 0.10, rewardsAllowed: 0 }).required, 4950, 'referral taken after the saving');
eq(st(4950, { discountRate: 0.10 }), 'ok', 'saving then 10% referral, exact, is ok');
eq(st(4450, { discountRate: 0.10 }), 'low', '£5 under that is low');
eq(st(5400, { discountRate: 0.10 }), 'ok', 'skipping the saving but taking the referral is still not low');
eq(st(4500, { discountRate: 0.10, rewardsAllowed: 450 }), 'ok', 'then credit comes off last');
eq(st(5500, { goodsFloor: 5500, shipping: 395 }), 'low', 'skipping delivery is still caught');

console.log(`test-stall-multibuy: ${n} passed`);
