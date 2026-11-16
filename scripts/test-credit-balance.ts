/** npx tsx scripts/test-credit-balance.ts */
import assert from 'node:assert/strict';
import { balanceAfterRedemption } from '../lib/commissions/credit-balance';
let n = 0; const t = (a: unknown, b: unknown) => { assert.equal(a, b); n++; };

t(balanceAfterRedemption(1000, 500), 500);     // £10 held, £5 spent, £5 left (the bug left 995)
t(balanceAfterRedemption(550, 550), 0);        // spend it all
t(balanceAfterRedemption(1234, 235), 999);     // odd pence stay whole numbers (the column is an integer)
t(balanceAfterRedemption(300, 500), 0);        // never below zero
t(balanceAfterRedemption(1000, 0), 1000);      // nothing spent
t(balanceAfterRedemption(null, 500), 0);       // no balance on record
t(balanceAfterRedemption(1000, null), 1000);
t(balanceAfterRedemption(1000, NaN), 1000);    // malformed amount takes nothing
t(balanceAfterRedemption(1000, -200), 1000);   // a negative amount can never add credit
t(Number.isInteger(balanceAfterRedemption(1000.4, 499.6)), true);
console.log(`credit-balance: ${n} passed`);
