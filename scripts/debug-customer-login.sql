-- Debug customer login issue
-- Check if user_profile records are being created correctly

-- Check all auth users and their corresponding profiles
SELECT 
    'AUTH USERS AND PROFILES:' as section;

SELECT 
    au.id as auth_user_id,
    au.email as auth_email,
    au.created_at as auth_created,
    up.user_type,
    up.first_name,
    up.last_name,
    up.customer_id,
    up.partner_id,
    CASE 
        WHEN up.user_id IS NULL THEN '❌ NO PROFILE'
        ELSE '✅ HAS PROFILE'
    END as profile_status
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.user_id
ORDER BY au.created_at DESC;

-- Check customer records
SELECT 
    'CUSTOMER RECORDS:' as section;

SELECT 
    c.id as customer_id,
    c.email,
    c.first_name,
    c.last_name,
    c.user_id,
    c.is_registered,
    c.referral_code,
    c.created_at
FROM customers c
ORDER BY c.created_at DESC;

-- Check for orphaned records
SELECT 
    'ORPHANED AUTH USERS (no profile):' as section;

SELECT 
    au.id,
    au.email,
    au.created_at,
    'No user_profile record' as issue
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.user_id
WHERE up.user_id IS NULL;

-- Check for customers without profiles
SELECT 
    'CUSTOMERS WITHOUT PROFILES:' as section;

SELECT 
    c.id as customer_id,
    c.email,
    c.user_id,
    'Customer exists but no user_profile' as issue
FROM customers c
LEFT JOIN user_profiles up ON c.user_id = up.user_id
WHERE up.user_id IS NULL;

-- Check the get_user_profile function works
SELECT 
    'TESTING get_user_profile FUNCTION:' as section;

-- This will test the RPC function the app uses
-- Replace 'USER_ID_HERE' with an actual user ID from the auth.users results above
-- SELECT * FROM get_user_profile('USER_ID_HERE');

SELECT 'Replace USER_ID_HERE with actual auth user ID to test the function' as instruction;