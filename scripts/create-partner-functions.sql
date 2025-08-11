-- Create function to handle partner profile creation with proper permissions
CREATE OR REPLACE FUNCTION create_partner_profile(
    p_id UUID,
    p_email TEXT,
    p_first_name TEXT,
    p_last_name TEXT,
    p_phone TEXT DEFAULT NULL,
    p_business_name TEXT DEFAULT NULL,
    p_business_type TEXT DEFAULT NULL,
    p_business_address JSONB DEFAULT NULL,
    p_business_phone TEXT DEFAULT NULL,
    p_business_website TEXT DEFAULT NULL
) RETURNS partners AS $$
DECLARE
    new_partner partners;
BEGIN
    INSERT INTO public.partners (
        id,
        email,
        first_name,
        last_name,
        phone,
        business_name,
        business_type,
        business_address,
        business_phone,
        business_website,
        is_active,
        is_verified,
        onboarding_completed,
        approval_status,
        notification_preferences,
        created_at,
        updated_at
    ) VALUES (
        p_id,
        p_email,
        p_first_name,
        p_last_name,
        p_phone,
        p_business_name,
        p_business_type::public.partners_business_type_check,
        p_business_address,
        p_business_phone,
        p_business_website,
        true,
        false,
        false,
        'pending',
        jsonb_build_object(
            'email_commissions', true,
            'email_referrals', true,
            'sms_enabled', false
        ),
        now(),
        now()
    ) RETURNING * INTO new_partner;
    
    RETURN new_partner;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions for the function
GRANT EXECUTE ON FUNCTION create_partner_profile TO anon;
GRANT EXECUTE ON FUNCTION create_partner_profile TO authenticated;

-- Create RLS policies for partners table if they don't exist
DO $$ 
BEGIN
    -- Allow users to insert their own partner record
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'partners' 
        AND policyname = 'Users can create their own partner profile'
    ) THEN
        CREATE POLICY "Users can create their own partner profile"
        ON public.partners FOR INSERT
        TO authenticated
        WITH CHECK (auth.uid() = id);
    END IF;

    -- Allow users to read their own partner record
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'partners' 
        AND policyname = 'Users can read their own partner profile'
    ) THEN
        CREATE POLICY "Users can read their own partner profile"
        ON public.partners FOR SELECT
        TO authenticated
        USING (auth.uid() = id);
    END IF;

    -- Allow users to update their own partner record
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'partners' 
        AND policyname = 'Users can update their own partner profile'
    ) THEN
        CREATE POLICY "Users can update their own partner profile"
        ON public.partners FOR UPDATE
        TO authenticated
        USING (auth.uid() = id)
        WITH CHECK (auth.uid() = id);
    END IF;
END $$;

-- Enable RLS on partners table if not already enabled
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

COMMENT ON FUNCTION create_partner_profile IS 'Creates a partner profile with proper permissions during signup process';