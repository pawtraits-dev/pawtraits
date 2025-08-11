-- SAFE cleanup of orphaned auth.users records
-- GUARANTEED to preserve admin user AUTH records

-- IMPORTANT: This script requires SUPABASE SERVICE ROLE permissions
-- Run this through the Supabase SQL Editor

BEGIN;

-- First, let's see what we're working with
SELECT 'BEFORE CLEANUP:' as stage;
SELECT 'Total auth.users:' as info, COUNT(*) as count FROM auth.users;
SELECT 'Total user_profiles:' as info, COUNT(*) as count FROM user_profiles;

-- Get admin user IDs to preserve (CRITICAL - these must be preserved)
CREATE TEMP TABLE admin_user_ids AS 
SELECT user_id FROM user_profiles WHERE user_type = 'admin';

-- SAFETY CHECK: Show which users will be preserved
SELECT 'ADMIN USERS TO PRESERVE:' as check;
SELECT 
    au.id,
    au.email,
    up.first_name,
    up.last_name,
    up.user_type
FROM auth.users au
JOIN user_profiles up ON au.id = up.user_id
WHERE up.user_type = 'admin';

-- Show which users will be deleted (for verification)
SELECT 'USERS TO BE DELETED:' as check;
SELECT 
    au.id,
    au.email,
    au.created_at
FROM auth.users au
WHERE au.id NOT IN (SELECT user_id FROM admin_user_ids)
ORDER BY au.created_at;

-- PAUSE HERE - VERIFY THE ABOVE LISTS ARE CORRECT BEFORE PROCEEDING
-- If anything looks wrong, ROLLBACK and investigate

-- Count what we're about to delete vs preserve
SELECT 
    'Will DELETE' as action,
    COUNT(*) as count
FROM auth.users 
WHERE id NOT IN (SELECT user_id FROM admin_user_ids)
UNION ALL
SELECT 
    'Will PRESERVE' as action,
    COUNT(*) as count
FROM auth.users 
WHERE id IN (SELECT user_id FROM admin_user_ids);

-- THE ACTUAL DELETION - only proceed if the above looks correct
-- DELETE FROM auth.users 
-- WHERE id NOT IN (SELECT user_id FROM admin_user_ids);

-- For safety, let's comment out the actual deletion and show what would happen
SELECT 'DELETION COMMENTED OUT FOR SAFETY' as warning;
SELECT 'Uncomment the DELETE statement above if the verification looks correct' as instruction;

-- Show final verification (this will show current state since deletion is commented out)
SELECT 'VERIFICATION:' as stage;
SELECT 'Remaining auth.users:' as info, COUNT(*) as count FROM auth.users;
SELECT 'Remaining user_profiles:' as info, COUNT(*) as count FROM user_profiles;

-- Verify no admin users would be affected
SELECT 'Admin users still in auth.users:' as check, COUNT(*) as count
FROM auth.users au
JOIN admin_user_ids aui ON au.id = aui.user_id;

-- Clean up temp table
DROP TABLE admin_user_ids;

COMMIT;

-- INSTRUCTIONS:
-- 1. Run this script first to see the verification output
-- 2. Check that the "ADMIN USERS TO PRESERVE" list shows your admin users
-- 3. Check that "USERS TO BE DELETED" looks correct (should be test users)
-- 4. If everything looks correct, uncomment the DELETE line and run again