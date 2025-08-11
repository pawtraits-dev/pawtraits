-- Create the create_partner_profile function that the app expects
-- This function handles partner creation with proper permissions

CREATE OR REPLACE FUNCTION create_partner_profile(
    p_id UUID,
    p_email TEXT,
    p_first_name TEXT,
    p_last_name TEXT,
    p_phone TEXT DEFAULT NULL,
    p_business_name TEXT DEFAULT NULL,
    p_business_type TEXT DEFAULT NULL,
    p_business_address TEXT DEFAULT NULL,
    p_business_phone TEXT DEFAULT NULL,
    p_business_website TEXT DEFAULT NULL
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
        'pending',  -- Default approval status
        20.00,      -- Default commission rate
        5.00,       -- Default lifetime commission rate
        NOW(),
        NOW()
    ) RETURNING * INTO new_partner;
    
    RETURN new_partner;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_partner_profile TO anon;
GRANT EXECUTE ON FUNCTION create_partner_profile TO authenticated;

SELECT 'Partner creation function added successfully!' as message;