-- Fix the create_partner_profile function
-- First, let's see what exists and then replace it properly

-- Drop any existing versions of the function
DROP FUNCTION IF EXISTS create_partner_profile;
DROP FUNCTION IF EXISTS create_partner_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

-- Create the function with the exact signature the app expects
CREATE OR REPLACE FUNCTION create_partner_profile(
    p_id UUID,
    p_email TEXT,
    p_first_name TEXT,
    p_last_name TEXT,
    p_phone TEXT,
    p_business_name TEXT,
    p_business_type TEXT,
    p_business_address TEXT,
    p_business_phone TEXT,
    p_business_website TEXT
)
RETURNS partners
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
        approval_status,
        commission_rate,
        lifetime_commission_rate,
        created_at,
        updated_at
    ) VALUES (
        p_id,
        p_email,
        p_first_name,
        p_last_name,
        p_phone,
        p_business_name,
        p_business_type,
        p_business_address,
        p_business_phone,
        p_business_website,
        'pending',
        20.00,
        5.00,
        NOW(),
        NOW()
    ) RETURNING * INTO new_partner;
    
    RETURN new_partner;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_partner_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION create_partner_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

SELECT 'Partner creation function updated successfully!' as message;