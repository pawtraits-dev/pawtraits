-- =====================================================
-- FIX CREDIT PACK COMMISSION RECIPIENT IDS
-- =====================================================
-- Purpose: Update existing credit pack bonus commission records to use
--          correct recipient_id (customers.id instead of user_profiles.id)
-- Context: Checkout was incorrectly using userProfile.id for commission records
--          Referrals API queries by customer.id, so bonuses weren't visible
-- =====================================================

-- Preview what will be updated
DO $$
DECLARE
  rec RECORD;
  total_to_fix INTEGER;
BEGIN
  -- Count records that need fixing
  SELECT COUNT(*) INTO total_to_fix
  FROM commissions c
  WHERE c.commission_type = 'customer_credit'
    AND c.metadata->>'source' = 'credit_pack_purchase'
    AND NOT EXISTS (
      -- Check if recipient_id exists in customers table
      SELECT 1 FROM customers cust WHERE cust.id = c.recipient_id
    );

  RAISE NOTICE '====== FIX PREVIEW ======';
  RAISE NOTICE 'Total credit pack commission records to fix: %', total_to_fix;
  RAISE NOTICE '';

  IF total_to_fix = 0 THEN
    RAISE NOTICE '✅ No records need fixing - all recipient_ids are correct';
    RETURN;
  END IF;

  RAISE NOTICE 'Records that will be updated:';
  RAISE NOTICE '';

  -- Show details of records to fix
  FOR rec IN
    SELECT
      c.id as commission_id,
      c.recipient_id as wrong_recipient_id,
      c.recipient_email,
      c.commission_amount,
      (c.commission_amount / 100.0)::numeric(10,2) as amount_pounds,
      c.created_at,
      cust.id as correct_customer_id,
      cust.email as customer_email
    FROM commissions c
    LEFT JOIN customers cust ON cust.email = c.recipient_email
    WHERE c.commission_type = 'customer_credit'
      AND c.metadata->>'source' = 'credit_pack_purchase'
      AND NOT EXISTS (
        SELECT 1 FROM customers WHERE id = c.recipient_id
      )
    ORDER BY c.created_at DESC
  LOOP
    IF rec.correct_customer_id IS NULL THEN
      RAISE WARNING '⚠️  Commission % - No customer found for email: %',
        rec.commission_id, rec.recipient_email;
    ELSE
      RAISE NOTICE '  % - Amount: £% - Email: % - Wrong ID: % → Correct ID: %',
        rec.commission_id,
        rec.amount_pounds,
        rec.recipient_email,
        substring(rec.wrong_recipient_id::text, 1, 8) || '...',
        substring(rec.correct_customer_id::text, 1, 8) || '...';
    END IF;
  END LOOP;
END $$;

-- Perform the fix
UPDATE commissions c
SET
  recipient_id = cust.id,
  updated_at = NOW()
FROM customers cust
WHERE c.recipient_email = cust.email
  AND c.commission_type = 'customer_credit'
  AND c.metadata->>'source' = 'credit_pack_purchase'
  AND NOT EXISTS (
    -- Only update if recipient_id doesn't match a customer record
    SELECT 1 FROM customers WHERE id = c.recipient_id
  );

-- Report results
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '';
  RAISE NOTICE '====== FIX COMPLETE ======';
  RAISE NOTICE '✅ Updated % commission records with correct recipient_id', updated_count;
END $$;

-- Verify the fix
DO $$
DECLARE
  rec RECORD;
  remaining_issues INTEGER := 0;
  fixed_records INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '====== VERIFICATION ======';

  -- Count fixed records
  SELECT COUNT(*) INTO fixed_records
  FROM commissions c
  INNER JOIN customers cust ON cust.id = c.recipient_id
  WHERE c.commission_type = 'customer_credit'
    AND c.metadata->>'source' = 'credit_pack_purchase';

  RAISE NOTICE '✅ Total credit pack commissions with correct recipient_id: %', fixed_records;

  -- Check for any remaining issues
  FOR rec IN
    SELECT
      c.id,
      c.recipient_id,
      c.recipient_email
    FROM commissions c
    WHERE c.commission_type = 'customer_credit'
      AND c.metadata->>'source' = 'credit_pack_purchase'
      AND NOT EXISTS (
        SELECT 1 FROM customers WHERE id = c.recipient_id
      )
  LOOP
    remaining_issues := remaining_issues + 1;
    RAISE WARNING '⚠️  Commission % still has invalid recipient_id for email: %',
      rec.id, rec.recipient_email;
  END LOOP;

  IF remaining_issues = 0 THEN
    RAISE NOTICE '✅ All credit pack commission records now have correct recipient_id';
    RAISE NOTICE '';
    RAISE NOTICE '💡 These bonuses should now be visible in /referrals page';
  ELSE
    RAISE WARNING '⚠️  Found % commission records that could not be fixed', remaining_issues;
    RAISE WARNING '💡 These records have emails that do not exist in customers table';
  END IF;
END $$;
