-- ========================================
-- PARTNER ATTRIBUTION TRACKING SYSTEM
-- ========================================
-- This script creates a recursive function to track all customers
-- attributable to a partner through multi-level referral chains:
-- Partner → Customer1 → Customer2 → Customer3 → ...
--
-- Execute this SQL in Supabase SQL Editor

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_attributed_customers(TEXT);

-- Create recursive function to get all customers in attribution chain
CREATE OR REPLACE FUNCTION get_attributed_customers(partner_code TEXT)
RETURNS TABLE(
  customer_id UUID,
  customer_email TEXT,
  referral_level INT,
  referral_path TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE attribution_chain AS (
    -- Base case: Get direct customers who used the partner's code
    SELECT
      c.id AS customer_id,
      c.email AS customer_email,
      1 AS referral_level,
      c.personal_referral_code AS referral_path
    FROM customers c
    WHERE c.referral_type = 'PARTNER'
      AND c.referral_code_used = partner_code

    UNION ALL

    -- Recursive case: Get customers referred by customers in the chain
    SELECT
      c.id AS customer_id,
      c.email AS customer_email,
      ac.referral_level + 1 AS referral_level,
      ac.referral_path || ' → ' || c.personal_referral_code AS referral_path
    FROM customers c
    INNER JOIN attribution_chain ac
      ON c.referred_by_customer_id = ac.customer_id
    WHERE c.referral_type = 'CUSTOMER'
      AND ac.referral_level < 10  -- Prevent infinite loops, max 10 levels
  )
  SELECT * FROM attribution_chain
  ORDER BY referral_level, customer_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_attributed_customers(TEXT) TO authenticated, anon;

-- Add helpful comment
COMMENT ON FUNCTION get_attributed_customers(TEXT) IS
  'Recursively finds all customers attributed to a partner through multi-level referral chains. ' ||
  'Returns customer_id, email, referral level (1=direct, 2=2nd level, etc.), and referral path.';

-- ========================================
-- EXAMPLE USAGE
-- ========================================
-- To get all attributed customers for partner code 'PEUWQLMN':
-- SELECT * FROM get_attributed_customers('PEUWQLMN');
--
-- Expected output:
-- | customer_id                          | customer_email        | referral_level | referral_path         |
-- |--------------------------------------|-----------------------|----------------|----------------------|
-- | f3599308-fc9c-43bd-bf0c-730baaed1017 | c-010@atemporal.co.uk | 1              | CUST010CODE          |
-- | 87cb8d6c-b394-4fac-9783-daf583eaecd9 | c-006@atemporal.co.uk | 1              | CUST006CODE          |
-- | ... (customers referred by c-010)    | ...                   | 2              | CUST010CODE → ...    |
