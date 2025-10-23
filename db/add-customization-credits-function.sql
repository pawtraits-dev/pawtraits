-- =====================================================
-- ADD CUSTOMIZATION CREDITS FUNCTION
-- =====================================================
-- Function to add purchased credits to customer account
-- Used by Stripe webhook when credit pack purchase completes
-- =====================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS add_customization_credits(uuid, integer, integer);

CREATE OR REPLACE FUNCTION add_customization_credits(
  p_customer_id UUID,
  p_credits_to_add INTEGER,
  p_purchase_amount INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_record_exists BOOLEAN;
BEGIN
  -- Check if customer already has a customization credits record
  SELECT EXISTS(
    SELECT 1 FROM customer_customization_credits
    WHERE customer_id = p_customer_id
  ) INTO v_record_exists;

  IF v_record_exists THEN
    -- Update existing record
    UPDATE customer_customization_credits
    SET
      credits_remaining = credits_remaining + p_credits_to_add,
      credits_purchased = credits_purchased + p_credits_to_add,
      last_purchase_date = NOW(),
      total_spent_amount = total_spent_amount + p_purchase_amount,
      updated_at = NOW()
    WHERE customer_id = p_customer_id;

    RAISE NOTICE 'Updated existing customer credit record: customer_id=%, added % credits',
      p_customer_id, p_credits_to_add;
  ELSE
    -- Create new record with free trial credits
    INSERT INTO customer_customization_credits (
      customer_id,
      credits_remaining,
      credits_purchased,
      free_trial_credits_granted,
      last_purchase_date,
      total_spent_amount,
      created_at,
      updated_at
    ) VALUES (
      p_customer_id,
      p_credits_to_add + 2, -- Add 2 free trial credits for new users
      p_credits_to_add,
      2,
      NOW(),
      p_purchase_amount,
      NOW(),
      NOW()
    );

    RAISE NOTICE 'Created new customer credit record: customer_id=%, initial credits=% (includes 2 free trial)',
      p_customer_id, p_credits_to_add + 2;
  END IF;

  RETURN TRUE;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to add customization credits: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION add_customization_credits(UUID, INTEGER, INTEGER) TO service_role;

COMMENT ON FUNCTION add_customization_credits IS 'Adds purchased customization credits to customer account, includes free trial credits for new users';
