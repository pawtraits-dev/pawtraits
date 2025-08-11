# Referral Order Link Fix Scripts

This directory contains scripts to fix missing links between referrals and orders in the database.

## Problem

When customers use referral codes during checkout, the referral records should be updated with:
- The order ID that was created
- Commission amounts
- Order values
- Status changed to "applied"

However, due to various issues (error handling, API failures, etc.), some referral records may remain unlinked with `order_id = null`.

## Scripts

### 1. JavaScript Script (Recommended)

**File**: `fix-referral-orders.js`

A comprehensive Node.js script that:
- Finds referrals with null `order_id` but matching customer orders
- Updates referral records with correct order information
- Creates `client_orders` records for commission tracking
- Provides detailed logging and error handling
- Generates a summary report

**Usage**:
```bash
# From project root directory
node scripts/run-referral-fix.js
```

**Requirements**:
- Node.js environment
- `.env.local` file with Supabase credentials
- `@supabase/supabase-js` package installed

### 2. SQL Script

**File**: `fix-missing-referral-order-links.sql`

A direct SQL script that performs the same operations but can be run directly in the database.

**Usage**:
```sql
-- Run in your Supabase SQL editor or psql
\i scripts/fix-missing-referral-order-links.sql
```

## What the Scripts Do

1. **Find Unlinked Referrals**: Identifies referrals with:
   - `order_id IS NULL`
   - Status in `['invited', 'accessed', 'accepted']` (unused referrals)
   - Matching customer orders exist

2. **Calculate Commission Data**:
   - Determines if order was customer's first order
   - Applies correct commission rate (20% first order, 5% subsequent)
   - Calculates discount amount (20% for first-time customers)

3. **Update Referral Records**:
   - Links referral to order (`order_id`)
   - Updates status to `'applied'`
   - Sets commission amounts and order values
   - Records purchase timestamp

4. **Create Commission Tracking**:
   - Creates `client_orders` records for partner commission tracking
   - Ensures referrals appear in partner dashboard

## Example Output

```
🚀 Starting referral-order link fix script
==========================================

🔍 Finding referrals with missing order links...
📊 Found 2 referrals with null order_id
🔍 Finding matching orders for referrals...
📊 Found 2 referral-order matches

🔧 Processing 2 referral-order matches...

📝 Updating referral TES728547 -> order PW-20250728-9041
✅ Updated referral TES728547
📝 Creating client_orders record for referral TES728547
✅ Created client_orders record for referral TES728547

✅ Successfully processed 2/2 referral-order links

📊 SUMMARY REPORT
=================
📈 Total referrals with orders linked: 3
📈 Total applied referrals: 3
📈 Total client_orders records: 2
💰 Total commission amount: £13.00 (1300 pence)
```

## Safety Features

- **Read-only checks first**: Scripts analyze what needs fixing before making changes
- **Error handling**: Continues processing even if individual records fail
- **Conflict resolution**: Won't create duplicate `client_orders` records
- **Service role access**: Uses admin privileges to bypass RLS policies
- **Detailed logging**: Shows exactly what was changed

## When to Run

- After identifying referrals showing in the database but not in partner dashboards
- After API failures during order creation
- As periodic maintenance to catch any missed referral-order links
- Before generating commission reports

## Files Created/Modified

The scripts will:
- Update existing `referrals` table records
- Create new `client_orders` table records
- Not modify `orders` table (read-only access)

## Verification

After running, verify results by:
1. Checking partner dashboard shows updated commission totals
2. Confirming referral records have `order_id` populated
3. Validating `client_orders` records exist for commission tracking