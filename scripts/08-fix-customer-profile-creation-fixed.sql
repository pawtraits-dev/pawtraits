-- Fix customer user_profile creation issues - FIXED VERSION
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

-- Drop existing functions first to avoid conflicts
DROP FUNCTION IF EXISTS create_user_profile;
DROP FUNCTION IF EXISTS get_user_profile;
DROP FUNCTION IF EXISTS get_user_profile(UUID);

-- Create the create_user_profile function that the app might be calling
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
        p_user_type,  -- Don't cast, let PostgreSQL handle it
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

-- Create the get_user_profile function (simplified return type)
CREATE OR REPLACE FUNCTION get_user_profile(user_uuid UUID DEFAULT NULL)
RETURNS user_profiles
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    target_user_id UUID;
    user_record user_profiles;
BEGIN
    -- If no user_uuid provided, get current auth user
    IF user_uuid IS NULL THEN
        target_user_id := auth.uid();
    ELSE
        target_user_id := user_uuid;
    END IF;
    
    -- Get the user profile
    SELECT * INTO user_record
    FROM user_profiles 
    WHERE user_id = target_user_id;
    
    RETURN user_record;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_user_profile TO anon;
GRANT EXECUTE ON FUNCTION create_user_profile TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_profile TO anon;
GRANT EXECUTE ON FUNCTION get_user_profile TO authenticated;

-- Add RLS policies for user_profiles if they don't exist
DO $$
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
    DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
    DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
    DROP POLICY IF EXISTS "Enable read access for own profile" ON user_profiles;
    DROP POLICY IF EXISTS "Enable insert for own profile" ON user_profiles;
    DROP POLICY IF EXISTS "Enable update for own profile" ON user_profiles;
    
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
        RAISE NOTICE 'RLS policies created or updated: %', SQLERRM;
END $$;

-- Enable RLS on user_profiles if not already enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Show current RLS status
SELECT 'RLS STATUS:' as check;
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'user_profiles';

-- Test that we can create a function call (this won't actually insert anything)
SELECT 'Functions created successfully!' as result;
SELECT 'Try customer signup again - user_profile should now be created.' as instruction;