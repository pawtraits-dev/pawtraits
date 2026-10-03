/** Unit checks for search queries and the auto-tagger's answer handling (npm run test:search) */
import { buildSearchQuery, cleanTag } from '../lib/search/query';
import { buildPrompt, cleanTags, parseTagReply } from '../lib/collections/auto-tag';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra?: unknown) => { if (cond) pass++; else { fail++; console.log('FAIL', name, extra ?? ''); } };

// Query building
const q1 = buildSearchQuery('Xmas spaniel');
ok('xmas expands', q1.tsquery!.startsWith('(xmas | christmas | festive'), q1.tsquery);
ok('words ANDed', q1.tsquery!.includes(') & spaniel'), q1.tsquery);
ok('no prefix by default', !q1.tsquery!.includes(':*'));
ok('prefix while typing', buildSearchQuery('cock', { prefix: true }).tsquery === 'cock:*');
ok('prefix only last word', buildSearchQuery('royal cock', { prefix: true }).tsquery!.endsWith('& cock:*'));
ok('short last word no prefix', buildSearchQuery('a', { prefix: true }).tsquery === 'a');
ok('two-word synonym phrase', buildSearchQuery('ice hockey').tsquery === '((ice <-> hockey) | hockey)', buildSearchQuery('ice hockey').tsquery);
ok('new year', buildSearchQuery('new year cat').tsquery!.startsWith('((new <-> year) | nye | hogmanay) & ('), buildSearchQuery('new year cat').tsquery);
ok('punctuation stripped', buildSearchQuery("St. Patrick's!").tsquery === 'st & patricks');
ok('injection chars stripped', !/[&|!():<>]/.test(buildSearchQuery("dog') | (cat").words.join('')));
ok('empty', buildSearchQuery('  !!  ').tsquery === null);
ok('accents', buildSearchQuery('Café').tsquery === 'cafe');
ok('max 8 words', buildSearchQuery('a b c d e f g h i j').words.length === 8);
ok('mom → mum group', buildSearchQuery('mom').tsquery === '(mom | mum | mother | mama | mommy | mummy)');
ok('cleanTag', cleanTag(' Tartan Scarf! ') === 'tartan scarf' && cleanTag('') === null);

// Tag cleaning
const t = cleanTags(['Crown', 'crown', 'AI-generated', 'pet portrait', 'Tartan scarf', 'a very long tag with many words', 'dog', 'Snow!', 'gold & red', 'x'.repeat(40)]);
ok('tags cleaned', JSON.stringify(t) === '["crown","tartan scarf","snow","gold & red"]', t);
ok('tags capped', cleanTags(Array.from({ length: 20 }, (_, i) => `tag ${i}`)).length === 10);
ok('tags non-array', cleanTags('crown').length === 0);

// Reply parsing
const valid = new Set(['occasions/christmas', 'zodiac/leo', 'sports/nfl/kansas-city-chiefs', 'sports', 'sports/nfl', 'pawsonalities/esfb']);
const r1 = parseTagReply('Here you go: {"collections":["occasions/christmas","made/up"],"team":"sports/nfl/kansas-city-chiefs","tags":["santa hat","pet"],"confidence":0.9}', valid);
ok('reply parsed', !!r1 && r1.collections.join() === 'occasions/christmas' && r1.team === 'sports/nfl/kansas-city-chiefs' && r1.tags.join() === 'santa hat' && r1.confidence === 0.9, r1);
ok('league is not a team', parseTagReply('{"collections":[],"team":"sports/nfl","tags":[],"confidence":1}', valid)!.team === null);
ok('sports path not a collection', parseTagReply('{"collections":["sports/nfl/kansas-city-chiefs"],"team":null,"tags":[],"confidence":1}', valid)!.collections.length === 0);
ok('confidence clamped', parseTagReply('{"collections":[],"team":null,"tags":[],"confidence":7}', valid)!.confidence === 1);
ok('garbage → null', parseTagReply('no idea', valid) === null && parseTagReply('{broken', valid) === null);

// Prompt
const prompt = buildPrompt({ pawsonalities: [{ code: 'esfb', name: 'The Party Animal', path: 'pawsonalities/esfb' }] }, { breed: 'Pug', theme: 'Christmas', prompt: 'a pug in a santa hat' });
ok('prompt lists occasions', prompt.includes('occasions/christmas (Christmas)'));
ok('prompt lists teams with colours', /sports\/nfl\/kansas-city-chiefs = Chiefs \(/.test(prompt));
ok('prompt lists pawsonalities', prompt.includes('pawsonalities/esfb (The Party Animal)'));
ok('prompt has breed', prompt.includes('Breed: Pug'));
ok('prompt not huge', prompt.length < 20000, prompt.length);

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
