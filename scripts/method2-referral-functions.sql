-- Functions to handle Method 2 (image sharing) referral updates

-- Function to update Method 2 referral with actual customer details when they sign up
CREATE OR REPLACE FUNCTION update_method2_referral_customer(
    p_referral_code TEXT,
    p_customer_email TEXT,
    p_customer_name TEXT,
    p_customer_phone TEXT DEFAULT NULL
)
RETURNS referrals
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    updated_referral referrals;
BEGIN
    -- Update Method 2 referrals (image_share type) with actual customer details
    UPDATE public.referrals 
    SET 
        client_email = LOWER(p_customer_email),
        client_first_name = SPLIT_PART(p_customer_name, ' ', 1),
        client_last_name = SUBSTRING(p_customer_name FROM POSITION(' ' IN p_customer_name) + 1),
        client_phone = p_customer_phone,
        status = CASE 
            WHEN status IN ('invited', 'accessed') THEN 'accepted'
            ELSE status -- Don't change if already applied
        END,
        updated_at = NOW()
    WHERE referral_code = UPPER(p_referral_code)
    AND referral_type = 'image_share'
    AND expires_at > NOW()
    AND (client_email IS NULL OR client_email = '')
    RETURNING * INTO updated_referral;
    
    RETURN updated_referral;
END;
$$;

-- Enhanced version of mark_referral_accepted that handles both Method 1 and Method 2
CREATE OR REPLACE FUNCTION mark_referral_accepted_enhanced(
    p_referral_code TEXT, 
    p_customer_email TEXT,
    p_customer_name TEXT DEFAULT NULL,
    p_customer_phone TEXT DEFAULT NULL
)
RETURNS referrals
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    updated_referral referrals;
    referral_type_check TEXT;
BEGIN
    -- First, check the referral type
    SELECT referral_type INTO referral_type_check
    FROM public.referrals 
    WHERE referral_code = UPPER(p_referral_code)
    AND expires_at > NOW();
    
    IF referral_type_check = 'image_share' THEN
        -- Method 2: Update with customer details (client_email might be empty)
        UPDATE public.referrals 
        SET 
            client_email = LOWER(p_customer_email),
            client_first_name = COALESCE(SPLIT_PART(p_customer_name, ' ', 1), client_first_name),
            client_last_name = COALESCE(SUBSTRING(p_customer_name FROM POSITION(' ' IN p_customer_name) + 1), client_last_name),
            client_phone = COALESCE(p_customer_phone, client_phone),
            status = CASE 
                WHEN status IN ('invited', 'accessed') THEN 'accepted'
                ELSE status
            END,
            updated_at = NOW()
        WHERE referral_code = UPPER(p_referral_code)
        AND expires_at > NOW()
        RETURNING * INTO updated_referral;
    ELSE
        -- Method 1: Original logic requiring email match
        UPDATE public.referrals 
        SET 
            status = CASE 
                WHEN status IN ('invited', 'accessed') THEN 'accepted'
                ELSE status
            END,
            updated_at = NOW()
        WHERE referral_code = UPPER(p_referral_code)
        AND client_email = LOWER(p_customer_email)
        AND expires_at > NOW()
        RETURNING * INTO updated_referral;
    END IF;
    
    RETURN updated_referral;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION update_method2_referral_customer TO anon;
GRANT EXECUTE ON FUNCTION update_method2_referral_customer TO authenticated;
GRANT EXECUTE ON FUNCTION mark_referral_accepted_enhanced TO anon;
GRANT EXECUTE ON FUNCTION mark_referral_accepted_enhanced TO authenticated;