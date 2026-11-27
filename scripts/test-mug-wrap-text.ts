/** Mug wrap text: full description, emphasised closing line in bold, sized to fit. Run: npx tsx scripts/test-mug-wrap-text.ts */
import assert from 'node:assert/strict';
import { splitTagline, mugWrapText, textBlockHeight, MUG_TEXT_ROOM, MUG_BODY_SIZES } from '../lib/mugs/wrap-text';

export {};
let passed = 0;
const t = (name: string, fn: () => void) => { try { fn(); passed++; } catch (e) { console.error('FAIL', name); throw e; } };

const ARIES = `Born to lead, impossible to stop. The Aries dog treats every walk like a military conquest, every squirrel like a personal nemesis, and every meal like it might be their last. Fiercely loyal, hilariously dramatic, and powered by pure chaos and boundless enthusiasm, they will drag you on adventures you never planned.

*Life is never boring with an Aries dog in charge*`;

t('aries: tagline split off, body whole, no ellipsis', () => {
  const r = mugWrapText(ARIES, 'Born to lead…');
  assert.equal(r.tagline, 'Life is never boring with an Aries dog in charge');
  assert.ok(r.body.endsWith('adventures you never planned.'));
  assert.ok(!r.body.includes('…') && !r.body.includes('*'));
  assert.ok(textBlockHeight(r.body, r.tagline, r.fontSize) <= MUG_TEXT_ROOM);
});
t('double asterisks and underscores count as emphasis', () => {
  assert.equal(splitTagline('Body text.\n\n**Bold close**').tagline, 'Bold close');
  assert.equal(splitTagline('Body text.\n\n_Italic close_').tagline, 'Italic close');
});
t('closing line on the next line of the same paragraph', () => {
  const r = splitTagline('Body text here.\n*The close*');
  assert.equal(r.body, 'Body text here.');
  assert.equal(r.tagline, 'The close');
});
t('no emphasised close: whole text is body', () => {
  const r = splitTagline('One paragraph.\n\nAnother **with bold** inside.');
  assert.equal(r.tagline, null);
  assert.equal(r.body, 'One paragraph. Another with bold inside.');
});
t('a single emphasised paragraph is body, not tagline', () => {
  assert.deepEqual(splitTagline('*Only this*'), { body: 'Only this', tagline: null });
});
t('empty description falls back to the short one', () => {
  const r = mugWrapText('', 'Short **words**');
  assert.equal(r.body, 'Short words');
  assert.equal(r.tagline, null);
  assert.equal(r.fontSize, MUG_BODY_SIZES[0]);
});
t('long text steps the size down', () => {
  const long = Array(9).fill('A sentence of moderate length about a dog and its many adventures.').join(' ');
  const r = mugWrapText(`${long}\n\n*Close*`, null);
  assert.ok(r.fontSize < MUG_BODY_SIZES[0]);
  assert.ok(textBlockHeight(r.body, r.tagline, r.fontSize) <= MUG_TEXT_ROOM);
  assert.equal(r.tagline, 'Close');
});
t('very long text is shortened at the smallest size, tagline kept', () => {
  const huge = Array(40).fill('Words words words words words words words words.').join(' ');
  const r = mugWrapText(`${huge}\n\n*Kept close*`, null);
  assert.equal(r.fontSize, MUG_BODY_SIZES[MUG_BODY_SIZES.length - 1]);
  assert.ok(r.body.endsWith('…'));
  assert.equal(r.tagline, 'Kept close');
  assert.ok(textBlockHeight(r.body, r.tagline, r.fontSize) <= MUG_TEXT_ROOM);
});
t('painted picture: near-white becomes the canvas white', () => {
  const { buildMugPrintUrl } = require('../lib/cloudinary-mug');
  const url = decodeURIComponent(buildMugPrintUrl({ personalisedImagePublicId: 'pawtraits/x/pet', petName: 'Daisy', mugColour: { overlay_hex: 'E8B931' }, catalogEntry: { name: 'Aries', sub_heading: 'The Adventurer', description: 'Body.' } }));
  const layer = url.split('/').find((p: string) => p.includes('l_pawtraits:x:pet')) || '';
  assert.ok(layer.includes('e_make_transparent:12') && layer.includes('co_white'), layer);
});
console.log(`mug-wrap-text: ${passed} passed`);
