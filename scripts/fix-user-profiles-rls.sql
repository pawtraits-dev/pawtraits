-- Fix infinite recursion in user_profiles RLS policies
-- The issue is likely that the policy is trying to reference user_profiles from within user_profiles

-- Drop all existing policies on user_profiles
DROP POLICY IF EXISTS "Users can view own user_profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own user_profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own user_profile" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete_policy" ON user_profiles;

-- Create simple, non-recursive policies
-- Allow users to read their own profile
CREATE POLICY "user_profiles_select_own" ON user_profiles
    FOR SELECT
    USING (auth.uid() = user_id);

-- Allow users to update their own profile  
CREATE POLICY "user_profiles_update_own" ON user_profiles
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Allow users to insert their own profile (for signup)
CREATE POLICY "user_profiles_insert_own" ON user_profiles
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Allow service role full access (for admin functions)
CREATE POLICY "user_profiles_service_role_all" ON user_profiles
    FOR ALL
    USING (current_setting('role') = 'service_role')
    WITH CHECK (current_setting('role') = 'service_role');

-- Ensure RLS is enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

SELECT 'RLS policies fixed for user_profiles table' as result;