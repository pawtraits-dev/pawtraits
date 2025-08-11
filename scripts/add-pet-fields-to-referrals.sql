    -- Add pet fields to referrals table
    -- This allows partners to capture basic pet information when creating referrals

    ALTER TABLE referrals 
    ADD COLUMN IF NOT EXISTS pet_name TEXT,
    ADD COLUMN IF NOT EXISTS pet_breed_id UUID REFERENCES breeds(id),
    ADD COLUMN IF NOT EXISTS pet_coat_id UUID REFERENCES coats(id);

    -- Drop the old function first to avoid overloading conflicts
    DROP FUNCTION IF EXISTS create_referral_for_partner(UUID, TEXT, TEXT, TEXT, TEXT, TEXT);

    -- Create the new function with pet fields
    CREATE OR REPLACE FUNCTION create_referral_for_partner(
        p_partner_id UUID,
        p_referral_code TEXT,
        p_client_name TEXT,
        p_client_email TEXT,
        p_client_phone TEXT DEFAULT NULL,
        p_client_notes TEXT DEFAULT NULL,
        p_pet_name TEXT DEFAULT NULL,
        p_pet_breed_id UUID DEFAULT NULL,
        p_pet_coat_id UUID DEFAULT NULL
    )
    RETURNS referrals
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
        new_referral referrals;
    BEGIN
        INSERT INTO public.referrals (
            partner_id,
            referral_code,
            client_name,
            client_email,
            client_phone,
            client_notes,
            pet_name,
            pet_breed_id,
            pet_coat_id,
            status,
            qr_scans,
            email_opens,
            commission_rate,
            lifetime_commission_rate,
            expires_at,
            created_at,
            updated_at
        ) VALUES (
            p_partner_id,
            p_referral_code,
            p_client_name,
            p_client_email,
            p_client_phone,
            p_client_notes,
            p_pet_name,
            p_pet_breed_id,
            p_pet_coat_id,
            'pending',
            0,
            0,
            20.00,
            5.00,
            NOW() + INTERVAL '30 days',
            NOW(),
            NOW()
        ) RETURNING * INTO new_referral;
        
        RETURN new_referral;
    END;
    $$;