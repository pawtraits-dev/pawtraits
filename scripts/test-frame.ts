// Run: npx tsx scripts/test-frame.ts
import { FRAME_STYLES, estimateWidth, fitSize, frameBase, frameBaseForWidth, frameCrop, frameLayers, frameLayout, frameShapeFor, frameTitle, readFrameOverlay, sameCard, type FrameCard } from '../lib/frames/frame';
import { TAROT } from '../lib/tarot';
import { BLEED_BACKGROUND, framedPrintShape, framedPrintTransformation } from '../lib/frames/print';
import { FRAMED_PRINTS_ONLY, framedProductAllowed, isFramed } from '../lib/frames/rules';
import { SELF_PRINT_BLEED_MM, planPrint, planUpscale } from '../lib/print/print-geometry';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra?: unknown) => { if (cond) pass++; else { fail++; console.log('FAIL', name, extra ?? ''); } };

// Shapes and titles
ok('shape 2:3', frameShapeFor(2 / 3) === '2:3' && frameShapeFor(0.6) === '2:3' && frameShapeFor(0.7) === '2:3');
ok('shape 3:4', frameShapeFor(3 / 4) === '3:4' && frameShapeFor(0.8) === '3:4' && frameShapeFor(0.72) === '3:4');
ok('shape bad aspect', frameShapeFor(0) === '2:3' && frameShapeFor(NaN) === '2:3' && frameShapeFor(-1) === '2:3');
ok('title with pet', frameTitle('Taurus', 'Daisy') === 'DAISY · TAURUS');
ok('title without pet', frameTitle('Taurus') === 'TAURUS' && frameTitle('Taurus', '  ') === 'TAURUS' && frameTitle('Taurus', null) === 'TAURUS');
ok('pet name capped at 14', frameTitle('Leo', 'Bartholomew The Third') === 'BARTHOLOMEW TH · LEO', frameTitle('Leo', 'Bartholomew The Third'));
ok('pet name trimmed', frameTitle('Leo', '  Rex  ') === 'REX · LEO');

// Sizing and shrinking (fitSize and estimateWidth are unit-free)
const P23 = FRAME_STYLES.celestial.geometry['2:3'].plate;
const P34 = FRAME_STYLES.celestial.geometry['3:4'].plate;
ok('plate geometry 2:3', P23.x0 === 0.2664 && P23.x1 === 0.7377 && P23.y0 === 0.9114 && P23.y1 === 0.9561);
ok('plate geometry 3:4', P34.x0 === 0.2664 && P34.x1 === 0.7377 && P34.y0 === 0.9002 && P34.y1 === 0.9506);
ok('fitSize keeps a short line', fitSize('LEO', 30, 400, 0.1) === 30);
const long = 'BARTHOLOMEW TH · SAGITTARIUS';
const fitted = fitSize(long, 30, 400, 0.1);
ok('fitSize shrinks a long line to fit', fitted < 30 && Math.abs(estimateWidth(long, fitted, 0.1) - 400) < 1e-9);
ok('bases', JSON.stringify(frameBase('2:3', { width: 1664, height: 2496 })) === '{"width":1664,"height":2496}' && JSON.stringify(frameBase('3:4', { width: 1664, height: 2496 })) === '{"width":1662,"height":2216}' && JSON.stringify(frameBaseForWidth('3:4', 900)) === '{"width":900,"height":1200}' && frameCrop({ width: 900, height: 1200 }) === 'c_fill,w_900,h_1200,g_center');
ok('base is required and whole pixels', (() => { try { (frameLayers as any)({ title: 'A', tagline: null, medallion: null }, '2:3'); return false; } catch { /* needed */ } try { frameLayers({ title: 'A', tagline: null, medallion: null }, '2:3', { width: 1000.5, height: 1500 }); return false; } catch { return true; } })());

// Layout arithmetic on 1000 × 1500 (2:3)
const B1 = { width: 1000, height: 1500 };
const solo: FrameCard = { title: 'LEO', tagline: null, medallion: { numeral: 'II' } };
const lo = frameLayout(solo, '2:3', B1);
const plateH = (P23.y1 - P23.y0) * 1500;                 // 67.05 px
ok('plate is about 67 px tall', Math.abs(plateH - 67.05) < 1e-6);
ok('solo title size is 0.46 of the plate height', lo.title.size === Math.round(0.46 * plateH) && lo.tagline === null, lo.title.size);
ok('title letter spacing is 0.10 of its size', lo.title.spacing === Math.round(0.10 * lo.title.size));
const plateCy = ((P23.y0 + P23.y1) / 2) * 1500 - 750;     // offset of the plate centre from the base centre
ok('solo title: capitals centred on the plate (layer up by 0.02 of its size)', lo.title.dy === Math.round(plateCy - 0.02 * lo.title.size), [lo.title.dy, plateCy]);
const tag = frameLayout({ ...solo, tagline: 'Born to Rule' }, '2:3', B1);
const T = 0.36 * plateH, G = 0.24 * plateH, gap = 0.09 * plateH, cap = 0.708;
ok('title 0.36 / tagline 0.24 of the plate height', tag.title.size === Math.round(T) && tag.tagline!.size === Math.round(G), [tag.title.size, tag.tagline!.size]);
const block = cap * T + gap + cap * G, top = plateCy - block / 2;
ok('title cap band centre', tag.title.dy === Math.round(top + cap * T / 2 - 0.02 * tag.title.size), [tag.title.dy, top]);
ok('tagline cap band centre', tag.tagline!.dy === Math.round(top + cap * T + gap + cap * G / 2 - 0.03 * tag.tagline!.size), [tag.tagline!.dy]);
ok('ink block is centred on the plate', Math.abs(((top + block / 2)) - plateCy) < 1e-9 && tag.title.dy < tag.tagline!.dy);
ok('title shifted right by half its letter spacing', tag.title.dx === Math.round(((P23.x0 + P23.x1) / 2) * 1000 - 500 + tag.title.spacing / 2) && tag.tagline!.dx === Math.round(((P23.x0 + P23.x1) / 2) * 1000 - 500), [tag.title.dx, tag.tagline!.dx]);
ok('engraving: 0.02 of the plate, at least 1 px', tag.engrave === Math.round(0.02 * plateH) && frameLayout(solo, '2:3', { width: 100, height: 150 }).engrave === 1);
ok('max text width is 88% of the plate width', tag.title.maxWidth === Math.round((P23.x1 - P23.x0) * 1000 * 0.88));
// Medallion: exact pixels
const med1 = frameLayout(solo, '2:3', B1).medallion;
ok('2:3 at 1000 × 1500: medallion centre x 500 (offset 0), y 112 from the top (offset -638)', med1.dx === 0 && med1.dy === -638, med1);
ok('2:3 at 1000 × 1500: symbol width 102', med1.symbolWidth === 102);
const B2 = { width: 3540, height: 4720 };
const med2 = frameLayout(solo, '3:4', B2).medallion;
ok('3:4 at 3540 × 4720: medallion centre 396 from the top', 2360 + med2.dy === Math.round(0.0838 * 4720) && 2360 + med2.dy === 396, med2);
ok('3:4 at 3540 × 4720: centre x 1769 (offset -1)', med2.dx === Math.round(0.4997 * 3540 - 1770), med2.dx);
ok('3:4 at 3540 × 4720: symbol width', med2.symbolWidth === Math.round(1.45 * 0.0704 * 3540));
// Numerals: short ones keep full size, long ones shrink to the medallion
const num = (n: string) => frameLayout({ title: 'X', tagline: null, medallion: { numeral: n } }, '2:3', B2).medallion.numeral!;
const r2 = 0.0704 * 3540;
ok('numeral fits 1.5 r (estimate)', ['0', 'II', 'VIII', 'XVIII', 'XXI'].every(n => estimateWidth(num(n).text, num(n).size) <= 1.5 * r2 + 1));
ok('XVIII is smaller than II', num('XVIII').size < num('II').size);
ok('numeral not taller than 0.9 r (cap height 0.708 em)', TAROT.every(t => num(t.numeral).size * 0.708 <= 0.9 * r2 + 1));
ok('numeral centred on the medallion (layer up by 0.02 of its size)', num('II').dy === Math.round(0.0744 * 4720 - 0.02 * num('II').size - 2360), num('II').dy);

// Layers
const dog: FrameCard = { title: 'DAISY · TAURUS', tagline: 'Will not be rushed. Will be fed.', medallion: { symbol: 'taurus' } };
const a = frameLayers(dog, '2:3', B1), b = frameLayers(dog, '3:4', { width: 1000, height: 1333 });
ok('frame layer first', a.startsWith('l_pawtraits:frames:celestial-2x3/c_scale,w_1.0,h_1.0,fl_relative/fl_layer_apply/') && b.startsWith('l_pawtraits:frames:celestial-3x4/'));
ok('symbol layer coloured, in pixels', a.includes('l_pawtraits:zodiac-symbols:taurus/e_colorize:100,co_rgb:D9C48A/c_scale,w_102/fl_layer_apply,g_center,x_0,y_-638'));
ok('custom font syntax', a.includes('l_text:pawtraits:frames:fonts:playfair-display-800.woff2_') && a.includes('l_text:pawtraits:frames:fonts:playfair-display-700-italic.woff2_'));
ok('letter spacing on the title only', /playfair-display-800\.woff2_\d+_letter_spacing_\d+:/.test(a) && !/italic\.woff2_\d+_letter_spacing/.test(a));
ok('each line twice, highlight then ink', a.indexOf('co_rgb:ECDEAA') < a.indexOf('co_rgb:1E1708') && (a.match(/co_rgb:ECDEAA/g) ?? []).length === 2 && (a.match(/co_rgb:1E1708/g) ?? []).length === 2);
ok('highlight is lower than ink', (() => { const ys = a.split('/').filter(p => p.startsWith('fl_layer_apply,g_center')).map(p => Number(/y_(-?\d+)/.exec(p)![1])); return ys[1] > ys[2] && ys[3] > ys[4]; })());
ok('no raw commas or slashes in text', !/Will not/.test(a) && a.includes('Will%20not%20be%20rushed.'));
ok('no layer left open', (a.match(/(^|\/)l_/g) ?? []).length === (a.match(/fl_layer_apply/g) ?? []).length);
ok('shapes differ', a !== b && a.split('/').length === b.split('/').length);
const all = [a, b, frameLayers(dog, '2:3', B2), frameLayers(solo, '3:4', B2)];
ok('no fl_relative except the 1.0 frame layer', all.every(t => (t.match(/fl_relative/g) ?? []).length === 1 && t.includes('c_scale,w_1.0,h_1.0,fl_relative')));
ok('every size and offset is a whole number', all.every(t => t.replace('w_1.0,h_1.0,fl_relative', '').split('/').every(p => { const m = p.startsWith('l_text:') ? p.slice(p.indexOf(':', 7 + 40)) : p; return !/(^|,)(w|h|x|y)_-?\d+\.\d/.test(m) && !/\.woff2_\d+\.\d/.test(p) && !/letter_spacing_-?\d+\.\d/.test(p); })));
ok('no c_mpad, no scale of text', all.every(t => !t.includes('c_mpad') && !/fl_layer_apply,g_center.*fl_relative/.test(t)));
ok('text is limited to the plate width', a.includes(`c_limit,w_${Math.round((P23.x1 - P23.x0) * 1000 * 0.88)}`));

// Awkward text
const odd = frameLayers({ title: 'Rex, "the" 100% / Zoë\'s', tagline: 'Café (très) bon, 50% off', medallion: { numeral: 'IV' } }, '2:3', B1);
ok('comma double-encoded', odd.includes('%252C') && !/[^%]\,\s*the/.test(odd.split('l_text')[2] ?? ''));
ok('slash double-encoded', odd.includes('%252F') && !odd.includes('100%25 /'));
ok('percent encoded', odd.includes('100%25'));
ok('accents and apostrophes', odd.includes('ZO%C3%8B%27S') && odd.includes('Caf%C3%A9%20%28tr%C3%A8s%29'));
ok('title is capitalised', odd.includes('REX%252C'));
ok('middle dot', a.includes('%C2%B7'));
ok('numeral medallion has no symbol layer', !odd.includes('zodiac-symbols') && odd.includes('co_rgb:D9C48A'));
ok('no medallion = no medallion layer', !frameLayers({ title: 'A', tagline: null, medallion: null }, '2:3', B1).includes('D9C48A'));
ok('bad symbol slug ignored', !frameLayers({ title: 'A', tagline: null, medallion: { symbol: 'a/b' } }, '2:3', B1).includes('zodiac-symbols'));

// Stored value
const o = readFrameOverlay({ style: 'celestial', clean_public_id: 'x/y', applied: { title: 'T', tagline: '', medallion: { numeral: 'II' }, at: 'now' } });
ok('readFrameOverlay', o?.clean_public_id === 'x/y' && o.applied?.tagline === null && 'numeral' in (o.applied?.medallion ?? {}));
ok('readFrameOverlay rejects junk', readFrameOverlay(null) === null && readFrameOverlay({}) === null && readFrameOverlay({ clean_public_id: '' }) === null);
ok('readFrameOverlay unknown style falls back', readFrameOverlay({ style: 'x', clean_public_id: 'a', applied: null })?.style === 'celestial');
ok('sameCard', sameCard(dog, { ...dog }) && !sameCard(dog, { ...dog, tagline: null }) && sameCard({ ...dog, tagline: null }, { ...dog, tagline: '' as any }));

// Framed print files
const src = { width: 1664, height: 2496 };      // a 2:3 picture
const smallPlan = planPrint(src, 15, 20), smallBleed = planPrint(src, 15, 20, { bleedMm: SELF_PRINT_BLEED_MM });
ok('Small is 3:4, Medium 2:3, Large 3:4', framedPrintShape(smallPlan.size) === '3:4' && framedPrintShape(planPrint(src, 20, 30).size) === '2:3' && framedPrintShape(planPrint(src, 30, 40).size) === '3:4');
ok('not framed: landscape, square, odd shapes', framedPrintShape(planPrint({ width: 2496, height: 1664 }, 15, 20).size) === null && framedPrintShape(planPrint(src, 20, 20).size) === null && framedPrintShape({ widthMm: 100, heightMm: 140 }) === null);
ok('within 3% of 3:4 still framed', framedPrintShape({ widthMm: 150, heightMm: 201 }) === '3:4' && framedPrintShape({ widthMm: 150, heightMm: 215 }) === null);
const card: FrameCard = { title: 'ARIES', tagline: 'First through every door', medallion: { symbol: 'aries' } };
const fp = framedPrintTransformation(smallPlan, null, card, '3:4');
const parts = fp.split('/');
ok('print: crop, then scale to print size, then the frame', parts[0].startsWith('c_crop,') && parts[1] === `c_scale,w_${smallPlan.outputPx.width},h_${smallPlan.outputPx.height},q_100` && parts[2].startsWith('l_pawtraits:frames:celestial-3x4'));
ok('print: no bleed padding', !fp.includes('c_pad'));
const up = planUpscale(planPrint({ width: 800, height: 1200 }, 15, 20), 25)!;
const fu = framedPrintTransformation(planPrint({ width: 800, height: 1200 }, 15, 20), up, card, '3:4').split('/');
ok('print: AI upscale happens before the frame', fu.indexOf('e_upscale') > 0 && fu.indexOf('e_upscale') < fu.findIndex(p => p.startsWith('l_pawtraits:frames')));
const fb = framedPrintTransformation(smallPlan, null, card, '3:4', { bleedOutputPx: smallBleed.outputPx }).split('/');
ok('self-print: same framed image, padded last with the blurred edge', fb.slice(0, -1).join('/') === fp && fb[fb.length - 1] === `c_pad,w_${smallBleed.outputPx.width},h_${smallBleed.outputPx.height},${BLEED_BACKGROUND}`);
ok('bleed is larger than the trim, frame stays at the trim size', smallBleed.outputPx.width > smallPlan.outputPx.width && fb.some(p => p === `c_scale,w_${smallPlan.outputPx.width},h_${smallPlan.outputPx.height},q_100`));
// Prints-only rule
ok('prints allowed', framedProductAllowed({ product_type: 'physical_print', media_name: 'Foamex', name: 'Small' }) && framedProductAllowed(null));
ok('downloads, mugs and phone cases refused', !framedProductAllowed({ product_type: 'digital_download' }) && !framedProductAllowed({ product_type: 'physical_print', media_name: 'Ceramic mug' }) && !framedProductAllowed({ product_type: 'physical_print', name: 'iPhone 15 Phone Case' }) && !framedProductAllowed({ sku: 'DIGITAL' }));
ok('isFramed: catalogue and customer images', isFramed({ frame_overlay: { clean_public_id: 'a', applied: { title: 'T', medallion: null, at: '' } } }) && isFramed({ generation_metadata: { frame: { title: 'ARIES' } } }) && !isFramed({ frame_overlay: { clean_public_id: 'a', applied: null } }) && !isFramed({ generation_metadata: {} }) && !isFramed(null));
ok('prints-only message', /prints only/.test(FRAMED_PRINTS_ONLY));
if (process.env.SHOW) { console.log(fp); console.log(fb.join('/')); }

console.log(fail ? `${fail} failed, ${pass} passed` : `${pass} passed`);
process.exit(fail ? 1 : 0);
