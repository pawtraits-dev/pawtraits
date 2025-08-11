-- =====================================================================
-- FIX EXISTING ORDERS - APPLY RETROSPECTIVE DISCOUNTS AND COMMISSIONS
-- =====================================================================
-- This script applies 20% discounts to existing first-time referral customers
-- and ensures all commission tracking is correct

BEGIN;

-- Create a backup of orders before making changes
CREATE TABLE IF NOT EXISTS orders_backup_$(date +%Y%m%d) AS 
SELECT * FROM orders;

-- First, run the commission backfill
\i scripts/backfill-commission-tracking.sql

-- Identify first-time referral customers who should have received discounts
CREATE TEMP TABLE retrospective_discounts AS
WITH first_referral_orders AS (
  SELECT 
    o.*,
    r.referral_code,
    r.partner_id,
    r.id as referral_id,
    -- Calculate what the discount should have been (20% of subtotal)
    ROUND(o.subtotal_amount * 0.20) as should_have_discount,
    -- What they actually paid
    o.total_amount as paid_amount,
    -- What they should have paid with discount
    (o.subtotal_amount - ROUND(o.subtotal_amount * 0.20)) + o.shipping_amount as should_have_paid
  FROM orders o
  JOIN referrals r ON (
    r.client_email = o.customer_email 
    AND r.created_at <= o.created_at
    AND (r.expires_at IS NULL OR r.expires_at >= o.created_at)
  )
  WHERE NOT EXISTS (
    -- Only include if this was their first order
    SELECT 1 FROM orders o2 
    WHERE o2.customer_email = o.customer_email 
    AND o2.created_at < o.created_at
  )
  AND o.subtotal_amount > 0
  -- Only include orders that didn't already have the discount applied
  AND (o.metadata::jsonb->>'discountType' IS NULL OR o.metadata::jsonb->>'discountType' != 'referral_first_order')
)
SELECT * FROM first_referral_orders;

-- Show what discounts would be applied
SELECT 
  'RETROSPECTIVE DISCOUNT ANALYSIS' as section,
  COUNT(*) as affected_orders,
  SUM(should_have_discount) / 100.0 as total_discount_amount_pounds,
  SUM(paid_amount - should_have_paid) / 100.0 as total_customer_savings_pounds,
  AVG(should_have_discount) / 100.0 as avg_discount_per_order_pounds
FROM retrospective_discounts;

-- Show detailed breakdown
SELECT 
  'AFFECTED CUSTOMERS' as section,
  customer_email,
  referral_code,
  order_number,
  created_at::date as order_date,
  (subtotal_amount / 100.0) as original_subtotal_pounds,
  (should_have_discount / 100.0) as discount_amount_pounds,
  (paid_amount / 100.0) as amount_paid_pounds,
  (should_have_paid / 100.0) as should_have_paid_pounds,
  ((paid_amount - should_have_paid) / 100.0) as customer_overpaid_pounds
FROM retrospective_discounts
ORDER BY created_at;

-- OPTION 1: Apply discounts by updating existing orders (changes historical data)
-- Uncomment the following block if you want to update historical orders

/*
UPDATE orders SET
  subtotal_amount = rd.subtotal_amount - rd.should_have_discount,
  total_amount = rd.should_have_paid,
  metadata = jsonb_set(
    COALESCE(metadata::jsonb, '{}'::jsonb),
    '{retrospectiveDiscount}',
    json_build_object(
      'originalSubtotal', rd.subtotal_amount,
      'discountAmount', rd.should_have_discount,
      'discountType', 'referral_first_order_retrospective',
      'referralCode', rd.referral_code,
      'appliedDate', now()
    )::jsonb
  ),
  updated_at = now()
FROM retrospective_discounts rd
WHERE orders.id = rd.id;
*/

-- OPTION 2: Create store credit/refund records (recommended approach)
-- This preserves historical accuracy while providing customer compensation

CREATE TABLE IF NOT EXISTS customer_credits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_email TEXT NOT NULL,
  order_id UUID REFERENCES orders(id),
  referral_id UUID REFERENCES referrals(id),
  credit_type TEXT NOT NULL DEFAULT 'referral_discount_retrospective',
  credit_amount INTEGER NOT NULL, -- in pence
  credit_reason TEXT,
  issued_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  used_date TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'issued', 'used', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert store credits for affected customers
INSERT INTO customer_credits (
  customer_email,
  order_id,
  referral_id,
  credit_amount,
  credit_reason,
  status
)
SELECT 
  rd.customer_email,
  rd.id,
  rd.referral_id,
  rd.should_have_discount,
  'Retrospective 20% referral discount - Order #' || rd.order_number,
  'pending'
FROM retrospective_discounts rd;

-- Update client_orders to reflect the discount that should have been applied
UPDATE client_orders SET
  discount_applied = rd.should_have_discount,
  updated_at = now()
FROM retrospective_discounts rd
WHERE client_orders.client_email = rd.customer_email
  AND client_orders.created_at::date = rd.created_at::date
  AND client_orders.is_initial_order = true;

-- Show final summary of credits issued
SELECT 
  'STORE CREDITS ISSUED' as section,
  COUNT(*) as credits_issued,
  SUM(credit_amount) / 100.0 as total_credit_amount_pounds,
  COUNT(DISTINCT customer_email) as affected_customers
FROM customer_credits
WHERE credit_type = 'referral_discount_retrospective';

-- Show customers who received credits
SELECT 
  'CUSTOMER CREDITS BREAKDOWN' as section,
  cc.customer_email,
  o.order_number,
  (cc.credit_amount / 100.0) as credit_amount_pounds,
  cc.credit_reason,
  cc.issued_date::date as issued_date,
  cc.status
FROM customer_credits cc
JOIN orders o ON cc.order_id = o.id
WHERE cc.credit_type = 'referral_discount_retrospective'
ORDER BY cc.issued_date, cc.customer_email;

COMMIT;

-- Clean up temp tables
DROP TABLE IF EXISTS retrospective_discounts;

-- Final recommendation message
SELECT 
  'NEXT STEPS' as section,
  'Send email notifications to customers about their store credits' as action_1,
  'Update website to show store credit balances in customer accounts' as action_2,
  'Implement store credit redemption in checkout process' as action_3;