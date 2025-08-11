-- Update the referral creation function to handle separate first/last names

CREATE OR REPLACE FUNCTION create_referral_for_partner(
    p_partner_id UUID,
    p_referral_code TEXT,
    p_client_first_name TEXT,
    p_client_last_name TEXT,
    p_client_email TEXT,
    p_client_phone TEXT DEFAULT NULL,
    p_client_notes TEXT DEFAULT NULL,
    p_pet_name TEXT DEFAULT NULL,
    p_pet_breed_id UUID DEFAULT NULL,
    p_pet_coat_id UUID DEFAULT NULL,
    p_image_id UUID DEFAULT NULL,
    p_referral_type TEXT DEFAULT 'traditional'
)
RETURNS referrals
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_referral referrals;
BEGIN
    -- Set expiration to 30 days from now
    INSERT INTO referrals (
        partner_id,
        referral_code,
        client_first_name,
        client_last_name,
        client_email,
        client_phone,
        client_notes,
        pet_name,
        pet_breed_id,
        pet_coat_id,
        image_id,
        referral_type,
        status,
        expires_at,
        created_at,
        updated_at
    ) VALUES (
        p_partner_id,
        p_referral_code,
        p_client_first_name,
        p_client_last_name,
        p_client_email,
        p_client_phone,
        p_client_notes,
        p_pet_name,
        p_pet_breed_id,
        p_pet_coat_id,
        p_image_id,
        p_referral_type,
        'invited', -- Initial status
        NOW() + INTERVAL '30 days', -- 30 day expiration
        NOW(),
        NOW()
    ) RETURNING * INTO new_referral;
    
    RETURN new_referral;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_referral_for_partner TO anon;
GRANT EXECUTE ON FUNCTION create_referral_for_partner TO authenticated;