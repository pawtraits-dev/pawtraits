-- Functions to handle referral status transitions

-- Function to mark referral as accessed (when someone visits the referral link)
CREATE OR REPLACE FUNCTION mark_referral_accessed(p_referral_code TEXT)
RETURNS referrals
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    updated_referral referrals;
BEGIN
    UPDATE public.referrals 
    SET 
        status = CASE 
            WHEN status = 'invited' THEN 'accessed'
            ELSE status -- Don't change if already progressed further
        END,
        qr_scans = qr_scans + 1,
        last_viewed_at = NOW(),
        updated_at = NOW()
    WHERE referral_code = UPPER(p_referral_code)
    AND expires_at > NOW()
    RETURNING * INTO updated_referral;
    
    RETURN updated_referral;
END;
$$;

-- Function to mark referral as accepted (when someone creates an account)
CREATE OR REPLACE FUNCTION mark_referral_accepted(p_referral_code TEXT, p_customer_email TEXT)
RETURNS referrals
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    updated_referral referrals;
BEGIN
    UPDATE public.referrals 
    SET 
        status = CASE 
            WHEN status IN ('invited', 'accessed') THEN 'accepted'
            ELSE status -- Don't change if already applied
        END,
        updated_at = NOW()
    WHERE referral_code = UPPER(p_referral_code)
    AND client_email = LOWER(p_customer_email)
    AND expires_at > NOW()
    RETURNING * INTO updated_referral;
    
    RETURN updated_referral;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION mark_referral_accessed TO anon;
GRANT EXECUTE ON FUNCTION mark_referral_accessed TO authenticated;
GRANT EXECUTE ON FUNCTION mark_referral_accepted TO anon;
GRANT EXECUTE ON FUNCTION mark_referral_accepted TO authenticated;