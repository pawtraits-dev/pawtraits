-- Debug partner signup process
-- Check what happens during partner account creation

-- Check current auth users and partners
SELECT 'CURRENT STATE BEFORE PARTNER SIGNUP:' as section;

SELECT 'AUTH USERS:' as subsection;
SELECT 
    id,
    email,
    created_at,
    email_confirmed_at IS NOT NULL as email_confirmed
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

SELECT 'PARTNERS:' as subsection;
SELECT 
    id,
    email,
    first_name,
    last_name,
    business_name,
    approval_status,
    created_at
FROM partners
ORDER BY created_at DESC
LIMIT 5;

SELECT 'USER PROFILES:' as subsection;
SELECT 
    user_id,
    user_type,
    first_name,
    last_name,
    email,
    partner_id,
    created_at
FROM user_profiles
ORDER BY created_at DESC
LIMIT 5;

-- Test the create_partner_profile function
SELECT 'TESTING create_partner_profile FUNCTION:' as section;

-- Generate a test UUID for the user
SELECT 'Test creating partner with UUID:' as test;
SELECT gen_random_uuid() as test_user_id;

-- You can manually test the function with:
-- SELECT * FROM create_partner_profile(
--     'USER_ID_HERE'::UUID,
--     'test@example.com',
--     'Test',
--     'Partner',
--     '+1234567890',
--     'Test Business',
--     'groomer',
--     '{"address": "123 Test St"}',
--     '+1234567890',
--     'https://test.com'
-- );

-- Check if we have all required columns in partners table
SELECT 'PARTNERS TABLE STRUCTURE:' as check;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'partners'
AND column_name IN (
    'id', 'email', 'first_name', 'last_name', 'phone',
    'business_name', 'business_type', 'business_address',
    'business_phone', 'business_website', 'approval_status',
    'commission_rate', 'lifetime_commission_rate'
)
ORDER BY column_name;

-- Check the user_type enum values
SELECT 'USER_TYPE ENUM VALUES:' as check;
SELECT enumlabel as allowed_user_types
FROM pg_enum 
WHERE enumtypid = (
    SELECT oid 
    FROM pg_type 
    WHERE typname = 'user_type_enum'
)
ORDER BY enumlabel;

SELECT 'Debug complete. Try partner signup and check console logs.' as instruction;