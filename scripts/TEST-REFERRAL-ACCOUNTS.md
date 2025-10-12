# Test Referral System - Complete Testing Guide

## Account Credentials

All accounts use password: `!@£QWE123qwe`

### Partner Account
- **Email**: p-016@atemporal.co.uk *(database: p-020@atemporal.co.uk)*
- **Password**: !@£QWE123qwe
- **Pre-Reg Code Used**: TESTCODE010
- **Personal Referral Code**: TESTCODE010

### Customer Accounts (Referral Chain)

| Account | Email | Referred By | Referral Code Used |
|---------|-------|-------------|-------------------|
| c-012 | c-012@atemporal.co.uk | p-016 (Partner) | TESTCODE010 |
| c-013 | c-013@atemporal.co.uk | c-012 (Customer) | CUSTM5PIWMXW |
| c-014 | c-014@atemporal.co.uk | p-016 (Partner) | TESTCODE010 |
| c-015 | c-015@atemporal.co.uk | c-013 (Customer) | CUST449A9U4K |
| c-016 | c-016@atemporal.co.uk | p-016 (Partner) | TESTCODE010 |
| c-017 | c-017@atemporal.co.uk | c-016 (Customer) | CUSTMZCPCKG8 |
| c-018 | c-018@atemporal.co.uk | c-017 (Customer) | CUSTQSGCCEDU |
| c-024 | c-024@atemporal.co.uk | p-016 (Partner) | TESTCODE010 |
| c-026 | c-026@atemporal.co.uk | p-016 (Partner) | TESTCODE010 |

## Referral Chain Visualization

```
Partner p-016 (TESTCODE010)
  ├─→ Customer c-012 (CUSTM5PIWMXW)
  │    └─→ Customer c-013 (CUST449A9U4K)
  │         └─→ Customer c-015 (CUSTZ0C1KA30)
  ├─→ Customer c-014 (CUST80ELALJA)
  ├─→ Customer c-016 (CUSTMZCPCKG8)
  │    └─→ Customer c-017 (CUSTQSGCCEDU)
  │         └─→ Customer c-018 (CUST4YH4CY00)
  ├─→ Customer c-024 (CUST0YBWRZP3)
  └─→ Customer c-026 (CUST7D778SKH)
```

## Test Order Sequence (£25 Product Each)

### Phase 1: First Orders with Referral Discounts

#### Order 1: c-012 First Purchase
**Login as**: c-012@atemporal.co.uk

| Item | Amount |
|------|--------|
| Subtotal | £25.00 |
| Referral Discount (10%) | -£2.50 |
| **Total Paid** | **£22.50** |

**Expected Results**:
- ✅ Discount applies automatically (first order)
- ✅ p-016 earns £2.50 commission
- ✅ Order saved with `discount_amount = 250` (pence)
- ✅ Order saved with `referral_code = 'TESTCODE010'`

---

#### Order 2: c-013 First Purchase
**Login as**: c-013@atemporal.co.uk

| Item | Amount |
|------|--------|
| Subtotal | £25.00 |
| Referral Discount (10%) | -£2.50 |
| **Total Paid** | **£22.50** |

**Expected Results**:
- ✅ Discount applies automatically (first order)
- ✅ c-012 earns £2.50 credit (referring customer reward)
- ✅ c-012 credit balance = £2.50
- ✅ Order saved with `discount_amount = 250`
- ✅ Order saved with `referral_code = CUSTM5PIWMXW`

---

#### Order 3: c-014 First Purchase
**Login as**: c-014@atemporal.co.uk

| Item | Amount |
|------|--------|
| Subtotal | £25.00 |
| Referral Discount (10%) | -£2.50 |
| **Total Paid** | **£22.50** |

**Expected Results**:
- ✅ Discount applies automatically (first order)
- ✅ p-016 earns £2.50 commission (total now £5.00)
- ✅ Order saved with `discount_amount = 250`

---

#### Order 4: c-015 First Purchase
**Login as**: c-015@atemporal.co.uk

| Item | Amount |
|------|--------|
| Subtotal | £25.00 |
| Referral Discount (10%) | -£2.50 |
| **Total Paid** | **£22.50** |

**Expected Results**:
- ✅ Discount applies automatically (first order)
- ✅ c-013 earns £2.50 credit (referring customer reward)
- ✅ c-013 credit balance = £2.50
- ✅ Order saved with `discount_amount = 250`

**Phase 1 Summary**:
- p-016 commission: £5.00 (from c-012, c-014)
- c-012 credit: £2.50 (from c-013)
- c-013 credit: £2.50 (from c-015)

---

### Phase 2: Test Discount Blocking

#### Order 5: c-012 Second Purchase (No Discount)
**Login as**: c-012@atemporal.co.uk

| Item | Amount |
|------|--------|
| Subtotal | £25.00 |
| Referral Discount | ❌ NOT AVAILABLE |
| **Total Paid** | **£25.00** |

**Expected Results**:
- ❌ No referral discount (already used on first order)
- ℹ️ Message shown: "You have already used a referral discount on a previous order"
- ✅ Order saved with `discount_amount = 0`
- ✅ Order saved with `referral_code = NULL`

**Testing Steps**:
1. Add £25 product to cart
2. Go to cart - verify NO discount shown
3. Go to checkout - verify NO discount applied
4. Complete order - verify paid £25.00
5. Check order confirmation shows £25.00

---

### Phase 3: Test Credit Redemption

#### Order 6: c-012 Third Purchase (Use Credits)
**Login as**: c-012@atemporal.co.uk

**Before Order**:
- Credit Balance: £2.50

| Item | Amount |
|------|--------|
| Subtotal | £25.00 |
| Referral Discount | ❌ NOT AVAILABLE |
| **Credit Redemption** | **-£2.50** |
| **Total Paid** | **£22.50** |

**Expected Results**:
- ✅ Credit balance shows £2.50 available
- ✅ "Use Reward Balance" checkbox appears at checkout
- ✅ When checked, £2.50 deducted from order total
- ✅ Order saved with reward redemption metadata
- ✅ c-012 credit balance reduced to £0.00
- ✅ Admin sees "Reward redemption: £2.50"

**Testing Steps**:
1. Add £25 product to cart
2. Go to checkout
3. **IMPORTANT**: Check "Use Reward Balance" checkbox
4. Verify order summary shows:
   - Subtotal: £25.00
   - Rewards Applied: -£2.50
   - Total: £22.50
5. Complete payment
6. Verify account credit balance = £0.00

---

#### Order 7: c-013 Second Purchase (Use Credits)
**Login as**: c-013@atemporal.co.uk

**Before Order**:
- Credit Balance: £2.50

| Item | Amount |
|------|--------|
| Subtotal | £25.00 |
| **Credit Redemption** | **-£2.50** |
| **Total Paid** | **£22.50** |

**Expected Results**:
- ✅ Credit applied when checkbox checked
- ✅ c-013 credit balance reduced to £0.00

**Testing Steps**: (Same as Order 6)

---

### Phase 4: Test Full Price Order

#### Order 8: c-012 Fourth Purchase (No Discounts/Credits)
**Login as**: c-012@atemporal.co.uk

**Before Order**:
- Credit Balance: £0.00
- Already used referral discount

| Item | Amount |
|------|--------|
| Subtotal | £25.00 |
| Discounts | ❌ NONE |
| Credits | ❌ NONE |
| **Total Paid** | **£25.00** |

**Expected Results**:
- ❌ No referral discount available
- ❌ No credit balance to apply
- ✅ Pays full £25.00

---

## Expected Final States

### Partner p-016 Dashboard
- **Commission Balance**: £5.00
- **Direct Referrals**: 5 customers (c-012, c-014, c-016, c-024, c-026)
- **Attributed Customers**: 9 customers total across 3 levels
- **Total Attributed Revenue**: £180.00 (8 orders avg £22.50)
- **Commission Rate**: 10% on direct referrals

### Customer c-012 Account
- **Total Orders**: 4
- **Total Spent**: £90.00
  - Order 1: £22.50 (referral discount)
  - Order 2: £25.00 (no discount)
  - Order 3: £22.50 (credit redemption)
  - Order 4: £25.00 (no discounts)
- **Total Discounts Received**: £5.00
- **Credits Earned**: £2.50 (from c-013 purchase)
- **Credits Used**: £2.50 (on Order 3)
- **Final Credit Balance**: £0.00

### Customer c-013 Account
- **Total Orders**: 2
- **Total Spent**: £45.00
  - Order 1: £22.50 (referral discount)
  - Order 2: £22.50 (credit redemption)
- **Total Discounts Received**: £5.00
- **Credits Earned**: £2.50 (from c-015 purchase)
- **Credits Used**: £2.50 (on Order 2)
- **Final Credit Balance**: £0.00

### Customer c-014 Account
- **Total Orders**: 1
- **Total Spent**: £22.50
- **Total Discounts Received**: £2.50 (referral)
- **Final Credit Balance**: £0.00

### Customer c-015 Account
- **Total Orders**: 1
- **Total Spent**: £22.50
- **Total Discounts Received**: £2.50 (referral)
- **Final Credit Balance**: £0.00

---

## Admin Verification Checklist

### Database Checks

#### Orders Table (`orders`)
```sql
SELECT
  order_number,
  customer_email,
  total_amount,
  discount_amount,
  referral_code,
  created_at
FROM orders
WHERE customer_email IN (
  'c-012@atemporal.co.uk',
  'c-013@atemporal.co.uk',
  'c-014@atemporal.co.uk',
  'c-015@atemporal.co.uk'
)
ORDER BY created_at;
```

**Expected**:
- Orders 1-4: `discount_amount = 250`, `referral_code` populated
- Order 5: `discount_amount = 0`, `referral_code = NULL`
- Orders 6-8: `discount_amount = 0`, check metadata for reward redemption

---

#### Customers Table (`customers`)
```sql
SELECT
  email,
  personal_referral_code,
  referral_type,
  referrer_id,
  referral_code_used,
  current_credit_balance,
  total_referrals,
  successful_referrals
FROM customers
WHERE email IN (
  'c-012@atemporal.co.uk',
  'c-013@atemporal.co.uk',
  'c-014@atemporal.co.uk',
  'c-015@atemporal.co.uk'
);
```

**Expected**:
- c-012: `referral_type = 'PARTNER'`, `referral_code_used = 'TESTCODE010'`, `current_credit_balance = 0`, `total_referrals = 1`
- c-013: `referral_type = 'CUSTOMER'`, `referrer_id = c-012's id`, `referral_code_used = 'CUSTM5PIWMXW'`, `current_credit_balance = 0`, `total_referrals = 1`
- c-014: `referral_type = 'PARTNER'`, `referral_code_used = 'TESTCODE010'`, `current_credit_balance = 0`
- c-015: `referral_type = 'CUSTOMER'`, `referrer_id = c-013's id`, `referral_code_used = 'CUST449A9U4K'`, `current_credit_balance = 0`

---

#### Commissions Table (`commissions`)
```sql
SELECT
  recipient_email,
  commission_type,
  commission_amount,
  order_amount,
  status,
  created_at
FROM commissions
WHERE recipient_email = 'p-020@atemporal.co.uk'
ORDER BY created_at;
```

**Expected**:
- 2 commission records for p-016 (from c-012, c-014 first purchases)
- Each: `commission_amount = 250` (£2.50 in pence)
- Total: £5.00

---

### Admin Dashboard Checks

- [ ] Partners page shows p-016 (p-020@atemporal.co.uk) with £5.00 commission
- [ ] Partners page shows p-016 with 9 attributed customers across 3 levels
- [ ] Clicking p-016 shows correct attribution tree:
  - Level 1: c-012, c-014, c-016, c-024, c-026
  - Level 2: c-013, c-017
  - Level 3: c-015, c-018
- [ ] Commissions page shows 2 × £2.50 for p-016
- [ ] Orders page shows correct discount_amount for each order
- [ ] Customer c-012 detail shows £0.00 credit balance
- [ ] Customer c-013 detail shows £0.00 credit balance

---

## Testing Sequence Summary

### ✅ Tests Covered

1. **Partner Registration**: Pre-registration code conversion
2. **Customer Signup with Referral**: Automatic referral code capture
3. **First Order Discount**: 10% discount applies automatically
4. **Commission Calculation**: Partner earns 10% on direct referrals
5. **Customer Credit Earning**: Customer earns 10% when referral purchases
6. **Discount Blocking**: Second order does NOT get referral discount
7. **Credit Redemption**: Manual checkbox to apply earned credits
8. **Multi-Level Attribution**: Partner sees all downstream customers
9. **Full Price Order**: No discounts or credits available

### 🎯 Key Validation Points

- ✅ Referral discounts apply only once (first order)
- ✅ Credits are earned when referrals make purchases
- ✅ Credits must be manually applied at checkout
- ✅ Cannot combine referral discount + credit redemption
- ✅ Partner commissions track correctly
- ✅ Customer credit balances update properly
- ✅ Multi-level attribution chains work
- ✅ Database fields populate correctly

---

## Troubleshooting

### Issue: Discount not applying on first order
**Check**:
1. Referral code stored in customer record (`referral_code_used` field)
2. `/api/referrals/validate` returns `eligible: true`
3. No previous orders with `discount_amount > 0` OR `referral_code` populated

### Issue: Credit balance not showing
**Check**:
1. `/api/customers/balance?email=...` returns balance
2. `customers.current_credit_balance` field (NOT `credit_balance`)
3. User type is 'customer' (not partner)

### Issue: Credits not deducting from order
**Check**:
1. "Use Reward Balance" checkbox is checked
2. PaymentIntent metadata includes `rewardRedemption` field
3. Webhook processes reward redemption correctly

### Issue: Commission not showing for partner
**Check**:
1. Customer's `referral_type = 'PARTNER'`
2. `commissions` table has records
3. Commission status is not 'cancelled'

---

## Quick Reference Commands

### Create Test Accounts
```bash
npx tsx scripts/create-test-referral-accounts.ts
```

### Check Order Discounts
```sql
SELECT order_number, customer_email, discount_amount, referral_code
FROM orders
WHERE customer_email LIKE '%atemporal.co.uk%'
ORDER BY created_at DESC;
```

### Check Customer Credits
```sql
SELECT email, current_credit_balance, total_referrals
FROM customers
WHERE email LIKE '%atemporal.co.uk%';
```

### Check Partner Commissions
```sql
SELECT * FROM commissions
WHERE recipient_email = 'p-013@atemporal.co.uk';
```

---

## Notes

- All test accounts use the same password: `!@£QWE123qwe`
- **Partner Account**: Label p-016 refers to p-020@atemporal.co.uk in database
- Pre-registration code TESTCODE010 is p-016's personal referral code
- Credit redemption requires manual checkbox - NOT automatic
- Referral discounts apply automatically on first order ONLY
- Partner commissions are for direct referrals, not multi-level
- Multi-level attribution tracks all downstream customers for analytics
- **Referral Tree**:
  - 5 direct referrals (Level 1): c-012, c-014, c-016, c-024, c-026
  - 2 second-level referrals (Level 2): c-013 (via c-012), c-017 (via c-016)
  - 2 third-level referrals (Level 3): c-015 (via c-013), c-018 (via c-017)
