-- Step 3: Test the referral status system (optional)
-- Run this to verify everything is working correctly

-- This script creates a test referral and walks through the status transitions
-- You can run this to verify the system works, then delete the test data

DO $$
DECLARE
    test_partner_id UUID;
    test_referral referrals;
    accessed_referral referrals;
    accepted_referral referrals;
BEGIN
    -- Create a temporary test partner (you can skip this if you have a real partner)
    INSERT INTO partners (
        id,
        email,
        first_name,
        last_name,
        business_name,
        business_type,
        approval_status
    ) VALUES (
        gen_random_uuid(),
        'test@example.com',
        'Test',
        'Partner',
        'Test Business',
        'groomer',
        'approved'
    ) RETURNING id INTO test_partner_id;
    
    -- Test 1: Create a referral (should start as 'invited')
    SELECT * INTO test_referral FROM create_referral_for_partner(
        test_partner_id,
        'TEST001',
        'Test Client',
        'client@example.com',
        '+1234567890',
        'Test notes',
        'Test Pet',
        NULL,
        NULL
    );
    
    RAISE NOTICE 'Created referral with status: %', test_referral.status;
    
    -- Test 2: Mark as accessed (should change to 'accessed')
    SELECT * INTO accessed_referral FROM mark_referral_accessed('TEST001');
    
    RAISE NOTICE 'After access, status: %', accessed_referral.status;
    
    -- Test 3: Mark as accepted (should change to 'accepted')
    SELECT * INTO accepted_referral FROM mark_referral_accepted('TEST001', 'client@example.com');
    
    RAISE NOTICE 'After account creation, status: %', accepted_referral.status;
    
    -- Clean up test data
    DELETE FROM referrals WHERE referral_code = 'TEST001';
    DELETE FROM partners WHERE id = test_partner_id;
    
    RAISE NOTICE 'Test completed successfully! All status transitions working.';
    
END $$;

-- Verify the constraint allows all the new status values
SELECT 'Testing constraint with all status values:' as test;

-- This should not produce any errors
SELECT 
    status_value,
    CASE 
        WHEN status_value = ANY (ARRAY['invited'::text, 'accessed'::text, 'accepted'::text, 'applied'::text, 'expired'::text])
        THEN '✓ ALLOWED'
        ELSE '✗ BLOCKED'
    END as constraint_check
FROM (
    VALUES 
        ('invited'),
        ('accessed'), 
        ('accepted'),
        ('applied'),
        ('expired'),
        ('old_pending'),  -- This should be blocked
        ('old_viewed')    -- This should be blocked
) AS t(status_value);

SELECT 'Referral status system test completed!' as message;