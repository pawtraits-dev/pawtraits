/** npx tsx scripts/test-referral-rules.ts   (no network, no database) */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { friendEligibility, eligibilityMessage, emailPattern, type FriendEligibilityInput } from '../lib/referrals/eligibility';
import { rateFraction, formatPct, cleanPct } from '../lib/referrals/rates';
import { referralCopy, shareText, bannerText } from '../lib/referrals/text';
import { referralDiscountPence, evaluatePriceCheck } from '../lib/checkout/price-check';
import { validateSetting, SETTING_DEFAULTS } from '../lib/app-settings';

let n = 0; const t = (a: unknown, b: unknown) => { assert.deepEqual(a, b); n++; };
const ROOT = path.resolve(__dirname, '..');

// ---- friendEligibility ------------------------------------------------------------------------
const base: FriendEligibilityInput = {
  signedInEmail: 'friend@example.com', customerEmail: 'friend@example.com',
  ownerFound: true, ownerEmail: 'owner@example.com', ownerCustomerId: 'owner-1',
  friendCustomer: { referral_type: null, referrer_id: null }, friendOrders: [],
};
const r = (o: Partial<FriendEligibilityInput>) => friendEligibility({ ...base, ...o }).reason;

t(friendEligibility(base), { eligible: true, reason: 'ok' });
t(r({ signedInEmail: null }), 'not_signed_in');                                         // a guest with a valid code
t(r({ signedInEmail: 'other@example.com' }), 'not_signed_in');                          // signed in as someone else
t(r({ signedInEmail: 'friend@example.com', customerEmail: '  Friend@Example.COM ' }), 'ok');   // capitals and spaces do not matter
t(r({ ownerFound: false }), 'not_found');
t(r({ ownerEmail: 'Friend@Example.com' }), 'own_code');
t(r({ friendOrders: [{ payment_status: 'paid', status: 'delivered' }] }), 'not_new');   // an earlier paid order, whatever its code
t(r({ friendOrders: [{ payment_status: 'paid', status: 'confirmed' }] }), 'not_new');
t(r({ friendOrders: [{ payment_status: 'paid', status: 'refunded' }] }), 'ok');         // refunded: still new
t(r({ friendOrders: [{ payment_status: 'paid', status: 'cancelled' }] }), 'ok');
t(r({ friendOrders: [{ payment_status: 'pending', status: 'pending' }, { payment_status: 'failed', status: 'failed' }] }), 'ok');   // unpaid: still new
t(r({ friendCustomer: { referral_type: 'CUSTOMER', referrer_id: 'someone-else' } }), 'referred_by_someone_else');
t(r({ friendCustomer: { referral_type: 'CUSTOMER', referrer_id: 'owner-1' } }), 'ok');  // already linked to THIS owner
t(r({ friendCustomer: { referral_type: 'PARTNER', referrer_id: 'partner-1' } }), 'referred_by_someone_else'); // already a partner's customer: the code's owner would get nothing
t(r({ friendCustomer: { referral_type: 'PARTNER', referrer_id: null } }), 'ok');         // a partner type with no partner recorded does not block
t(r({ friendCustomer: { referral_type: 'ORGANIC', referrer_id: null } }), 'ok');
// Order of precedence
t(r({ signedInEmail: null, ownerFound: false }), 'not_found');     // a guest with an unknown code is told so, not asked to sign up
t(r({ ownerFound: false, friendOrders: [{ payment_status: 'paid', status: 'delivered' }] }), 'not_found');
t(r({ ownerEmail: 'friend@example.com', friendOrders: [{ payment_status: 'paid', status: 'delivered' }] }), 'own_code');
t(r({ friendOrders: [{ payment_status: 'paid', status: 'delivered' }], friendCustomer: { referral_type: 'CUSTOMER', referrer_id: 'x' } }), 'not_new');
t(friendEligibility({ ...base, signedInEmail: null }).eligible, false);

t(emailPattern(' a_b%c@x.com '), 'a\\_b\\%c@x.com');

// ---- messages ---------------------------------------------------------------------------------
t(eligibilityMessage('not_signed_in', '20%'), 'Create an account or sign in to get 20% off your first order.');
t(eligibilityMessage('not_new', '20%'), 'Referral discounts are for a first order.');
t(eligibilityMessage('own_code', '20%'), "That's your own code. Share it with a friend instead.");
t(eligibilityMessage('referred_by_someone_else', '20%'), "You've already joined through another friend's code.");
t(eligibilityMessage('not_found', '20%'), "We don't recognise that code.");

// ---- rates ------------------------------------------------------------------------------------
t([0, 10, 20, 50, 60, -5, NaN, Infinity].map(rateFraction), [0, 0.1, 0.2, 0.5, 0.5, 0, 0, 0]);
t(rateFraction(10), 0.1);
t(formatPct(20), '20%'); t(formatPct(10), '10%'); t(formatPct(0), '0%');

// ---- settings ---------------------------------------------------------------------------------
t(SETTING_DEFAULTS.referral_friend_discount_pct, 10);
t(SETTING_DEFAULTS.referral_referrer_credit_pct, 10);
for (const k of ['referral_friend_discount_pct', 'referral_referrer_credit_pct']) {
  t(validateSetting(k, 20), null); t(validateSetting(k, 0), null); t(validateSetting(k, 50), null);
  t(validateSetting(k, 51), 'Must be a whole number from 0 to 50');
  t(validateSetting(k, -1), 'Must be a whole number from 0 to 50');
  t(validateSetting(k, 12.5), 'Must be a whole number from 0 to 50');
  t(validateSetting(k, '20'), 'Must be a whole number from 0 to 50');
}

// ---- wording ----------------------------------------------------------------------------------
t(referralCopy({ friendPct: 10, referrerPct: 10 }), {
  heading: 'Give 10%, get 10%',
  line: 'Your friend gets 10% off their first Pawtrait. You get 10% of their first order as credit.',
  emailLine: 'Know someone whose pet deserves a Pawtrait? Send them your link: they get 10% off their first, you get 10% of that order as credit.',
  slipLine: 'Show a friend this code. They get 10% off their first Pawtrait, you get 10% of that order as credit.',
});
t(referralCopy(), referralCopy({ friendPct: 10, referrerPct: 10 }));
t(referralCopy({ friendPct: 20, referrerPct: 20 }), {
  heading: 'Give 20%, get 20%',
  line: 'Your friend gets 20% off their first Pawtrait. You get 20% of their first order as credit.',
  emailLine: 'Know someone whose pet deserves a Pawtrait? Send them your link: they get 20% off their first, you get 20% of that order as credit.',
  slipLine: 'Show a friend this code. They get 20% off their first Pawtrait, you get 20% of that order as credit.',
});
t(referralCopy({ friendPct: 20, referrerPct: 10 }), {
  heading: 'Give 20%, get 10%',
  line: 'Your friend gets 20% off their first Pawtrait. You get 10% of their first order as credit.',
  emailLine: 'Know someone whose pet deserves a Pawtrait? Send them your link: they get 20% off their first, you get 10% of that order as credit.',
  slipLine: 'Show a friend this code. They get 20% off their first Pawtrait, you get 10% of that order as credit.',
});
t(shareText('Biscuit', { friendPct: 20, referrerPct: 5 }), "I had Biscuit painted by Pawcasso at Pawtraits. Here's 20% off your first one:");
t(bannerText('sarah', { friendPct: 20, referrerPct: 20 }).headline, 'Sarah gave you 20% off your first Pawtrait');
t(bannerText('sarah', undefined, false).sub, 'Create an account to claim it. It comes off at checkout.');

// ---- the server's discount figure --------------------------------------------------------------
t(referralDiscountPence(2000, rateFraction(20)), 400);          // £20 of goods at 20%
t(referralDiscountPence(2000, rateFraction(10)), 200);
t(referralDiscountPence(1999, rateFraction(10)), 200);          // 199.9 rounds to 200, as the amount required does
t(referralDiscountPence(2000, 0), 0);
// It matches what the price check expects to be charged: goods 2000 + delivery 500, 20% off the goods = 2100
t(evaluatePriceCheck({ amount: 2100, goodsFloor: 2000, shipping: 500, discountRate: rateFraction(20), rewardsAllowed: 0 }).status, 'ok');
t(evaluatePriceCheck({ amount: 2000 + 500 - referralDiscountPence(2000, rateFraction(20)), goodsFloor: 2000, shipping: 500, discountRate: rateFraction(20), rewardsAllowed: 0 }).status, 'ok');
t(evaluatePriceCheck({ amount: 1900, goodsFloor: 2000, shipping: 500, discountRate: rateFraction(20), rewardsAllowed: 0 }).status, 'low');

// ---- source-level checks ----------------------------------------------------------------------
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8');
const webhook = read('app/api/webhooks/stripe/route.ts');
t(/handleCustomerCreditFromMetadata/.test(webhook), false);
t(/createCustomerCredit/.test(webhook), false);
const creditFn = webhook.slice(webhook.indexOf('async function handleCustomerCredit('));
t(/\* 0\.10\)/.test(creditFn.slice(0, 4000)), false);
t(/rateFraction\(referrerPct\)/.test(creditFn), true);
t(/commission_rate: referrerPct/.test(creditFn), true);
t(/referral_type: 'CUSTOMER', referrer_id: ownerId/.test(webhook), true);       // links to exactly the owner create-intent confirmed
t(/personal_referral_code/.test(webhook.slice(webhook.indexOf('// Link at purchase'), webhook.indexOf('// Note: referral_order_id'))), false);   // and never looks the code up again
const intent = read('app/api/payments/create-intent/route.ts');
// the browser's referral figure is only a ceiling (referralToRecord); it is never written to metadata directly
t(/metadata\.referralDiscount\s*=\s*String\(body\./.test(intent), false);
t(/referralToRecord\(body\.referralDiscount, priceCheck\.referral\)/.test(intent), true);
t(/metadata\.referralType\s*=/.test(intent), false);
const price = read('lib/checkout/price-check.ts');
t(/customerReferralEligibility\(body\.referralCode, body\.customerEmail, user\?\.email/.test(price), true);

// ---- cleanPct: stored settings are read the same way the charge and the wording use them -----------
t(cleanPct('20'), 20); t(cleanPct(20), 20); t(cleanPct(null), 10); t(cleanPct(60), 50); t(cleanPct(-5), 0); t(cleanPct('abc'), 10);
t(cleanPct(12.6), 13); t(cleanPct(undefined), 10); t(cleanPct(''), 10); t(cleanPct(NaN, 7), 7);
t(formatPct(cleanPct('20')), '20%');

console.log(`referral-rules: ${n} passed`);
