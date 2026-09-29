/**
 * Unit checks for sticker QR helpers. Run: npx tsx scripts/test-qr-stickers.ts
 */
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import { buildStickerUrl, buildStickerPath, parseStickerSegments, normaliseLocationCode } from '../lib/qr/sticker-url';
import { encodeAttribution, decodeAttribution, isBotUserAgent } from '../lib/qr/attribution';

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('  ✓', name); };

console.log('sticker-url');
t('build: ref only', () => assert.equal(buildStickerUrl({ stockRef: 1123 }, 'https://pawtraits.pics'), 'HTTPS://PAWTRAITS.PICS/S/1123'));
t('build: size + location', () => assert.equal(buildStickerUrl({ stockRef: 1123, size: 'M', locationCode: 'camden' }, 'https://pawtraits.pics'), 'HTTPS://PAWTRAITS.PICS/S/1123M/CAMDEN'));
t('build: rejects bad location', () => assert.throws(() => buildStickerPath({ stockRef: 1, locationCode: 'CAMDEN TOWN' })));
t('build: rejects bad ref', () => assert.throws(() => buildStickerPath({ stockRef: 0 })));
t('build: rejects bad size', () => assert.throws(() => buildStickerPath({ stockRef: 5, size: 'X' as any })));
t('parse: ref', () => assert.deepEqual(parseStickerSegments(['1123']), { stockRef: 1123, size: null, locationCode: null }));
t('parse: lower case size + loc', () => assert.deepEqual(parseStickerSegments(['1123m', 'camden']), { stockRef: 1123, size: 'M', locationCode: 'CAMDEN' }));
t('parse: legacy ?l=', () => assert.deepEqual(parseStickerSegments(['1123L'], 'camden'), { stockRef: 1123, size: 'L', locationCode: 'CAMDEN' }));
t('parse: invalid location dropped, ref kept', () => assert.deepEqual(parseStickerSegments(['1123', 'bad-code!']), { stockRef: 1123, size: null, locationCode: null }));
t('parse: junk ref', () => assert.equal(parseStickerSegments(['abc']), null));
t('parse: unknown size letter', () => assert.equal(parseStickerSegments(['1123X']), null));
t('parse: path traversal', () => assert.equal(parseStickerSegments(['..', 'etc']), null));
t('parse: too many segments', () => assert.equal(parseStickerSegments(['1', 'A1', 'B2']), null));
t('parse: huge ref', () => assert.equal(parseStickerSegments(['99999999999']), null));
t('normalise', () => { assert.equal(normaliseLocationCode(' cam1 '), 'CAM1'); assert.equal(normaliseLocationCode('x'), null); });
t('round trip', () => {
  const url = buildStickerUrl({ stockRef: 2045, size: 'S', locationCode: 'MKT2' }, 'https://pawtraits.pics');
  const segs = new URL(url.toLowerCase()).pathname.split('/').slice(2);
  assert.deepEqual(parseStickerSegments(segs), { stockRef: 2045, size: 'S', locationCode: 'MKT2' });
});
t('QR is small (version ≤ 3 at Q) for typical sticker URL', () => {
  const qr = QRCode.create(buildStickerUrl({ stockRef: 12345, size: 'M', locationCode: 'CAMDEN' }, 'https://pawtraits.pics'), { errorCorrectionLevel: 'Q' });
  assert.ok(qr.version <= 3, `version ${qr.version}`);
});

console.log('attribution');
const a = { scanId: '11111111-1111-1111-1111-111111111111', imageId: null, locationId: null, size: 'M', ts: Date.now() };
t('sign/verify round trip', () => assert.deepEqual(decodeAttribution(encodeAttribution(a)), a));
t('tampered payload rejected', () => {
  const [p, s] = encodeAttribution(a).split('.');
  const forged = Buffer.from(JSON.stringify({ ...a, locationId: 'evil' })).toString('base64url');
  assert.equal(decodeAttribution(`${forged}.${s}`), null);
  assert.ok(p);
});
t('expired rejected', () => assert.equal(decodeAttribution(encodeAttribution({ ...a, ts: Date.now() - 31 * 864e5 })), null));
t('garbage rejected', () => { assert.equal(decodeAttribution('nope'), null); assert.equal(decodeAttribution(''), null); });
t('bot UA detection', () => {
  assert.ok(isBotUserAgent('WhatsApp/2.23'));
  assert.ok(isBotUserAgent('facebookexternalhit/1.1'));
  assert.ok(isBotUserAgent(null));
  assert.ok(!isBotUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'));
});

console.log(`\n${n} checks passed`);
