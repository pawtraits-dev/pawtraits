-- =====================================================================
-- BACKFILL COMMISSION TRACKING FOR EXISTING ORDERS
-- =====================================================================
-- This script analyzes existing orders and creates commission records
-- for orders that came through referral links

-- First, ensure client_orders table exists
\i scripts/create-client-orders-table.sql

BEGIN;

-- Create a temporary table to analyze existing orders
CREATE TEMP TABLE order_analysis AS
WITH customer_order_sequence AS (
  -- Number orders by customer to identify first vs subsequent
  SELECT 
    o.*,
    ROW_NUMBER() OVER (PARTITION BY o.customer_email ORDER BY o.created_at) as order_sequence,
    oi.order_items
  FROM orders o
  LEFT JOIN (
    -- Aggregate order items per order
    SELECT 
      order_id,
      json_agg(
        json_build_object(
          'productId', product_id,
          'imageId', image_id,
          'imageUrl', image_url,
          'imageTitle', image_title,
          'quantity', quantity,
          'unitPrice', unit_price,
          'totalPrice', total_price
        )
      ) as order_items
    FROM order_items 
    GROUP BY order_id
  ) oi ON o.id = oi.order_id
),
referral_matches AS (
  -- Try to match orders to referrals based on email and timing
  SELECT 
    cos.*,
    r.id as referral_id,
    r.partner_id,
    r.referral_code,
    r.commission_rate,
    r.lifetime_commission_rate,
    -- Calculate commission based on order sequence
    CASE 
      WHEN cos.order_sequence = 1 THEN COALESCE(r.commission_rate, 20.00)
      ELSE COALESCE(r.lifetime_commission_rate, 5.00)
    END as calculated_commission_rate,
    -- Calculate commission amount (on subtotal, not including shipping)
    ROUND(cos.subtotal_amount * (
      CASE 
        WHEN cos.order_sequence = 1 THEN COALESCE(r.commission_rate, 20.00)
        ELSE COALESCE(r.lifetime_commission_rate, 5.00)
      END
    ) / 100) as calculated_commission_amount
  FROM customer_order_sequence cos
  LEFT JOIN referrals r ON (
    r.client_email = cos.customer_email 
    AND r.created_at <= cos.created_at
    AND (r.expires_at IS NULL OR r.expires_at >= cos.created_at)
  )
)
SELECT * FROM referral_matches;

-- Show analysis summary
SELECT 
  'ANALYSIS SUMMARY' as section,
  COUNT(*) as total_orders,
  COUNT(referral_id) as orders_with_referrals,
  COUNT(*) - COUNT(referral_id) as orders_without_referrals,
  SUM(CASE WHEN referral_id IS NOT NULL THEN calculated_commission_amount ELSE 0 END) as total_commission_amount,
  SUM(CASE WHEN referral_id IS NOT NULL AND order_sequence = 1 THEN calculated_commission_amount ELSE 0 END) as first_order_commissions,
  SUM(CASE WHEN referral_id IS NOT NULL AND order_sequence > 1 THEN calculated_commission_amount ELSE 0 END) as repeat_order_commissions
FROM order_analysis;

-- Show detailed breakdown by partner
SELECT 
  'PARTNER BREAKDOWN' as section,
  p.business_name,
  p.first_name || ' ' || p.last_name as partner_name,
  COUNT(oa.id) as referred_orders,
  SUM(oa.calculated_commission_amount) as total_commission,
  SUM(CASE WHEN oa.order_sequence = 1 THEN oa.calculated_commission_amount ELSE 0 END) as first_order_commission,
  SUM(CASE WHEN oa.order_sequence > 1 THEN oa.calculated_commission_amount ELSE 0 END) as repeat_commission
FROM order_analysis oa
JOIN partners p ON p.id = oa.partner_id
WHERE oa.referral_id IS NOT NULL
GROUP BY p.id, p.business_name, p.first_name, p.last_name
ORDER BY total_commission DESC;

-- Insert commission tracking records for orders with referrals
INSERT INTO client_orders (
  client_email,
  referral_id,
  partner_id,
  order_value,
  discount_applied,
  is_initial_order,
  commission_rate,
  commission_amount,
  commission_paid,
  order_items,
  order_status,
  created_at,
  updated_at
)
SELECT 
  oa.customer_email,
  oa.referral_id,
  oa.partner_id,
  oa.subtotal_amount, -- Use subtotal (excluding shipping)
  0, -- No discount applied historically
  (oa.order_sequence = 1) as is_initial_order,
  oa.calculated_commission_rate,
  oa.calculated_commission_amount,
  false, -- Mark as unpaid initially
  oa.order_items,
  'completed', -- Assume existing orders are completed
  oa.created_at,
  oa.updated_at
FROM order_analysis oa
WHERE oa.referral_id IS NOT NULL
  AND NOT EXISTS (
    -- Don't insert duplicates if script is run multiple times
    SELECT 1 FROM client_orders co 
    WHERE co.client_email = oa.customer_email 
    AND co.created_at = oa.created_at
  );

-- Update referrals table with purchase information for first orders
UPDATE referrals SET
  status = 'purchased',
  order_id = oa.id,
  order_value = oa.subtotal_amount,
  commission_amount = oa.calculated_commission_amount,
  purchased_at = oa.created_at,
  updated_at = now()
FROM order_analysis oa
WHERE referrals.id = oa.referral_id
  AND oa.order_sequence = 1 -- Only update for first orders
  AND referrals.status != 'purchased'; -- Don't overwrite if already marked

-- Show final summary
SELECT 
  'BACKFILL COMPLETE' as section,
  COUNT(*) as commission_records_created,
  SUM(commission_amount) as total_commission_amount,
  COUNT(CASE WHEN is_initial_order THEN 1 END) as initial_order_records,
  COUNT(CASE WHEN NOT is_initial_order THEN 1 END) as repeat_order_records
FROM client_orders
WHERE created_at >= (SELECT MIN(created_at) FROM orders);

-- Show referrals that were updated
SELECT 
  'UPDATED REFERRALS' as section,
  COUNT(*) as referrals_marked_purchased,
  SUM(commission_amount) as total_referral_value
FROM referrals 
WHERE status = 'purchased' 
  AND purchased_at >= (SELECT MIN(created_at) FROM orders);

COMMIT;

-- Clean up
DROP TABLE IF EXISTS order_analysis;