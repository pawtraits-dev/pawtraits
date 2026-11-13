// Run: npx tsx scripts/test-frame.ts
import { FRAME_LAYOUT, FRAME_STYLES, RENDER_PX, estimateWidth, fitSize, frameCrop, frameLayers, frameLayout, frameShapeFor, frameTitle, readFrameOverlay, rel, sameCard, type FrameCard } from '../lib/frames/frame';
import { TAROT } from '../lib/tarot';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra?: unknown) => { if (cond) pass++; else { fail++; console.log('FAIL', name, extra ?? ''); } };

// Shapes and titles
ok('shape 2:3', frameShapeFor(2 / 3) === '2:3' && frameShapeFor(0.6) === '2:3' && frameShapeFor(0.7) === '2:3');
ok('shape 3:4', frameShapeFor(3 / 4) === '3:4' && frameShapeFor(0.8) === '3:4' && frameShapeFor(0.72) === '3:4');
ok('shape bad aspect', frameShapeFor(0) === '2:3' && frameShapeFor(NaN) === '2:3' && frameShapeFor(-1) === '2:3');
ok('crop', frameCrop('3:4') === 'c_fill,ar_3:4,g_center');
ok('title with pet', frameTitle('Taurus', 'Daisy') === 'DAISY · TAURUS');
ok('title without pet', frameTitle('Taurus') === 'TAURUS' && frameTitle('Taurus', '  ') === 'TAURUS' && frameTitle('Taurus', null) === 'TAURUS');
ok('pet name capped at 14', frameTitle('Leo', 'Bartholomew The Third') === 'BARTHOLOMEW TH · LEO', frameTitle('Leo', 'Bartholomew The Third'));
ok('pet name trimmed', frameTitle('Leo', '  Rex  ') === 'REX · LEO');
ok('relative numbers', rel(1) === '1.0' && rel(0) === '0' && rel(-0.00001) === '0' && rel(0.123456) === '0.1235' && rel(-0.5) === '-0.5');

// Sizing and shrinking
const plateW = (s: '2:3' | '3:4') => { const p = FRAME_STYLES.celestial.geometry[s].plate; return (p.x1 - p.x0) * FRAME_LAYOUT.fit; };
ok('fitSize keeps a short line', fitSize('LEO', 0.03, 0.4, 0.1) === 0.03);
const long = 'BARTHOLOMEW TH · SAGITTARIUS';
const fitted = fitSize(long, 0.03, plateW('2:3'), 0.1);
ok('fitSize shrinks a long line to fit', fitted < 0.03 && Math.abs(estimateWidth(long, fitted, 0.1) - plateW('2:3')) < 1e-9);
const small: FrameCard = { title: 'LEO', tagline: null, medallion: { numeral: 'II' } };
const lo = frameLayout(small, '2:3');
const plateHW = (0.9544 - 0.9096) / (2 / 3);
ok('solo title is bigger (0.46 of plate height)', Math.abs(lo.title.size - 0.46 * plateHW) < 1e-9 && lo.tagline === null);
const tag = frameLayout({ ...small, tagline: 'Born to be adored' }, '2:3');
ok('title 0.36 / tagline 0.24 of plate height', Math.abs(tag.title.size - 0.36 * plateHW) < 1e-9 && Math.abs(tag.tagline!.size - 0.24 * plateHW) < 1e-9);
ok('title above tagline, both inside the plate', tag.title.y < tag.tagline!.y && tag.title.y > 0.9096 && tag.tagline!.y < 0.9544);
const mid = (0.9096 + 0.9544) / 2;
const both = (tag.title.y + tag.tagline!.y) / 2;
ok('the two lines sit about the plate centre', Math.abs(both - mid) < 0.01, [both, mid]);
ok('solo title about the plate centre', Math.abs(lo.title.y - mid) < 0.01);
// Numerals: short ones keep full size, long ones shrink to the medallion
const num = (n: string) => frameLayout({ title: 'X', tagline: null, medallion: { numeral: n } }, '2:3').medallion.numeral!;
ok('numeral fits width 1.5 r', ['0', 'II', 'VIII', 'XVIII', 'XXI'].every(n => estimateWidth(num(n).text, num(n).size) <= 1.5 * 0.0704 + 1e-9));
ok('XVIII is smaller than II', num('XVIII').size < num('II').size);
ok('numeral not taller than 0.9 r (cap height 0.708 em)', TAROT.every(t => num(t.numeral).size * 0.708 <= 0.9 * 0.0704 + 1e-9));
ok('every tarot numeral lays out', TAROT.every(t => !!num(t.numeral)));

// Layers
const dog: FrameCard = { title: 'DAISY · TAURUS', tagline: 'Will not be rushed. Will be fed.', medallion: { symbol: 'taurus' } };
const a = frameLayers(dog, '2:3'), b = frameLayers(dog, '3:4');
ok('frame layer first', a.startsWith('l_pawtraits:frames:celestial-2x3/c_scale,w_1.0,h_1.0,fl_relative/fl_layer_apply/') && b.startsWith('l_pawtraits:frames:celestial-3x4/'));
ok('symbol layer coloured and sized 1.45 r', a.includes('l_pawtraits:zodiac-symbols:taurus/e_colorize:100,co_rgb:D9C48A/c_scale,w_0.1021,fl_relative'));
ok('custom font syntax', a.includes('l_text:pawtraits:frames:fonts:playfair-display-800.woff2_') && a.includes('l_text:pawtraits:frames:fonts:playfair-display-700-italic.woff2_'));
ok('letter spacing on the title only', /playfair-display-800\.woff2_\d+_letter_spacing_\d+:/.test(a) && !/italic\.woff2_\d+_letter_spacing/.test(a));
ok('each line twice, highlight then ink', a.indexOf('co_rgb:ECDEAA') < a.indexOf('co_rgb:1E1708') && (a.match(/co_rgb:ECDEAA/g) ?? []).length === 2 && (a.match(/co_rgb:1E1708/g) ?? []).length === 2);
ok('no raw commas or slashes in text', !/Will not/.test(a) && a.includes('Will%20not%20be%20rushed.'));
ok('no layer left open', (a.match(/(^|\/)l_/g) ?? []).length === (a.match(/fl_layer_apply/g) ?? []).length);
ok('shapes differ in geometry (frame image, x/y offsets)', a !== b && a.split('/').length === b.split('/').length);
const sharedParts = a.split('/').filter((p, i) => p === b.split('/')[i]);
ok('everything but geometry is shared (fonts, colours, sizes, boxes)', sharedParts.length >= a.split('/').length - 8, [sharedParts.length, a.split('/').length]);
ok('resolution independent: no pixel positions', a.split('/').filter(p => p.startsWith('fl_layer_apply,g_center')).every(p => /x_-?[\d.]+,y_-?[\d.]+,fl_relative$/.test(p)));
ok('text boxes scale by width share', a.split('/').filter(p => p.startsWith('c_scale,w_')).every(p => /fl_relative$/.test(p)));
ok('render size is RENDER_PX per width', a.includes(`c_limit,w_${Math.round(plateW('2:3') * RENDER_PX)},`));

// Awkward text
const odd = frameLayers({ title: 'Rex, "the" 100% / Zoë\'s', tagline: 'Café (très) bon, 50% off', medallion: { numeral: 'IV' } }, '2:3');
ok('comma double-encoded', odd.includes('%252C') && !/[^%]\,\s*the/.test(odd.split('l_text')[2] ?? ''));
ok('slash double-encoded', odd.includes('%252F') && !odd.includes('100%25 /'));
ok('percent encoded', odd.includes('100%25'));
ok('accents and apostrophes', odd.includes('ZO%C3%8B%27S') && odd.includes('Caf%C3%A9%20%28tr%C3%A8s%29'));
ok('title is capitalised', odd.includes('REX%252C'));
ok('middle dot', a.includes('%C2%B7'));
ok('numeral medallion has no symbol layer', !odd.includes('zodiac-symbols') && odd.includes('co_rgb:D9C48A'));
ok('no medallion = no medallion layer', !frameLayers({ title: 'A', tagline: null, medallion: null }, '2:3').includes('D9C48A'));
ok('bad symbol slug ignored', !frameLayers({ title: 'A', tagline: null, medallion: { symbol: 'a/b' } }, '2:3').includes('zodiac-symbols'));

// Stored value
const o = readFrameOverlay({ style: 'celestial', clean_public_id: 'x/y', applied: { title: 'T', tagline: '', medallion: { numeral: 'II' }, at: 'now' } });
ok('readFrameOverlay', o?.clean_public_id === 'x/y' && o.applied?.tagline === null && 'numeral' in (o.applied?.medallion ?? {}));
ok('readFrameOverlay rejects junk', readFrameOverlay(null) === null && readFrameOverlay({}) === null && readFrameOverlay({ clean_public_id: '' }) === null);
ok('readFrameOverlay unknown style falls back', readFrameOverlay({ style: 'x', clean_public_id: 'a', applied: null })?.style === 'celestial');
ok('sameCard', sameCard(dog, { ...dog }) && !sameCard(dog, { ...dog, tagline: null }) && sameCard({ ...dog, tagline: null }, { ...dog, tagline: '' as any }));

console.log(fail ? `${fail} failed, ${pass} passed` : `${pass} passed`);
process.exit(fail ? 1 : 0);
