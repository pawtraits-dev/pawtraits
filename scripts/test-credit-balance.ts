/** npx tsx scripts/test-credit-balance.ts */
import assert from 'node:assert/strict';
import { balanceAfterRedemption, redemptionToRecord, referralToRecord, isFriendsFirstOrder, referrerEarnsCredit } from '../lib/commissions/credit-balance';
let n = 0; const t = (a: unknown, b: unknown) => { assert.equal(a, b); n++; };

t(balanceAfterRedemption(1000, 500), 500);     // £10 held, £5 spent, £5 left
t(balanceAfterRedemption(550, 550), 0);        // spend it all
t(balanceAfterRedemption(1234, 235), 999);     // odd pence stay whole numbers (the column is an integer)
t(balanceAfterRedemption(300, 500), 0);        // never below zero
t(balanceAfterRedemption(1000, 0), 1000);      // nothing spent
t(balanceAfterRedemption(null, 500), 0);       // no balance on record
t(balanceAfterRedemption(1000, null), 1000);
t(balanceAfterRedemption(1000, NaN), 1000);    // malformed amount takes nothing
t(balanceAfterRedemption(1000, -200), 1000);   // a negative amount can never add credit
t(Number.isInteger(balanceAfterRedemption(1000.4, 499.6)), true);

// What is recorded against a payment: the smaller of the claim and what the server confirmed
t(redemptionToRecord(500, { status: 'ok', rewardsAllowed: 500 }), 500);        // honest claim
t(redemptionToRecord(10_000_000, { status: 'ok', rewardsAllowed: 0 }), 0);     // made-up claim at full price: nothing recorded
t(redemptionToRecord(2000, { status: 'low', rewardsAllowed: 700 }), 700);      // claims more than held: only what is held
t(redemptionToRecord(500, { status: 'suspicious', rewardsAllowed: 500 }), 500);
t(redemptionToRecord(500, { status: 'unchecked', rewardsAllowed: 0 }), 0);     // check could not run: nothing confirmed (the payment is refused)
t(redemptionToRecord(10_000_000, { status: 'unchecked' }), 0);
t(redemptionToRecord(0, { status: 'ok', rewardsAllowed: 500 }), 0);
t(redemptionToRecord(null, { status: 'ok', rewardsAllowed: 500 }), 0);
t(redemptionToRecord(-50, { status: 'ok', rewardsAllowed: 500 }), 0);
t(redemptionToRecord(500, { status: 'ok' }), 0);                               // guest or not the signed-in customer: nothing confirmed

// One payment, one deduction: the webhook must contain exactly one write of the reduced balance
import { readFileSync } from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(__dirname, '..');
const hook = readFileSync(path.join(ROOT, 'app/api/webhooks/stripe/route.ts'), 'utf8');
t((hook.match(/balanceAfterRedemption\(/g) || []).length, 1);
t(/rewardAmountPounds/.test(hook), false);
t((hook.match(/await handleCreditRedemption\(/g) || []).length, 1);

// Referral credit on the friend's first order only
t(isFriendsFirstOrder([]), true);
t(isFriendsFirstOrder(null), true);
t(isFriendsFirstOrder([{ payment_status: 'paid', status: 'confirmed' }]), false);                 // they have bought before
t(isFriendsFirstOrder([{ payment_status: 'pending', status: 'confirmed' }]), true);               // an unpaid attempt is not an order
t(isFriendsFirstOrder([{ payment_status: 'paid', status: 'refunded' }]), true);                   // a refunded order does not count
t(isFriendsFirstOrder([{ payment_status: 'paid', status: 'Cancelled' }]), true);
t(isFriendsFirstOrder([{ payment_status: 'failed', status: 'confirmed' }, { payment_status: 'PAID', status: 'shipped' }]), false);
t(isFriendsFirstOrder([{ payment_status: 'paid', status: 'canceled' }]), true);                   // American spelling
t(isFriendsFirstOrder([{ payment_status: 'paid', status: 'on_hold' }]), false);                   // a held order is still a sale
t(referrerEarnsCredit([], false), true);
t(referrerEarnsCredit([], true), false);                                                          // first order was cancelled after earning credit: no second credit
t(referrerEarnsCredit([{ payment_status: 'paid', status: 'cancelled' }], true), false);
t(referrerEarnsCredit([{ payment_status: 'paid', status: 'confirmed' }], false), false);
t(/referrerEarnsCredit\(others\.data/.test(hook), true);
t(/\.neq\('id', order\.id\)/.test(hook), true);                                                   // the order being processed is excluded
t(/\.ilike\('customer_email', emailPattern\)/.test(hook), true);                                  // capitals in the email cannot hide an earlier order
t(/metadata->>customer_id/.test(hook), true);
t(/customer\.referral_type === 'PARTNER' && customer\.referrer_id\) \{\s*await handlePartnerCommission\(/.test(hook), true);   // partners unchanged
t((hook.match(/await handleCustomerCredit\(/g) || []).length, 1);

// Odd input never throws (a throw used to skip the whole price check)
import { shippingZoneFor } from '../lib/shipping/rates';
t(shippingZoneFor(123 as any), null);
t(shippingZoneFor(' gb '), 'GB');
const intent = readFileSync(path.join(ROOT, 'app/api/payments/create-intent/route.ts'), 'utf8');
t(/typeof body\.referralCode !== 'string'/.test(intent), true);
t(/PRICE_CHECK_UNAVAILABLE/.test(intent), true);
// referralToRecord: the server's figure, capped at what the browser really took off; never a discount nobody got
const ok = { applied: true, discount: 500 };
t(referralToRecord(500, ok), 500);
t(referralToRecord(300, ok), 300);               // browser took less off (rate changed while the page was open)
t(referralToRecord(900, ok), 500);               // browser claims more: the server's figure
t(referralToRecord(0, ok), 0);                   // wallet pressed before the code check finished
t(referralToRecord(undefined, ok), 0);
t(referralToRecord(null, ok), 0);
t(referralToRecord(NaN, ok), 0);
t(referralToRecord(Infinity, ok), 0);
t(referralToRecord(-100, ok), 0);
t(referralToRecord(499.6, ok), 500);
t(referralToRecord(500, { applied: false, discount: 500 }), 0);   // not confirmed
t(referralToRecord(500, { applied: true, discount: 0 }), 0);
t(referralToRecord(500, null), 0);
console.log(`credit-balance: ${n} passed`);
