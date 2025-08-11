-- Database function to create partner (bypasses RLS)
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
) RETURNS partners
LANGUAGE plpgsql
SECURITY DEFINER -- This runs with elevated privileges
AS $$
DECLARE
    result partners;
    has_approval_status BOOLEAN;
BEGIN
    -- Check if approval_status column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'partners' AND column_name = 'approval_status'
    ) INTO has_approval_status;
    
    -- Insert the partner record with conditional approval_status
    IF has_approval_status THEN
        INSERT INTO partners (
            id, email, first_name, last_name, phone, business_name, business_type,
            business_address, business_phone, business_website, is_active, is_verified,
            onboarding_completed, approval_status, notification_preferences
        ) VALUES (
            p_id, p_email, p_first_name, p_last_name, p_phone, p_business_name, p_business_type,
            p_business_address, p_business_phone, p_business_website, true, false,
            false, 'pending', '{"email_commissions": true, "email_referrals": true, "sms_enabled": false}'::jsonb
        ) RETURNING * INTO result;
    ELSE
        INSERT INTO partners (
            id, email, first_name, last_name, phone, business_name, business_type,
            business_address, business_phone, business_website, is_active, is_verified,
            onboarding_completed, notification_preferences
        ) VALUES (
            p_id, p_email, p_first_name, p_last_name, p_phone, p_business_name, p_business_type,
            p_business_address, p_business_phone, p_business_website, true, false,
            false, '{"email_commissions": true, "email_referrals": true, "sms_enabled": false}'::jsonb
        ) RETURNING * INTO result;
    END IF;
    
    RETURN result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_partner_profile TO authenticated;
GRANT EXECUTE ON FUNCTION create_partner_profile TO anon;

-- Success message
SELECT 'Partner creation function installed successfully!' as status;