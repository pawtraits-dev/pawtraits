/** Checks for designs with several pets (npm run test:multipet) */
import { buildSlots, slotNow } from '../lib/catalog/slots';
import { buildMultiSubjectReplacementPrompt } from '../lib/variation-prompt-builder';
import { parseCountReply } from '../lib/catalog/pet-count';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra?: unknown) => { if (cond) pass++; else { fail++; console.log('FAIL', name, extra ?? ''); } };
const breeds = new Map([['b', { name: 'Beagle', animal_type: 'dog' }], ['p', { name: 'Persian', animal_type: 'cat' }], ['l', { name: 'Labrador Retriever', animal_type: 'dog' }]]);

// Slots: left to right, labels people understand
let s = buildSlots([
  { subjectOrder: 1, isPrimary: true, breedId: 'p', position: 'right', poseDescription: 'lying, camera gaze, calm' },
  { subjectOrder: 2, breedId: 'b', position: 'left foreground', poseDescription: 'sitting, camera gaze' },
], breeds);
ok('sorted left to right', s.map(x => x.label).join() === 'Left,Right', s.map(x => x.label));
ok('subjectIndex kept', s[0].subjectIndex === 1 && s[1].subjectIndex === 0);
ok('what’s there now', slotNow(s[0]) === 'a sitting Beagle' && slotNow(s[1]) === 'a lying Persian', [slotNow(s[0]), slotNow(s[1])]);
ok('species from breed', s[0].animalType === 'dog' && s[1].animalType === 'cat');
s = buildSlots([{ breedId: 'b', position: 'center foreground' }, { breedId: 'p', position: 'center background' }], breeds);
ok('stacked → Front / Back', s.map(x => x.label).join() === 'Front,Back', s.map(x => x.label));
s = buildSlots([{ breedId: 'b', position: 'left' }, { breedId: 'p', position: 'center' }, { breedId: 'l', position: 'right' }], breeds);
ok('three: Left / Middle / Right', s.map(x => x.label).join() === 'Left,Middle,Right');
s = buildSlots([{ breedId: 'b' }, { breedId: 'p' }], breeds);
ok('no positions → Pet 1 / Pet 2 in subject order', s.map(x => x.label).join() === 'Pet 1,Pet 2' && s[0].breedName === 'Beagle');
s = buildSlots([{ breedId: 'b', position: 'left' }, { breedId: 'p', position: 'left' }], breeds);
ok('same side twice → numbered', s.map(x => x.label).join() === 'Pet 1,Pet 2', s.map(x => x.label));
ok('one pet → "Your pet"', buildSlots([{ breedId: 'b' }], breeds)[0].label === 'Your pet');
ok('unknown breed → "a pet"', slotNow(buildSlots([{ breedId: 'zzz' }, { breedId: 'b' }], breeds)[0]) === 'a pet');
ok('an before vowels', slotNow({ ...buildSlots([{ breedId: 'l' }, { breedId: 'b' }], breeds)[0], pose: 'alert' }) === 'an alert Labrador Retriever');
ok('handles junk', buildSlots(null as any).length === 0 && buildSlots('x' as any).length === 0);

// Prompt: every photo named against its place
const prompt = buildMultiSubjectReplacementPrompt({
  aspectRatio: '2:3', sizeInstruction: 'SIZE: the Labrador must be larger.',
  slots: [{ label: 'Left', now: 'a sitting Beagle', newPet: { name: 'Biscuit', breed: 'Cockerpoo' } }, { label: 'Right', now: 'a lying Persian', newPet: { animalType: 'cat' } }],
});
ok('prompt: image count', prompt.includes('You are given 3 images') && prompt.includes('It contains 2 pets'));
ok('prompt: image 2 → left, named', prompt.includes('IMAGE 2 replaces the LEFT pet in the reference (currently a sitting Beagle): this is Biscuit, a Cockerpoo.'));
ok('prompt: image 3 → right', prompt.includes('IMAGE 3 replaces the RIGHT pet in the reference (currently a lying Persian): this is a cat.'));
ok('prompt: exactly n pets, never merge', prompt.includes('exactly 2 pets') && prompt.includes('never merge two pets'));
ok('prompt: species swap allowed', prompt.includes('A cat may replace a dog'));
ok('prompt: size rule and ratio', prompt.includes('SIZE: the Labrador must be larger.') && prompt.includes('2:3'));
ok('prompt: numbered places read naturally', buildMultiSubjectReplacementPrompt({ slots: [{ label: 'Pet 1', now: 'a pet' }, { label: 'Pet 2', now: 'a pet' }] }).includes('pet number 2 (counting from the left)'));

// Photo check reply
ok('count reply', parseCountReply('{"pets": 2}') === 2 && parseCountReply('Sure: {"pets":1}') === 1);
ok('count reply junk', parseCountReply('two') === null && parseCountReply('{"pets":"lots"}') === null && parseCountReply('{"pets":-1}') === null);

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
