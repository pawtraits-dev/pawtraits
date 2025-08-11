-- Correct mapping of existing statuses to new system

-- Step 1: Create backup
CREATE TABLE IF NOT EXISTS referral_status_backup AS 
SELECT id, status, created_at, qr_scans, email_opens, last_viewed_at FROM referrals;

-- Step 2: Drop the existing constraint FIRST
ALTER TABLE referrals 
DROP CONSTRAINT IF EXISTS referrals_status_check;

-- Step 3: Update with correct status mapping based on referral activity
UPDATE referrals 
SET status = CASE 
    -- If they have QR scans or email opens or last_viewed_at, they've been accessed
    WHEN (qr_scans > 0 OR email_opens > 0 OR last_viewed_at IS NOT NULL) THEN 'accessed'
    -- If it's just pending with no activity, it's invited
    WHEN status = 'pending' THEN 'invited'
    -- For any other old statuses, map them appropriately
    WHEN status = 'viewed' THEN 'accessed'
    WHEN status = 'clicked' THEN 'accessed' 
    WHEN status = 'purchased' THEN 'applied'
    WHEN status = 'converted' THEN 'applied'
    -- Default fallback
    ELSE 'invited'
END;

-- Step 4: Add the new constraint with all allowed values
ALTER TABLE referrals 
ADD CONSTRAINT referrals_status_check 
CHECK (status = ANY (ARRAY['invited'::text, 'accessed'::text, 'accepted'::text, 'applied'::text, 'expired'::text]));

-- Step 5: Update the create_referral_for_partner function
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
        'invited',
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_referral_for_partner TO anon;
GRANT EXECUTE ON FUNCTION create_referral_for_partner TO authenticated;

-- Verify the migration with detailed breakdown
SELECT 'Migration completed! New status distribution:' as message;
SELECT 
    status, 
    COUNT(*) as count,
    COUNT(CASE WHEN qr_scans > 0 THEN 1 END) as with_qr_scans,
    COUNT(CASE WHEN email_opens > 0 THEN 1 END) as with_email_opens,
    COUNT(CASE WHEN last_viewed_at IS NOT NULL THEN 1 END) as with_last_viewed
FROM referrals 
GROUP BY status 
ORDER BY status;