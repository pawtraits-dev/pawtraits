-- Updated referrals table with separate first and last names
-- Run this after clearing the database

CREATE TABLE IF NOT EXISTS referrals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    referral_code TEXT NOT NULL UNIQUE,
    
    -- Client information (separate first/last names)
    client_first_name TEXT,
    client_last_name TEXT, 
    client_email TEXT,
    client_phone TEXT,
    client_notes TEXT,
    
    -- Pet information
    pet_name TEXT,
    pet_breed_id UUID REFERENCES breeds(id),
    pet_coat_id UUID REFERENCES coats(id),
    
    -- Method 2 referrals (image sharing)
    image_id UUID REFERENCES image_catalog(id),
    referral_type TEXT DEFAULT 'traditional',
    
    -- Referral tracking
    status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'accessed', 'accepted', 'applied')),
    qr_code_url TEXT,
    qr_scans INTEGER DEFAULT 0,
    email_opens INTEGER DEFAULT 0,
    last_viewed_at TIMESTAMP WITH TIME ZONE,
    
    -- Commission and orders
    commission_rate DECIMAL(5,2) DEFAULT 20.00,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add referral_type column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'referrals' AND column_name = 'referral_type'
    ) THEN
        ALTER TABLE referrals ADD COLUMN referral_type TEXT DEFAULT 'traditional';
    END IF;
END $$;

-- Add image_id column if it doesn't exist  
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'referrals' AND column_name = 'image_id'
    ) THEN
        ALTER TABLE referrals ADD COLUMN image_id UUID REFERENCES image_catalog(id);
    END IF;
END $$;

-- Add client_first_name column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'referrals' AND column_name = 'client_first_name'
    ) THEN
        ALTER TABLE referrals ADD COLUMN client_first_name TEXT;
    END IF;
END $$;

-- Add client_last_name column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'referrals' AND column_name = 'client_last_name'
    ) THEN
        ALTER TABLE referrals ADD COLUMN client_last_name TEXT;
    END IF;
END $$;

-- Add CHECK constraints if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'referrals_type_check'
    ) THEN
        ALTER TABLE referrals ADD CONSTRAINT referrals_type_check 
            CHECK (referral_type IN ('traditional', 'image_share'));
    END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_referrals_partner_id ON referrals(partner_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_email ON referrals(client_email);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_referrals_type ON referrals(referral_type);

-- Row Level Security
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Partners can see their own referrals
CREATE POLICY "Partners can view own referrals" ON referrals
    FOR SELECT USING (partner_id = auth.uid());

CREATE POLICY "Partners can create own referrals" ON referrals
    FOR INSERT WITH CHECK (partner_id = auth.uid());

CREATE POLICY "Partners can update own referrals" ON referrals
    FOR UPDATE USING (partner_id = auth.uid());

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON referrals TO authenticated;
GRANT SELECT, INSERT, UPDATE ON referrals TO anon;