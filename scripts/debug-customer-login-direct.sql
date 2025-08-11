-- Debug customer login issue by checking the actual records
-- Run this with the customer email that can't login

-- Replace 'CUSTOMER_EMAIL_HERE' with the actual customer email
-- SET @customer_email = 'test@example.com';

SELECT 'CUSTOMER LOGIN DEBUG:' as section;

-- Check auth users for this email
SELECT 'AUTH USERS:' as subsection;
SELECT 
    id,
    email,
    created_at,
    email_confirmed_at IS NOT NULL as email_confirmed,
    last_sign_in_at,
    raw_user_meta_data
FROM auth.users
WHERE email = 'REPLACE_WITH_CUSTOMER_EMAIL'  -- Replace this!
ORDER BY created_at DESC;

-- Check user_profiles for this user
SELECT 'USER PROFILES:' as subsection;
SELECT 
    up.id,
    up.user_id,
    up.user_type,
    up.first_name,
    up.last_name,
    up.email,
    up.status,
    up.customer_id,
    up.created_at
FROM user_profiles up
JOIN auth.users au ON up.user_id = au.id
WHERE au.email = 'REPLACE_WITH_CUSTOMER_EMAIL'  -- Replace this!
ORDER BY up.created_at DESC;

-- Check customers table
SELECT 'CUSTOMERS:' as subsection;
SELECT 
    c.id,
    c.user_id,
    c.email,
    c.first_name,
    c.last_name,
    c.is_registered,
    c.created_at
FROM customers c
WHERE c.email = 'REPLACE_WITH_CUSTOMER_EMAIL'  -- Replace this!
ORDER BY c.created_at DESC;

-- Test the get_user_profile function with the auth user ID
SELECT 'TESTING get_user_profile FUNCTION:' as subsection;
-- Replace 'USER_ID_HERE' with the actual auth user ID from the first query
-- SELECT * FROM get_user_profile('USER_ID_HERE'::UUID);

-- Check for any issues with the user_profile record
SELECT 'PROFILE VALIDATION:' as subsection;
SELECT 
    up.user_id,
    up.user_type,
    up.status,
    CASE 
        WHEN up.user_type IS NULL THEN '❌ Missing user_type'
        WHEN up.status != 'active' THEN '❌ Status not active: ' || up.status
        WHEN up.user_id IS NULL THEN '❌ Missing user_id'
        ELSE '✅ Profile looks valid'
    END as validation_result
FROM user_profiles up
JOIN auth.users au ON up.user_id = au.id
WHERE au.email = 'REPLACE_WITH_CUSTOMER_EMAIL';  -- Replace this!

SELECT 'Replace the email placeholders with actual customer email and run again' as instruction;