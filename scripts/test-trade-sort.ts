/**
 * Trade print order line order: size (S, M, L, XL), then dogs before cats, then breed A–Z
 * (no breed last), then design title, then the order lines were added.
 * Run: npx tsx scripts/test-trade-sort.ts (with the dummy env vars from the run-checks skill)
 */
import assert from 'node:assert/strict';
import { sortTradeLines } from '../lib/stock/trade-prints';

export {};

let passed = 0;
const check = (name: string, fn: () => void) => { fn(); passed++; void name; };

type Info = { title: string; breed?: string | null; animal?: string | null };
const info = new Map<string, Info>([
  ['lab', { title: 'Game Day Glory', breed: 'Labrador Retriever', animal: 'dog' }],
  ['beagle', { title: 'Space Cadet', breed: 'beagle', animal: 'dog' }],            // lower case sorts with B
  ['corgi', { title: 'Cosmic Corgi', breed: 'Corgi', animal: 'dog' }],
  ['siamese', { title: 'Queen Cleo', breed: 'Siamese', animal: 'cat' }],
  ['bengal', { title: 'Jungle King', breed: 'Bengal', animal: 'cat' }],
  ['nobreedA', { title: 'Alpha', breed: null, animal: null }],
  ['nobreedZ', { title: 'Zulu', breed: null, animal: null }],
]);
const line = (image_id: string, size: string, created_at: string) => ({ image_id, size, created_at });
const order = (ls: { image_id: string; size: string }[]) => ls.map(l => `${l.size}:${l.image_id}`);

check('size order is S, M, L, XL (not alphabetical)', () => {
  const out = sortTradeLines([line('lab', 'XL', '1'), line('lab', 'L', '2'), line('lab', 'S', '3'), line('lab', 'M', '4')], info);
  assert.deepEqual(order(out), ['S:lab', 'M:lab', 'L:lab', 'XL:lab']);
});

check('within a size: dogs, then cats, then unknown; breed A–Z ignoring case', () => {
  const out = sortTradeLines([
    line('siamese', 'M', '1'), line('nobreedZ', 'M', '2'), line('lab', 'M', '3'), line('bengal', 'M', '4'),
    line('beagle', 'M', '5'), line('corgi', 'M', '6'), line('nobreedA', 'M', '7'),
  ], info);
  assert.deepEqual(order(out), ['M:beagle', 'M:corgi', 'M:lab', 'M:bengal', 'M:siamese', 'M:nobreedA', 'M:nobreedZ']);
});

check('size beats animal and breed', () => {
  const out = sortTradeLines([line('beagle', 'L', '1'), line('siamese', 'S', '2')], info);
  assert.deepEqual(order(out), ['S:siamese', 'L:beagle']);
});

check('same breed: title, then the order added', () => {
  const two = new Map<string, Info>([
    ['a', { title: 'Bravo', breed: 'Pug', animal: 'dog' }],
    ['b', { title: 'alpha', breed: 'Pug', animal: 'dog' }],
    ['c', { title: 'alpha', breed: 'Pug', animal: 'dog' }],
  ]);
  const out = sortTradeLines([line('a', 'M', '1'), line('c', 'M', '3'), line('b', 'M', '2')], two);
  assert.deepEqual(order(out), ['M:b', 'M:c', 'M:a']);
});

check('design missing from the lookup goes last in its size; input not mutated', () => {
  const input = [line('ghost', 'S', '1'), line('lab', 'S', '2')];
  const out = sortTradeLines(input, info);
  assert.deepEqual(order(out), ['S:lab', 'S:ghost']);
  assert.deepEqual(order(input), ['S:ghost', 'S:lab']);
});

check('empty list', () => assert.deepEqual(sortTradeLines([], info), []));

console.log(`trade-sort: ${passed} passed`);
