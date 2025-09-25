-- Influencer System Database Migration
-- Adds influencer user type and related tables to support influencer management
-- Run in Supabase SQL Editor

-- ===========================================
-- PART 1: INFLUENCERS TABLE
-- ===========================================

-- Create influencers table
CREATE TABLE IF NOT EXISTS influencers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    username TEXT UNIQUE, -- Social media handle
    bio TEXT,
    avatar_url TEXT,
    phone TEXT,
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    commission_rate NUMERIC DEFAULT 10.00, -- 10% lifetime commission
    payment_method TEXT CHECK (payment_method = ANY (ARRAY['paypal'::text, 'bank_transfer'::text])),
    payment_details JSONB,
    notification_preferences JSONB DEFAULT '{"email_referrals": true, "email_commissions": true}'::jsonb,
    approval_status TEXT DEFAULT 'pending'::text CHECK (approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'suspended'::text])),
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for influencers
CREATE INDEX IF NOT EXISTS idx_influencers_email ON influencers(email);
CREATE INDEX IF NOT EXISTS idx_influencers_username ON influencers(username);
CREATE INDEX IF NOT EXISTS idx_influencers_status ON influencers(approval_status);
CREATE INDEX IF NOT EXISTS idx_influencers_active ON influencers(is_active);

-- ===========================================
-- PART 2: SOCIAL CHANNELS TABLE
-- ===========================================

-- Create social channels tracking table
CREATE TABLE IF NOT EXISTS influencer_social_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform = ANY (ARRAY['instagram'::text, 'tiktok'::text, 'youtube'::text, 'twitter'::text, 'facebook'::text, 'linkedin'::text, 'pinterest'::text])),
    username TEXT NOT NULL,
    profile_url TEXT,
    follower_count INTEGER DEFAULT 0,
    engagement_rate NUMERIC DEFAULT 0.0,
    verified BOOLEAN DEFAULT false,
    is_primary BOOLEAN DEFAULT false, -- Mark one channel as primary
    is_active BOOLEAN DEFAULT true,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(influencer_id, platform) -- One account per platform per influencer
);

-- Add indexes for social channels
CREATE INDEX IF NOT EXISTS idx_social_channels_influencer_id ON influencer_social_channels(influencer_id);
CREATE INDEX IF NOT EXISTS idx_social_channels_platform ON influencer_social_channels(platform);
CREATE INDEX IF NOT EXISTS idx_social_channels_primary ON influencer_social_channels(is_primary, is_active);

-- ===========================================
-- PART 3: INFLUENCER REFERRAL CODES TABLE
-- ===========================================

-- Create influencer referral codes table
CREATE TABLE IF NOT EXISTS influencer_referral_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
    code TEXT UNIQUE NOT NULL CHECK (length(code) >= 6),
    qr_code_url TEXT,
    description TEXT, -- What this code is for
    usage_count INTEGER DEFAULT 0,
    conversion_count INTEGER DEFAULT 0,
    total_revenue NUMERIC DEFAULT 0,
    total_commission NUMERIC DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for referral codes
CREATE INDEX IF NOT EXISTS idx_influencer_codes_influencer_id ON influencer_referral_codes(influencer_id);
CREATE INDEX IF NOT EXISTS idx_influencer_codes_code ON influencer_referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_influencer_codes_active ON influencer_referral_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_influencer_codes_expires ON influencer_referral_codes(expires_at);

-- ===========================================
-- PART 4: INFLUENCER REFERRAL TRACKING TABLE
-- ===========================================

-- Create table to track individual referrals made by influencers
CREATE TABLE IF NOT EXISTS influencer_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    influencer_id UUID NOT NULL REFERENCES influencers(id),
    referral_code_id UUID NOT NULL REFERENCES influencer_referral_codes(id),
    customer_id UUID REFERENCES customers(id),
    customer_email TEXT,
    status TEXT DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'accessed'::text, 'signed_up'::text, 'purchased'::text, 'credited'::text, 'expired'::text])),
    order_id UUID REFERENCES orders(id),
    order_value NUMERIC,
    commission_amount NUMERIC,
    commission_paid BOOLEAN DEFAULT false,
    source_platform TEXT, -- Which social platform the referral came from
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    accessed_at TIMESTAMP WITH TIME ZONE,
    signed_up_at TIMESTAMP WITH TIME ZONE,
    purchased_at TIMESTAMP WITH TIME ZONE,
    credited_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '90 days'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for influencer referrals
CREATE INDEX IF NOT EXISTS idx_influencer_referrals_influencer_id ON influencer_referrals(influencer_id);
CREATE INDEX IF NOT EXISTS idx_influencer_referrals_code_id ON influencer_referrals(referral_code_id);
CREATE INDEX IF NOT EXISTS idx_influencer_referrals_customer_id ON influencer_referrals(customer_id);
CREATE INDEX IF NOT EXISTS idx_influencer_referrals_status ON influencer_referrals(status);
CREATE INDEX IF NOT EXISTS idx_influencer_referrals_platform ON influencer_referrals(source_platform);
CREATE INDEX IF NOT EXISTS idx_influencer_referrals_order_id ON influencer_referrals(order_id);

-- ===========================================
-- PART 5: EXTEND USER PROFILES TABLE
-- ===========================================

-- Add influencer_id to user_profiles if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='user_profiles' AND column_name='influencer_id') THEN
        ALTER TABLE user_profiles ADD COLUMN influencer_id UUID REFERENCES influencers(id);
        CREATE INDEX IF NOT EXISTS idx_user_profiles_influencer_id ON user_profiles(influencer_id);
    END IF;
END $$;

-- Update user_type check constraint to include influencer
DO $$
BEGIN
    -- Drop existing constraint
    ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_user_type_check;

    -- Add new constraint with influencer
    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_user_type_check
        CHECK (user_type = ANY (ARRAY['admin'::text, 'partner'::text, 'customer'::text, 'influencer'::text]));
END $$;

-- ===========================================
-- PART 6: ROW LEVEL SECURITY POLICIES
-- ===========================================

-- Enable RLS on new tables
ALTER TABLE influencers ENABLE ROW LEVEL SECURITY;
ALTER TABLE influencer_social_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE influencer_referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE influencer_referrals ENABLE ROW LEVEL SECURITY;

-- Policies for influencers table
CREATE POLICY "Admin can manage all influencers" ON influencers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_id = auth.uid() AND user_type = 'admin'
        )
    );

CREATE POLICY "Influencers can view/update their own data" ON influencers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_id = auth.uid()
            AND user_type = 'influencer'
            AND influencer_id = influencers.id
        )
    );

-- Policies for social channels
CREATE POLICY "Admin can manage all social channels" ON influencer_social_channels
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_id = auth.uid() AND user_type = 'admin'
        )
    );

CREATE POLICY "Influencers can manage their social channels" ON influencer_social_channels
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_id = auth.uid()
            AND user_type = 'influencer'
            AND influencer_id = influencer_social_channels.influencer_id
        )
    );

-- Policies for referral codes
CREATE POLICY "Admin can manage all influencer codes" ON influencer_referral_codes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_id = auth.uid() AND user_type = 'admin'
        )
    );

CREATE POLICY "Influencers can manage their codes" ON influencer_referral_codes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_id = auth.uid()
            AND user_type = 'influencer'
            AND influencer_id = influencer_referral_codes.influencer_id
        )
    );

-- Policies for referral tracking
CREATE POLICY "Admin can view all influencer referrals" ON influencer_referrals
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_id = auth.uid() AND user_type = 'admin'
        )
    );

CREATE POLICY "Influencers can view their referrals" ON influencer_referrals
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_id = auth.uid()
            AND user_type = 'influencer'
            AND influencer_id = influencer_referrals.influencer_id
        )
    );

-- ===========================================
-- PART 7: UPDATE TRIGGERS
-- ===========================================

-- Create trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at columns
DROP TRIGGER IF EXISTS update_influencers_updated_at ON influencers;
CREATE TRIGGER update_influencers_updated_at
    BEFORE UPDATE ON influencers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_influencer_referral_codes_updated_at ON influencer_referral_codes;
CREATE TRIGGER update_influencer_referral_codes_updated_at
    BEFORE UPDATE ON influencer_referral_codes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_influencer_referrals_updated_at ON influencer_referrals;
CREATE TRIGGER update_influencer_referrals_updated_at
    BEFORE UPDATE ON influencer_referrals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- PART 8: TEST DATA FUNCTIONS
-- ===========================================

-- Function to create test influencers with standardized emails
CREATE OR REPLACE FUNCTION create_test_influencers()
RETURNS void AS $$
DECLARE
    i INTEGER;
    influencer_id UUID;
    user_id UUID;
BEGIN
    -- Create test influencers I-001 through I-009
    FOR i IN 1..9 LOOP
        -- Insert influencer
        INSERT INTO influencers (
            email,
            first_name,
            last_name,
            username,
            bio,
            commission_rate,
            approval_status,
            is_active
        ) VALUES (
            'I-' || LPAD(i::text, 3, '0') || '@atemporal.co.uk',
            'Influencer',
            'Test' || i,
            'influencer_test_' || i,
            'Test influencer #' || i || ' for system validation',
            10.00,
            'approved',
            true
        ) RETURNING id INTO influencer_id;

        -- Note: User creation would typically be handled by Supabase Auth
        -- This is just for database structure validation

        RAISE NOTICE 'Created test influencer I-%: %', LPAD(i::text, 3, '0'), influencer_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- SUCCESS MESSAGE
-- ===========================================

DO $$
BEGIN
    RAISE NOTICE '✅ Influencer System Migration completed successfully!';
    RAISE NOTICE '📋 New tables created:';
    RAISE NOTICE '   - influencers (main influencer data)';
    RAISE NOTICE '   - influencer_social_channels (social media tracking)';
    RAISE NOTICE '   - influencer_referral_codes (referral code management)';
    RAISE NOTICE '   - influencer_referrals (referral tracking)';
    RAISE NOTICE '🔄 Extended existing tables:';
    RAISE NOTICE '   - user_profiles (added influencer_id, updated user_type constraint)';
    RAISE NOTICE '🔒 RLS policies enabled on all new tables';
    RAISE NOTICE '⚡ Performance indexes and triggers created';
    RAISE NOTICE '🧪 Test data function available: SELECT create_test_influencers();';
    RAISE NOTICE '';
    RAISE NOTICE '➡️  Next: Implement API endpoints for influencer management';
END $$;