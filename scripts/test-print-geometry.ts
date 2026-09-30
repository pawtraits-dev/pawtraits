/**
 * Checks for print geometry: one 2:3 / 3:2 reference → S, M, L print files.
 * Run: CLOUDINARY_CLOUD_NAME=demo CLOUDINARY_API_KEY=x CLOUDINARY_API_SECRET=x npx tsx scripts/test-print-geometry.ts
 */
const assert = require('node:assert/strict');
const g = require('../lib/print/print-geometry');
const { toGeminiAspectRatio, geminiImageConfig } = require('../lib/gemini-models');

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('  ✓', name); };
const near = (a: number, b: number, tol = 0.005) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

const portrait = { width: 1664, height: 2496 };   // 2:3
const landscape = { width: 2496, height: 1664 };  // 3:2
const S = [15, 20], M = [20, 30], L = [30, 40];

console.log('allowed shapes');
t('only 1:1, 2:3, 3:2, 2:1', () => {
  for (const r of ['1:1', '2:3', '3:2', '2:1']) assert.ok(g.isAllowedAspectRatio(r));
  for (const r of ['4:5', '3:4', '16:9', '', null]) assert.ok(!g.isAllowedAspectRatio(r));
});
t('nearest allowed ratio', () => {
  assert.deepEqual(g.nearestAllowedRatio(1000, 1500).ratio, '2:3');
  assert.equal(g.nearestAllowedRatio(2100, 900).ratio, '2:1'); // Gemini 21:9 mug art
  assert.ok(g.nearestAllowedRatio(1024, 1024).offBy < 0.001);
});
t('CSS aspect ratio', () => { assert.equal(g.cssAspectRatio('2:3'), '2 / 3'); assert.equal(g.cssAspectRatio(undefined), '1 / 1'); });

console.log('portrait 2:3 reference');
t('M prints edge to edge', () => {
  const p = g.planPrint(portrait, M[0], M[1]);
  assert.deepEqual([p.size.widthMm, p.size.heightMm], [200, 300]);
  assert.equal(p.crop.kept, 1); assert.equal(p.crop.trims, 'none');
  assert.deepEqual(p.outputPx, { width: 2362, height: 3543 });
});
t('S and L are 3:4 crops — 11% off, top and bottom', () => {
  for (const [w, h] of [S, L]) {
    const p = g.planPrint(portrait, w, h);
    assert.equal(p.crop.trims, 'top_bottom');
    near(p.crop.kept, 8 / 9);
    assert.equal(p.crop.width, 1664);
    assert.equal(p.crop.y, Math.round((2496 - p.crop.height) / 2), 'centred');
    near(p.crop.width / p.crop.height, 3 / 4, 0.002);
  }
});
t('product rows stored either way round give the same print', () => {
  assert.deepEqual(g.planPrint(portrait, 20, 15).size, g.planPrint(portrait, 15, 20).size);
});
t('effective dpi and quality', () => {
  const p = g.planPrint(portrait, L[0], L[1]); // 1664 px across 300 mm
  assert.equal(p.effectiveDpi, Math.round(1664 / (300 / 25.4)));
  assert.equal(p.quality, 'low');
  assert.equal(g.planPrint({ width: 3600, height: 5400 }, L[0], L[1]).quality, 'good');
});
t('bleed adds 1.5 mm each side and keeps the crop centred', () => {
  const p = g.planPrint(portrait, S[0], S[1], { bleedMm: 1.5 });
  assert.deepEqual(p.outputPx, { width: g.mmToPx(153), height: g.mmToPx(203) });
  near(p.crop.width / p.crop.height, 153 / 203, 0.002);
});

console.log('landscape 3:2 reference');
t('prints turn landscape; S/L trimmed at the sides', () => {
  const m = g.planPrint(landscape, M[0], M[1]);
  assert.deepEqual([m.size.widthMm, m.size.heightMm], [300, 200]); assert.equal(m.crop.kept, 1);
  const s = g.planPrint(landscape, S[0], S[1]);
  assert.deepEqual([s.size.widthMm, s.size.heightMm], [200, 150]);
  assert.equal(s.crop.trims, 'left_right'); near(s.crop.kept, 8 / 9);
});

console.log('mismatches');
t('square image on a rectangular product is flagged', () => {
  assert.match(g.planPrint({ width: 2048, height: 2048 }, S[0], S[1]).mismatch, /Square image/);
});
t('square image on a square product prints whole', () => {
  const p = g.planPrint({ width: 2048, height: 2048 }, 30, 30);
  assert.equal(p.crop.kept, 1); assert.equal(p.mismatch, null);
});

console.log('customer note');
t('S/L say trimmed, M says nothing', () => {
  assert.match(g.cropNote('portrait', 15, 20), /top and bottom/);
  assert.match(g.cropNote('landscape', 30, 40), /sides/);
  assert.equal(g.cropNote('portrait', 20, 30), null);
  assert.equal(g.cropNote('square', 15, 20), null);
});

console.log('Gemini');
t('2:1 is generated as 21:9, others pass through', () => {
  assert.equal(toGeminiAspectRatio('2:1'), '21:9');
  assert.equal(toGeminiAspectRatio('2:3'), '2:3');
  assert.deepEqual(geminiImageConfig('3:2'), { imageConfig: { imageSize: '2K', aspectRatio: '3:2' } });
  assert.deepEqual(geminiImageConfig(undefined), { imageConfig: { imageSize: '2K' } });
  assert.deepEqual(geminiImageConfig('2:3', '4K'), { imageConfig: { imageSize: '4K', aspectRatio: '2:3' } });
});
t('reads the reference image shape from its bytes', () => {
  const { imageDimensions, ratioOfImage } = require('../lib/gemini-models');
  const png = Buffer.alloc(33); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png, 0);
  png.writeUInt32BE(1696, 16); png.writeUInt32BE(2528, 20);
  assert.deepEqual(imageDimensions(png.toString('base64')), { width: 1696, height: 2528 });
  assert.equal(ratioOfImage(png.toString('base64')), '2:3');
  // minimal JPEG: SOI, APP0 (len 16), SOF0 with 1200×800
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...Array(14).fill(0), 0xff, 0xc0, 0x00, 0x11, 0x08, 0x03, 0x20, 0x04, 0xb0, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(imageDimensions(new Uint8Array(jpg)), { width: 1200, height: 800 });
  assert.equal(ratioOfImage(new Uint8Array(jpg)), '3:2');
  assert.equal(ratioOfImage('not-an-image'), undefined);
});

console.log('AI upscale (Cloudinary e_upscale)');
const preview2k = { width: 1696, height: 2528 };
t('2K preview: S prints sharp without upscaling', () => {
  assert.equal(g.planUpscale(g.planPrint(preview2k, S[0], S[1])), null);
});
t('2K preview: M is upscaled, input kept under 4.2 MP and output within the plan limit', () => {
  const plan = g.planPrint(preview2k, M[0], M[1]);
  const up = g.planUpscale(plan, 25);
  assert.ok(up);
  assert.ok(up.pre.width * up.pre.height <= 4.1e6);
  assert.ok(up.upscaled.width * up.upscaled.height <= 25e6);
  assert.equal(up.upscaled.width, up.pre.width * 4);
});
t('bigger Cloudinary plan limit keeps more of the source', () => {
  const plan = g.planPrint(preview2k, M[0], M[1]);
  const small = g.planUpscale(plan, 25), big = g.planUpscale(plan, 100);
  assert.ok(big.pre.width > small.pre.width);
  assert.ok(big.pre.width * big.pre.height <= 4.1e6, 'never above the AI input limit');
});
t('2K preview L needs a 4K master; a 4K master L does not', () => {
  assert.ok(g.planPrint(preview2k, L[0], L[1]).effectiveDpi < g.PRINT_MASTER_BELOW_DPI);
  const master4k = { width: 3392, height: 5056 };
  const p = g.planPrint(master4k, L[0], L[1]);
  assert.ok(p.effectiveDpi >= g.DPI_OK, `4K master L at ${p.effectiveDpi} dpi`);
  assert.equal(g.planUpscale(p), null);
});

console.log('Cloudinary print URL');
t('explicit centre crop then scale to 300 dpi', () => {
  const { cloudinaryService } = require('../lib/cloudinary');
  const url = cloudinaryService.getCroppedPrintUrl('pawtraits/test', g.planPrint(portrait, S[0], S[1]));
  assert.match(url, /\/c_crop,h_2219,w_1664,x_0,y_139\/c_scale,h_2362,q_100,w_1772\/(v1\/)?pawtraits\/test\.png/);
});
t('upscaled URL: crop → shrink to AI input → e_upscale → final size', () => {
  const { cloudinaryService } = require('../lib/cloudinary');
  const plan = g.planPrint(preview2k, M[0], M[1]);
  const up = g.planUpscale(plan, 25);
  const url = cloudinaryService.getCroppedPrintUrl('pawtraits/test', plan, up);
  assert.match(url, new RegExp(`/c_crop,[^/]+/c_scale,h_${up.pre.height},w_${up.pre.width}/e_upscale/c_scale,h_3543,q_100,w_2362/`));
});

console.log(`\n${n} checks passed`);
