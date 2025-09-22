-- Update create_partner_profile function to auto-approve partners
-- Set is_verified to true and approval_status to 'approved'

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
        p_business_type::public.partners_business_type_check,
        p_business_address,
        p_business_phone,
        p_business_website,
        true,        -- is_active
        true,        -- is_verified (auto-approve)
        false,       -- onboarding_completed
        'approved',  -- approval_status (auto-approve)
        jsonb_build_object(
            'email_commissions', true,
            'email_referrals', true,
            'sms_enabled', false
        ),
        0.20,        -- 20% commission_rate
        0.05,        -- 5% lifetime_commission_rate
        NOW(),
        NOW()
    ) RETURNING * INTO new_partner;

    RETURN new_partner;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to create partner profile: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_partner_profile TO anon;
GRANT EXECUTE ON FUNCTION create_partner_profile TO authenticated;

SELECT 'Partner creation function updated for auto-approval!' as message;