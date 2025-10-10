# Fix Multi-Level Attribution Tracking

## Problem
The multi-level attribution system isn't tracking customer-to-customer referral chains (e.g., Partner → Customer1 → Customer2) because:

1. **Wrong referrer_id values**: For CUSTOMER referrals, `customers.referrer_id` is being set to `user_profiles.id` instead of `customers.id`
2. **Wrong FK constraint**: The `customers.referrer_id` column has a foreign key constraint to `user_profiles(id)`, preventing it from pointing to `customers.id`

## Example
For the chain: p-011 → c-010 → c-011

- c-011 signed up using c-010's code (CUSTVAK05AZN)
- c-011.referrer_id is currently `d4b9951a...` (c-010's user_profile.id)
- But it should be `f3599308...` (c-010's customer.id)
- The SQL function tries to join on `customers.id`, so it doesn't find the chain

## Solution

### Step 1: Fix the Database Constraint
Run this SQL script in Supabase SQL Editor:
```
scripts/fix-referrer-id-constraint.sql
```

This will:
- Remove the FK constraint from `customers.referrer_id` to `user_profiles(id)`
- Make `referrer_id` a polymorphic field that can point to different tables based on `referral_type`:
  - PARTNER referrals: points to `user_profiles.id` or `partners.id`
  - CUSTOMER referrals: points to `customers.id` ← THIS IS THE KEY FIX
  - INFLUENCER referrals: points to `user_profiles.id` or `influencers.id`
- Add indexes for performance

### Step 2: Update the Attribution Function
Run this SQL script in Supabase SQL Editor:
```
scripts/create-partner-attribution-function.sql
```

This will recreate the recursive function with:
- Proper CAST to TEXT for the referral_path (fixes type mismatch error)
- Correct join on `c.referrer_id = ac.customer_id` for customer chains

### Step 3: Fix Existing Customer Records
Run this script:
```bash
npx tsx scripts/fix-customer-referrer-ids.ts
```

This will update all existing customer records with `referral_type='CUSTOMER'` to have the correct `referrer_id` (pointing to `customers.id` instead of `user_profiles.id`).

Expected output:
```
Found 3 customers with CUSTOMER referrals
✅ FIXED: Changed referrer_id for c-005, c-007, c-011
```

### Step 4: Verify the Fix
The system should now correctly track multi-level chains. Test by:

1. Checking the attribution API for partner p-011:
   ```
   GET /api/admin/partners/bd5df913-3d0e-4871-b2ba-e0e990a6c573/attribution
   ```

   Should return:
   - Level 1: c-006, c-010 (direct partner referrals)
   - Level 2: c-011 (referred by c-010)

2. Checking the admin partners list:
   - p-011 should show "Attributed: 3" (was 2 before)
   - Attributed Revenue should include c-011's orders

## Files Changed

### API Endpoints
- `app/api/referrals/verify/[code]/route.ts`
  - Line 146: Changed to use `data.customers.id` for customer referrals
  - Line 266: Changed to use `data.id` (customer.id) for customer personal codes

### SQL Scripts
- `scripts/fix-referrer-id-constraint.sql` (NEW)
  - Removes FK constraint on `customers.referrer_id`
  - Adds documentation and indexes

- `scripts/create-partner-attribution-function.sql` (UPDATED)
  - Fixed CAST for referral_path
  - Uses `c.referrer_id = ac.customer_id` for joins

- `scripts/fix-customer-referrer-ids.ts` (NEW)
  - Migration script to fix existing customer records

## Technical Details

### Why referrer_id Needs to be Polymorphic

The `referrer_id` field serves different purposes based on `referral_type`:

```
referral_type = 'PARTNER':
  referrer_id → user_profiles.id (for user tracking)
  OR referrer_id → partners.id (legacy)

referral_type = 'CUSTOMER':
  referrer_id → customers.id (for attribution chains)

referral_type = 'INFLUENCER':
  referrer_id → user_profiles.id (for user tracking)
  OR referrer_id → influencers.id (legacy)
```

Since a single FK constraint can't point to multiple tables, we remove the constraint and let application logic maintain referential integrity.

### Attribution Chain Logic

The recursive SQL function now works as follows:

1. **Base case**: Find all customers where:
   - `referral_type = 'PARTNER'`
   - `referral_code_used = partner's personal code`
   - These are Level 1 (direct referrals)

2. **Recursive case**: Find all customers where:
   - `referral_type = 'CUSTOMER'`
   - `referrer_id = any customer_id from previous level`
   - These are Level 2, 3, 4, etc.

3. **Termination**: Stop after 10 levels or when no more customers found

### Example Chain Resolution

```
Partner PEUWQLMN (p-011)
  ↓ (uses code PEUWQLMN)
Customer c-010 (referrer_id = p-011's user_profile.id, referral_type = 'PARTNER')
  ↓ (uses code CUSTVAK05AZN = c-010's personal code)
Customer c-011 (referrer_id = c-010's customer.id, referral_type = 'CUSTOMER')
```

The function finds:
- Level 1: c-010 (joins on referral_code_used = 'PEUWQLMN')
- Level 2: c-011 (joins on referrer_id = c-010.id)

Result: 2 total attributed customers for p-011
