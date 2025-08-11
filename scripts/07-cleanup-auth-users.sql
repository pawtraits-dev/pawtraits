-- Clean up orphaned auth.users records
-- This removes auth users that don't have corresponding user_profiles (except admins)

-- IMPORTANT: This script requires SUPABASE SERVICE ROLE permissions
-- You may need to run this through the Supabase SQL Editor or with service role credentials

BEGIN;

-- First, let's see what we're working with
SELECT 'Current auth.users count:' as info, COUNT(*) as count FROM auth.users;
SELECT 'Current user_profiles count:' as info, COUNT(*) as count FROM user_profiles;

-- Get admin user IDs to preserve
CREATE TEMP TABLE admin_user_ids AS 
SELECT user_id FROM user_profiles WHERE user_type = 'admin';

-- Show how many admin vs non-admin auth users we have
SELECT 
    CASE 
        WHEN id IN (SELECT user_id FROM admin_user_ids) THEN 'admin'
        ELSE 'non-admin'
    END as user_type,
    COUNT(*) as count
FROM auth.users
GROUP BY CASE 
        WHEN id IN (SELECT user_id FROM admin_user_ids) THEN 'admin'
        ELSE 'non-admin'
    END;

-- Delete orphaned auth users (non-admins that don't have user_profiles)
DELETE FROM auth.users 
WHERE id NOT IN (SELECT user_id FROM admin_user_ids);

-- Show final counts
SELECT 'After cleanup - auth.users count:' as info, COUNT(*) as count FROM auth.users;
SELECT 'After cleanup - user_profiles count:' as info, COUNT(*) as count FROM user_profiles;

-- Verify all remaining auth users have corresponding user_profiles
SELECT 'Orphaned auth users remaining:' as check, COUNT(*) as count
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.user_id
WHERE up.user_id IS NULL;

-- Clean up temp table
DROP TABLE admin_user_ids;

SELECT 'Auth users cleanup completed!' as message;

COMMIT;