-- Create function to handle referral creation with proper permissions
CREATE OR REPLACE FUNCTION create_referral_for_partner(
    p_partner_id UUID,
    p_referral_code TEXT,
    p_client_name TEXT,
    p_client_email TEXT,
    p_client_phone TEXT DEFAULT NULL,
    p_client_notes TEXT DEFAULT NULL
) RETURNS referrals AS $$
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
        'pending',
        0,
        0,
        20.00,
        5.00,
        now() + interval '30 days',
        now(),
        now()
    ) RETURNING * INTO new_referral;
    
    RETURN new_referral;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions for the function
GRANT EXECUTE ON FUNCTION create_referral_for_partner TO anon;
GRANT EXECUTE ON FUNCTION create_referral_for_partner TO authenticated;

-- Create RLS policies for referrals table if they don't exist
DO $$ 
BEGIN
    -- Allow authenticated users to read their own referrals
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'referrals' 
        AND policyname = 'Partners can read their own referrals'
    ) THEN
        CREATE POLICY "Partners can read their own referrals"
        ON public.referrals FOR SELECT
        TO authenticated
        USING (partner_id = auth.uid());
    END IF;

    -- Allow authenticated users to update their own referrals
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'referrals' 
        AND policyname = 'Partners can update their own referrals'
    ) THEN
        CREATE POLICY "Partners can update their own referrals"
        ON public.referrals FOR UPDATE
        TO authenticated
        USING (partner_id = auth.uid())
        WITH CHECK (partner_id = auth.uid());
    END IF;

    -- Note: We don't create an INSERT policy because we use the function instead
END $$;

-- Enable RLS on referrals table if not already enabled
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Create function to update referral (for QR code URL updates)
CREATE OR REPLACE FUNCTION update_referral_qr_code(
    p_referral_id UUID,
    p_qr_code_url TEXT
) RETURNS referrals AS $$
DECLARE
    updated_referral referrals;
BEGIN
    UPDATE public.referrals 
    SET 
        qr_code_url = p_qr_code_url,
        updated_at = now()
    WHERE id = p_referral_id
    RETURNING * INTO updated_referral;
    
    RETURN updated_referral;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions for the update function
GRANT EXECUTE ON FUNCTION update_referral_qr_code TO anon;
GRANT EXECUTE ON FUNCTION update_referral_qr_code TO authenticated;

COMMENT ON FUNCTION create_referral_for_partner IS 'Creates a referral with proper permissions, bypassing RLS';
COMMENT ON FUNCTION update_referral_qr_code IS 'Updates referral QR code URL with proper permissions';