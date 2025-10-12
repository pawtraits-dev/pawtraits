-- ========================================
-- CUSTOMER ATTRIBUTION TRACKING SYSTEM
-- ========================================
-- This script creates a recursive function to track all customers
-- attributable to a customer through multi-level referral chains:
-- Customer1 → Customer2 → Customer3 → ...
--
-- Execute this SQL in Supabase SQL Editor

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_attributed_customers_for_customer(TEXT);

-- Create recursive function to get all customers in attribution chain for a customer
CREATE OR REPLACE FUNCTION get_attributed_customers_for_customer(customer_code TEXT)
RETURNS TABLE(
  customer_id UUID,
  customer_email TEXT,
  referral_level INT,
  referral_path TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE attribution_chain AS (
    -- Base case: Get direct customers who used this customer's referral code
    SELECT
      c.id AS customer_id,
      c.email AS customer_email,
      1 AS referral_level,
      CAST(c.personal_referral_code AS TEXT) AS referral_path
    FROM customers c
    WHERE c.referral_type = 'CUSTOMER'
      AND c.referral_code_used = customer_code

    UNION ALL

    -- Recursive case: Get customers referred by customers in the chain
    -- Join on referrer_id = parent customer_id
    SELECT
      c.id AS customer_id,
      c.email AS customer_email,
      ac.referral_level + 1 AS referral_level,
      CAST(ac.referral_path || ' → ' || c.personal_referral_code AS TEXT) AS referral_path
    FROM customers c
    INNER JOIN attribution_chain ac
      ON c.referrer_id = ac.customer_id
    WHERE c.referral_type = 'CUSTOMER'
      AND ac.referral_level < 10  -- Prevent infinite loops, max 10 levels
  )
  SELECT * FROM attribution_chain
  ORDER BY referral_level, customer_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_attributed_customers_for_customer(TEXT) TO authenticated, anon;

-- Add helpful comment
COMMENT ON FUNCTION get_attributed_customers_for_customer(TEXT) IS
  'Recursively finds all customers attributed to a customer through multi-level referral chains. ' ||
  'Returns customer_id (user_profiles.id), email, referral level (1=direct, 2=2nd level, etc.), and referral path.';

-- ========================================
-- EXAMPLE USAGE
-- ========================================
-- To get all attributed customers for customer code 'CUST012CODE':
-- SELECT * FROM get_attributed_customers_for_customer('CUST012CODE');
--
-- Expected output:
-- | customer_id                          | customer_email        | referral_level | referral_path         |
-- |--------------------------------------|-----------------------|----------------|----------------------|
-- | 19801270-3a33-4d0e-be3f-ff1f45606f3a | c-013@atemporal.co.uk | 1              | CUST013CODE          |
-- | 87cb8d6c-b394-4fac-9783-daf583eaecd9 | c-014@atemporal.co.uk | 2              | CUST013CODE → ...    |
