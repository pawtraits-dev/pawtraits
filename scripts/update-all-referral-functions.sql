-- Complete database function update script for referrals with separate first/last names
-- Run this after the database migration to update all referral functions

BEGIN;

-- Drop existing function to avoid conflicts
DROP FUNCTION IF EXISTS create_referral_for_partner CASCADE;

-- Create updated referral creation function
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

-- Grant permissions for all functions
GRANT EXECUTE ON FUNCTION create_referral_for_partner TO anon;
GRANT EXECUTE ON FUNCTION create_referral_for_partner TO authenticated;
GRANT EXECUTE ON FUNCTION update_method2_referral_customer TO anon;
GRANT EXECUTE ON FUNCTION update_method2_referral_customer TO authenticated;
GRANT EXECUTE ON FUNCTION mark_referral_accepted_enhanced TO anon;
GRANT EXECUTE ON FUNCTION mark_referral_accepted_enhanced TO authenticated;

SELECT 'All referral functions updated successfully!' as result;

COMMIT;