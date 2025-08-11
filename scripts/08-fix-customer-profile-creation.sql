-- Fix customer user_profile creation issues
-- This addresses missing user_profile records during customer signup

-- First, let's check if the user_profiles table has the right structure
SELECT 'USER_PROFILES TABLE STRUCTURE:' as check;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'user_profiles'
ORDER BY ordinal_position;

-- Check RLS policies on user_profiles table
SELECT 'USER_PROFILES RLS POLICIES:' as check;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'user_profiles';

-- Create/update the create_user_profile function that the app might be calling
CREATE OR REPLACE FUNCTION create_user_profile(
    p_user_id UUID,
    p_user_type TEXT,
    p_first_name TEXT DEFAULT NULL,
    p_last_name TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_partner_id UUID DEFAULT NULL,
    p_customer_id UUID DEFAULT NULL
)
RETURNS user_profiles
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_profile user_profiles;
BEGIN
    INSERT INTO public.user_profiles (
        user_id,
        user_type,
        first_name,
        last_name,
        email,
        phone,
        partner_id,
        customer_id,
        status,
        created_at,
        updated_at
    ) VALUES (
        p_user_id,
        p_user_type::user_type_enum,  -- Cast to enum if needed
        p_first_name,
        p_last_name,
        p_email,
        p_phone,
        p_partner_id,
        p_customer_id,
        'active',
        NOW(),
        NOW()
    ) RETURNING * INTO new_profile;
    
    RETURN new_profile;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_user_profile TO anon;
GRANT EXECUTE ON FUNCTION create_user_profile TO authenticated;

-- Ensure the get_user_profile function exists and works
CREATE OR REPLACE FUNCTION get_user_profile(user_uuid UUID DEFAULT NULL)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    user_type TEXT,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    avatar_url TEXT,
    status TEXT,
    permissions TEXT[],
    partner_id UUID,
    customer_id UUID,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    target_user_id UUID;
BEGIN
    -- If no user_uuid provided, get current auth user
    IF user_uuid IS NULL THEN
        target_user_id := auth.uid();
    ELSE
        target_user_id := user_uuid;
    END IF;
    
    -- Return the user profile
    RETURN QUERY
    SELECT 
        up.id,
        up.user_id,
        up.user_type::TEXT,
        up.first_name,
        up.last_name,
        up.email,
        up.phone,
        up.avatar_url,
        up.status::TEXT,
        up.permissions,
        up.partner_id,
        up.customer_id,
        up.created_at,
        up.updated_at
    FROM user_profiles up
    WHERE up.user_id = target_user_id;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_profile TO anon;
GRANT EXECUTE ON FUNCTION get_user_profile TO authenticated;

-- Add RLS policies for user_profiles if they don't exist
-- Policy to allow users to read their own profile
DO $$
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
    DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
    DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
    
    -- Create new policies
    CREATE POLICY "Users can view own profile" ON user_profiles
        FOR SELECT USING (auth.uid() = user_id OR auth.uid() IN (
            SELECT user_id FROM user_profiles WHERE user_type = 'admin'
        ));
    
    CREATE POLICY "Users can insert own profile" ON user_profiles
        FOR INSERT WITH CHECK (auth.uid() = user_id);
    
    CREATE POLICY "Users can update own profile" ON user_profiles
        FOR UPDATE USING (auth.uid() = user_id OR auth.uid() IN (
            SELECT user_id FROM user_profiles WHERE user_type = 'admin'
        ));
        
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'RLS policies already exist or error: %', SQLERRM;
END $$;

-- Enable RLS on user_profiles if not already enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Test the function works
SELECT 'TESTING FUNCTIONS:' as test;
SELECT 'Functions created successfully. Test with a real user_id.' as message;

-- Show current RLS status
SELECT 'RLS STATUS:' as check;
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'user_profiles';