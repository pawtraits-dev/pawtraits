-- Script to fix missing order links for referrals
-- This script finds referrals that should be linked to orders based on customer email matches
-- and updates them with the correct order information and commission data

-- First, let's see what we're working with
SELECT 
    'BEFORE FIX - Referrals with null order_id but matching orders:' as info,
    COUNT(*) as count
FROM referrals r
WHERE r.order_id IS NULL 
AND EXISTS (
    SELECT 1 FROM orders o 
    WHERE o.customer_email = r.client_email
    AND o.status = 'confirmed'
);

-- Update referrals with matching orders
-- This matches referrals to orders based on customer email and finds the most recent confirmed order
WITH referral_order_matches AS (
    SELECT DISTINCT ON (r.id)
        r.id as referral_id,
        r.client_email,
        r.referral_code,
        o.id as order_id,
        o.order_number,
        o.total_amount,
        o.shipping_amount,
        o.subtotal_amount,
        o.created_at as order_date,
        -- Calculate if this was likely a first-time customer order
        (SELECT COUNT(*) FROM orders o2 WHERE o2.customer_email = r.client_email AND o2.created_at < o.created_at) = 0 as is_first_order,
        -- Calculate commission based on first order rules
        CASE 
            WHEN (SELECT COUNT(*) FROM orders o2 WHERE o2.customer_email = r.client_email AND o2.created_at < o.created_at) = 0 
            THEN 20.00  -- 20% for first order
            ELSE 5.00   -- 5% for subsequent orders
        END as commission_rate,
        -- Calculate commission amount (on subtotal)
        ROUND(o.subtotal_amount * 
            CASE 
                WHEN (SELECT COUNT(*) FROM orders o2 WHERE o2.customer_email = r.client_email AND o2.created_at < o.created_at) = 0 
                THEN 0.20  -- 20% for first order
                ELSE 0.05  -- 5% for subsequent orders
            END
        ) as commission_amount,
        -- Calculate discount (20% for first-time customers)
        CASE 
            WHEN (SELECT COUNT(*) FROM orders o2 WHERE o2.customer_email = r.client_email AND o2.created_at < o.created_at) = 0 
            THEN ROUND(o.subtotal_amount * 0.20)
            ELSE 0
        END as discount_amount
    FROM referrals r
    INNER JOIN orders o ON o.customer_email = r.client_email
    WHERE r.order_id IS NULL 
    AND o.status = 'confirmed'
    AND r.status IN ('invited', 'accessed', 'accepted')  -- Only update unused referrals
    ORDER BY r.id, o.created_at DESC  -- Get most recent order for each referral
)
UPDATE referrals 
SET 
    status = 'applied',
    order_id = rom.order_id,
    order_value = rom.subtotal_amount,
    discount_amount = rom.discount_amount,
    commission_amount = rom.commission_amount,
    purchased_at = rom.order_date,
    updated_at = NOW()
FROM referral_order_matches rom
WHERE referrals.id = rom.referral_id;

-- Show results of the update
SELECT 
    'AFTER FIX - Updated referrals:' as info,
    COUNT(*) as count
FROM referrals r
WHERE r.order_id IS NOT NULL 
AND r.status = 'applied'
AND r.updated_at > NOW() - INTERVAL '1 minute';

-- Now create/update client_orders records for commission tracking
-- This ensures all referral orders have proper commission tracking records
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
    r.client_email,
    r.id,
    r.partner_id,
    r.order_value,
    COALESCE(r.discount_amount, 0),
    r.commission_rate = 20.00,  -- True if 20% commission rate (first order)
    r.commission_rate,
    r.commission_amount,
    false,  -- commission not yet paid
    '[]'::jsonb,  -- empty order items for now
    'completed',
    r.purchased_at,
    NOW()
FROM referrals r
WHERE r.order_id IS NOT NULL
AND r.status = 'applied'
AND r.commission_amount > 0
AND NOT EXISTS (
    SELECT 1 FROM client_orders co 
    WHERE co.referral_id = r.id 
    AND co.client_email = r.client_email
)
ON CONFLICT (referral_id, client_email) DO UPDATE SET
    order_value = EXCLUDED.order_value,
    discount_applied = EXCLUDED.discount_applied,
    commission_rate = EXCLUDED.commission_rate,
    commission_amount = EXCLUDED.commission_amount,
    updated_at = NOW();

-- Final summary
SELECT 
    'FINAL SUMMARY' as section,
    'Total referrals with orders linked' as metric,
    COUNT(*) as value
FROM referrals 
WHERE order_id IS NOT NULL

UNION ALL

SELECT 
    'FINAL SUMMARY' as section,
    'Total applied referrals' as metric,
    COUNT(*) as value
FROM referrals 
WHERE status = 'applied'

UNION ALL

SELECT 
    'FINAL SUMMARY' as section,
    'Total client_orders commission records' as metric,
    COUNT(*) as value
FROM client_orders

UNION ALL

SELECT 
    'FINAL SUMMARY' as section,
    'Total commission amount (pence)' as metric,
    COALESCE(SUM(commission_amount), 0) as value
FROM client_orders

ORDER BY section, metric;

-- Show specific details of fixed referrals
SELECT 
    r.referral_code,
    r.client_email,
    r.status,
    o.order_number,
    r.order_value as order_value_pence,
    r.commission_amount as commission_pence,
    r.commission_rate,
    r.purchased_at
FROM referrals r
INNER JOIN orders o ON o.id = r.order_id
WHERE r.updated_at > NOW() - INTERVAL '1 minute'
ORDER BY r.updated_at DESC;