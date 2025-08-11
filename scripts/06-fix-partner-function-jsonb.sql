-- Fix the create_partner_profile function to handle JSONB address column

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
    address_jsonb JSONB;
BEGIN
    -- Convert text address to JSONB format if provided
    IF p_business_address IS NOT NULL AND p_business_address != '' THEN
        address_jsonb := jsonb_build_object('address', p_business_address);
    ELSE
        address_jsonb := NULL;
    END IF;

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
        address_jsonb,  -- Use the converted JSONB
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

-- Check the actual column types for reference
SELECT 
    column_name, 
    data_type, 
    udt_name
FROM information_schema.columns 
WHERE table_name = 'partners' 
AND column_name IN ('business_address', 'commission_rate', 'lifetime_commission_rate')
ORDER BY column_name;

SELECT 'Partner function updated to handle JSONB address!' as message;