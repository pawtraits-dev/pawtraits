-- =====================================================
-- ALLOW NULL ORDER_ID FOR PREPAID CREDITS
-- =====================================================
-- Credit pack purchases create commission records for order credit bonuses
-- These are prepaid credits not yet tied to a specific order
-- Therefore order_id should be nullable
-- =====================================================

-- Remove NOT NULL constraint from order_id
ALTER TABLE commissions
ALTER COLUMN order_id DROP NOT NULL;

-- Add a check constraint to ensure order_id is null only for prepaid credits
ALTER TABLE commissions
ADD CONSTRAINT commissions_order_id_null_check
CHECK (
  (order_id IS NULL AND metadata->>'source' = 'credit_pack_purchase')
  OR
  (order_id IS NOT NULL)
);

-- Verify the change
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'commissions'
      AND column_name = 'order_id'
      AND is_nullable = 'YES'
  ) THEN
    RAISE NOTICE '✅ order_id column is now nullable';
  ELSE
    RAISE EXCEPTION '❌ Failed to make order_id nullable';
  END IF;
END $$;
