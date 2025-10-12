# Test Referral System - Complete Testing Guide

## Account Credentials

All accounts use password: `!@£QWE123qwe`

### Partner Account
- **Email**: p-013@atemporal.co.uk
- **Password**: !@£QWE123qwe
- **Pre-Reg Code Used**: TESTCODE004
- **Personal Referral Code**: TESTCODE004 *(or generated code)*

### Customer Accounts (Referral Chain)

| Account | Email | Referred By | Referral Code Used |
|---------|-------|-------------|-------------------|
| c-013 | c-013@atemporal.co.uk | p-013 (Partner) | TESTCODE004 |
| c-014 | c-014@atemporal.co.uk | c-013 (Customer) | c-013's personal code |
| c-015 | c-015@atemporal.co.uk | p-013 (Partner) | TESTCODE004 |
| c-016 | c-016@atemporal.co.uk | c-014 (Customer) | c-014's personal code |

## Referral Chain Visualization

```
Partner p-013 (TESTCODE004)
  ├─→ Customer c-013 (personal code: CUST013...)
  │    └─→ Customer c-014 (personal code: CUST014...)
  │         └─→ Customer c-016
  └─→ Customer c-015
```

## Test Order Sequence (£25 Product Each)

### Phase 1: First Orders with Referral Discounts

#### Order 1: c-013 First Purchase
**Login as**: c-013@atemporal.co.uk

| Item | Amount |
|------|--------|
| Subtotal | £25.00 |
| Referral Discount (10%) | -£2.50 |
| **Total Paid** | **£22.50** |

**Expected Results**:
- ✅ Discount applies automatically (first order)
- ✅ p-013 earns £2.50 commission
- ✅ Order saved with `discount_amount = 250` (pence)
- ✅ Order saved with `referral_code = 'TESTCODE004'`

---

#### Order 2: c-014 First Purchase
**Login as**: c-014@atemporal.co.uk

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
- ✅ Order saved with `referral_code = c-013's code`

---

#### Order 3: c-015 First Purchase
**Login as**: c-015@atemporal.co.uk

| Item | Amount |
|------|--------|
| Subtotal | £25.00 |
| Referral Discount (10%) | -£2.50 |
| **Total Paid** | **£22.50** |

**Expected Results**:
- ✅ Discount applies automatically (first order)
- ✅ p-013 earns £2.50 commission (total now £5.00)
- ✅ Order saved with `discount_amount = 250`

---

#### Order 4: c-016 First Purchase
**Login as**: c-016@atemporal.co.uk

| Item | Amount |
|------|--------|
| Subtotal | £25.00 |
| Referral Discount (10%) | -£2.50 |
| **Total Paid** | **£22.50** |

**Expected Results**:
- ✅ Discount applies automatically (first order)
- ✅ c-014 earns £2.50 credit (referring customer reward)
- ✅ c-014 credit balance = £2.50
- ✅ Order saved with `discount_amount = 250`

**Phase 1 Summary**:
- p-013 commission: £5.00
- c-013 credit: £2.50
- c-014 credit: £2.50

---

### Phase 2: Test Discount Blocking

#### Order 5: c-013 Second Purchase (No Discount)
**Login as**: c-013@atemporal.co.uk

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

#### Order 6: c-013 Third Purchase (Use Credits)
**Login as**: c-013@atemporal.co.uk

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
- ✅ c-013 credit balance reduced to £0.00
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

#### Order 7: c-014 Second Purchase (Use Credits)
**Login as**: c-014@atemporal.co.uk

**Before Order**:
- Credit Balance: £2.50

| Item | Amount |
|------|--------|
| Subtotal | £25.00 |
| **Credit Redemption** | **-£2.50** |
| **Total Paid** | **£22.50** |

**Expected Results**:
- ✅ Credit applied when checkbox checked
- ✅ c-014 credit balance reduced to £0.00

**Testing Steps**: (Same as Order 6)

---

### Phase 4: Test Full Price Order

#### Order 8: c-013 Fourth Purchase (No Discounts/Credits)
**Login as**: c-013@atemporal.co.uk

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

### Partner p-013 Dashboard
- **Commission Balance**: £5.00
- **Direct Referrals**: 2 customers (c-013, c-015)
- **Attributed Customers**: 4 customers (c-013, c-014, c-015, c-016)
- **Total Attributed Revenue**: £180.00 (8 orders avg £22.50)
- **Commission Rate**: 10% on direct referrals

### Customer c-013 Account
- **Total Orders**: 4
- **Total Spent**: £90.00
  - Order 1: £22.50 (referral discount)
  - Order 2: £25.00 (no discount)
  - Order 3: £22.50 (credit redemption)
  - Order 4: £25.00 (no discounts)
- **Total Discounts Received**: £5.00
- **Credits Earned**: £2.50 (from c-014 purchase)
- **Credits Used**: £2.50 (on Order 3)
- **Final Credit Balance**: £0.00

### Customer c-014 Account
- **Total Orders**: 2
- **Total Spent**: £45.00
  - Order 1: £22.50 (referral discount)
  - Order 2: £22.50 (credit redemption)
- **Total Discounts Received**: £5.00
- **Credits Earned**: £2.50 (from c-016 purchase)
- **Credits Used**: £2.50 (on Order 2)
- **Final Credit Balance**: £0.00

### Customer c-015 Account
- **Total Orders**: 1
- **Total Spent**: £22.50
- **Total Discounts Received**: £2.50 (referral)
- **Final Credit Balance**: £0.00

### Customer c-016 Account
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
  'c-013@atemporal.co.uk',
  'c-014@atemporal.co.uk',
  'c-015@atemporal.co.uk',
  'c-016@atemporal.co.uk'
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
  'c-013@atemporal.co.uk',
  'c-014@atemporal.co.uk',
  'c-015@atemporal.co.uk',
  'c-016@atemporal.co.uk'
);
```

**Expected**:
- c-013: `referral_type = 'PARTNER'`, `current_credit_balance = 0`, `total_referrals = 1`
- c-014: `referral_type = 'CUSTOMER'`, `referrer_id = c-013's id`, `current_credit_balance = 0`, `total_referrals = 1`
- c-015: `referral_type = 'PARTNER'`, `current_credit_balance = 0`
- c-016: `referral_type = 'CUSTOMER'`, `referrer_id = c-014's id`, `current_credit_balance = 0`

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
WHERE recipient_email = 'p-013@atemporal.co.uk'
ORDER BY created_at;
```

**Expected**:
- 2 commission records for p-013
- Each: `commission_amount = 250` (£2.50 in pence)
- Total: £5.00

---

### Admin Dashboard Checks

- [ ] Partners page shows p-013 with £5.00 commission
- [ ] Partners page shows p-013 with 4 attributed customers
- [ ] Clicking p-013 shows attribution chain (multi-level)
- [ ] Commissions page shows 2 × £2.50 for p-013
- [ ] Orders page shows correct discount_amount for each order
- [ ] Customer c-013 detail shows £0.00 credit balance
- [ ] Customer c-014 detail shows £0.00 credit balance

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
- Pre-registration code TESTCODE004 becomes p-013's personal referral code
- Credit redemption requires manual checkbox - NOT automatic
- Referral discounts apply automatically on first order ONLY
- Partner commissions are for direct referrals, not multi-level
- Multi-level attribution tracks all downstream customers for analytics
