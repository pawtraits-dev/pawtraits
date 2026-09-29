/**
 * Unit checks for guest checkout helpers.
 * Run: NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:1 SUPABASE_SERVICE_ROLE_KEY=x npx tsx scripts/test-guest-checkout.ts
 */
const assert = require('node:assert/strict');
const { parseConsent, serialiseConsent } = require('../lib/tracking/consent');
const { validateSetting } = require('../lib/app-settings');
const { signDownload, verifyDownload } = require('../lib/orders/entitlements');
const { hashClaimToken } = require('../lib/guest/account');

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('  ✓', name); };

console.log('consent cookie');
t('round trip', () => assert.deepEqual(parseConsent(serialiseConsent({ analytics: true, marketing: false })), { analytics: true, marketing: false }));
t('rejects junk', () => { assert.equal(parseConsent('yes'), null); assert.equal(parseConsent(''), null); assert.equal(parseConsent('v2.a1.m1'), null); });

console.log('admin settings validation');
t('preview limit ok', () => assert.equal(validateSetting('guest_preview_daily_limit', 20), null));
t('preview limit rejects negatives/strings', () => { assert.ok(validateSetting('guest_preview_daily_limit', -1)); assert.ok(validateSetting('guest_preview_daily_limit', '20')); });
t('stall prices ok', () => assert.equal(validateSetting('stall_prices_pence', { S: 2500, M: 3500, L: 5000 }), null));
t('stall prices reject missing size', () => assert.ok(validateSetting('stall_prices_pence', { S: 2500, M: 3500 })));
t('discount bounds', () => { assert.equal(validateSetting('stall_online_discount_pct', 10), null); assert.ok(validateSetting('stall_online_discount_pct', 120)); });
t('unknown key', () => assert.ok(validateSetting('nope', 1)));

console.log('signed download links');
t('valid token verifies', () => assert.ok(verifyDownload('ent-1', signDownload('ent-1'))));
t('token bound to entitlement', () => assert.ok(!verifyDownload('ent-2', signDownload('ent-1'))));
t('tampered expiry rejected', () => { const [, sig] = signDownload('ent-1').split('.'); assert.ok(!verifyDownload('ent-1', `${Math.floor(Date.now() / 1000) + 9e6}.${sig}`)); });
t('expired rejected', () => assert.ok(!verifyDownload('ent-1', signDownload('ent-1', -1))));
t('missing rejected', () => assert.ok(!verifyDownload('ent-1', null)));

console.log('claim tokens');
t('hash is stable and not the token', () => { const h = hashClaimToken('abc'); assert.equal(h, hashClaimToken('abc')); assert.notEqual(h, 'abc'); assert.equal(h.length, 64); });

console.log(`\n${n} checks passed`);
