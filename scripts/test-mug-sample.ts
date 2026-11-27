/** Run: npx tsx scripts/test-mug-sample.ts */
export {};
import assert from "node:assert/strict";
const s = require('../lib/mugs/sample');

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('  ✓', name); };
const ok = (b: any) => s.validateSampleInput(b);
const photo = 'pawtraits/mugs/sample-photos/abc123';

t('name of 20 characters is allowed, 21 is refused', () => {
  assert.equal(ok({ mode: 'reference', colour: 'red', name: 'a'.repeat(20) }).ok, true);
  const r = ok({ mode: 'reference', colour: 'red', name: 'a'.repeat(21) });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'Enter a name for the mug (up to 20 characters)');
});
t('empty or blank name is refused (the wrap text needs one)', () => {
  assert.equal(ok({ mode: 'reference', colour: 'red', name: '' }).ok, false);
  assert.equal(ok({ mode: 'reference', colour: 'red', name: '   ' }).ok, false);
});
t('name is trimmed', () => {
  assert.equal(ok({ mode: 'reference', colour: 'red', name: '  Daisy ' }).value.name, 'Daisy');
});
t('bad mode refused', () => {
  assert.equal(ok({ mode: 'other', colour: 'red', name: 'Daisy' }).ok, false);
  assert.equal(ok({ colour: 'red', name: 'Daisy' }).ok, false);
});
t('missing colour refused', () => {
  assert.equal(ok({ mode: 'reference', name: 'Daisy' }).ok, false);
});
t('photo mode needs a photo inside the samples folder', () => {
  assert.equal(ok({ mode: 'photo', colour: 'red', name: 'Daisy', photo_public_id: photo }).ok, true);
  assert.equal(ok({ mode: 'photo', colour: 'red', name: 'Daisy' }).ok, false);
  assert.equal(ok({ mode: 'photo', colour: 'red', name: 'Daisy', photo_public_id: 'pawtraits/mugs/pet-photos/x' }).ok, false);
  assert.equal(ok({ mode: 'photo', colour: 'red', name: 'Daisy', photo_public_id: 'pawtraits/mugs/sample-photos/' }).ok, false);
  assert.equal(ok({ mode: 'photo', colour: 'red', name: 'Daisy', photo_public_id: 'pawtraits/mugs/sample-photos/../catalog/x' }).ok, false);
});
t('reference mode ignores any photo id', () => {
  assert.equal(ok({ mode: 'reference', colour: 'red', name: 'Daisy', photo_public_id: 'junk' }).value.photoPublicId, undefined);
});
t('wrap id naming', () => {
  assert.equal(s.sampleWrapPublicId('leo', 'red', 'abc'), 'pawtraits/mugs/samples/leo-red-abc');
});

console.log(`mug-sample: ${n} passed`);
