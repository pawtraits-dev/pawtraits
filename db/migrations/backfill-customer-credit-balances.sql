-- =====================================================
-- BACKFILL CUSTOMER CREDIT BALANCES
-- =====================================================
-- Purpose: Update customers.current_credit_balance based on commission records
-- Context: Commission records were created but balance wasn't updated due to
--          earlier order_id NOT NULL constraint causing commission creation failures
-- =====================================================

-- Create a temporary table to calculate totals per customer
CREATE TEMP TABLE customer_credit_totals AS
SELECT
  recipient_id as customer_id,
  recipient_email as customer_email,
  SUM(commission_amount) as total_credits_pence,
  COUNT(*) as commission_count,
  array_agg(id) as commission_ids
FROM commissions
WHERE recipient_type = 'customer'
  AND commission_type = 'customer_credit'
  AND status IN ('approved', 'paid')  -- Only approved/paid credits count
GROUP BY recipient_id, recipient_email;

-- Show what will be updated
DO $$
DECLARE
  rec RECORD;
  total_customers INTEGER;
  total_credits_to_add BIGINT;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(total_credits_pence), 0)
  INTO total_customers, total_credits_to_add
  FROM customer_credit_totals;

  RAISE NOTICE '====== BACKFILL PREVIEW ======';
  RAISE NOTICE 'Total customers with commission records: %', total_customers;
  RAISE NOTICE 'Total credits to backfill: £%', (total_credits_to_add / 100.0)::numeric(10,2);
  RAISE NOTICE '';
  RAISE NOTICE 'Customer breakdown:';

  FOR rec IN
    SELECT
      cct.customer_email,
      cct.total_credits_pence,
      (cct.total_credits_pence / 100.0)::numeric(10,2) as total_credits_pounds,
      cct.commission_count,
      COALESCE(c.current_credit_balance, 0) as current_balance_pence,
      (COALESCE(c.current_credit_balance, 0) / 100.0)::numeric(10,2) as current_balance_pounds
    FROM customer_credit_totals cct
    LEFT JOIN customers c ON c.id = cct.customer_id
    ORDER BY cct.total_credits_pence DESC
  LOOP
    RAISE NOTICE '  % - Commission records: %, Total: £%, Current balance: £%',
      rec.customer_email,
      rec.commission_count,
      rec.total_credits_pounds,
      rec.current_balance_pounds;
  END LOOP;
END $$;

-- Perform the backfill update
-- Update customers.current_credit_balance to match their commission totals
UPDATE customers c
SET
  current_credit_balance = cct.total_credits_pence,
  updated_at = NOW()
FROM customer_credit_totals cct
WHERE c.id = cct.customer_id;

-- Report results
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '';
  RAISE NOTICE '====== BACKFILL COMPLETE ======';
  RAISE NOTICE '✅ Updated % customer credit balances', updated_count;
END $$;

-- Verify the results
DO $$
DECLARE
  rec RECORD;
  mismatch_count INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '====== VERIFICATION ======';

  -- Check for any mismatches between commission totals and current_credit_balance
  FOR rec IN
    SELECT
      c.email,
      c.current_credit_balance as balance_pence,
      (c.current_credit_balance / 100.0)::numeric(10,2) as balance_pounds,
      COALESCE(SUM(com.commission_amount), 0) as commission_total_pence,
      (COALESCE(SUM(com.commission_amount), 0) / 100.0)::numeric(10,2) as commission_total_pounds
    FROM customers c
    LEFT JOIN commissions com ON com.recipient_id = c.id
      AND com.recipient_type = 'customer'
      AND com.commission_type = 'customer_credit'
      AND com.status IN ('approved', 'paid')
    WHERE c.current_credit_balance > 0 OR EXISTS (
      SELECT 1 FROM commissions
      WHERE recipient_id = c.id
        AND recipient_type = 'customer'
        AND commission_type = 'customer_credit'
        AND status IN ('approved', 'paid')
    )
    GROUP BY c.id, c.email, c.current_credit_balance
    HAVING c.current_credit_balance != COALESCE(SUM(com.commission_amount), 0)
  LOOP
    mismatch_count := mismatch_count + 1;
    RAISE WARNING 'Mismatch for %: Balance=£%, Commission Total=£%',
      rec.email,
      rec.balance_pounds,
      rec.commission_total_pounds;
  END LOOP;

  IF mismatch_count = 0 THEN
    RAISE NOTICE '✅ All customer balances match their commission totals';
  ELSE
    RAISE WARNING '⚠️  Found % customers with mismatched balances', mismatch_count;
  END IF;
END $$;

-- Clean up temporary table
DROP TABLE customer_credit_totals;
