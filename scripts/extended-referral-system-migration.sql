-- Extended Referral System Migration
-- This script implements the pre-registration system and customer referral system
-- Run in Supabase SQL Editor

-- ===========================================
-- PART 1: PRE-REGISTRATION CODES TABLE
-- ===========================================

-- Create pre_registration_codes table for partner acquisition
CREATE TABLE IF NOT EXISTS pre_registration_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'deactivated')),
    business_category VARCHAR(100),
    expiration_date TIMESTAMP WITH TIME ZONE,
    marketing_campaign VARCHAR(255),
    notes TEXT,
    print_quantity INTEGER DEFAULT 1,
    qr_code_url TEXT,
    qr_code_data JSONB, -- Store QR code metadata
    partner_id UUID REFERENCES partners(id), -- Set when code is used
    admin_id UUID, -- Who created the code
    scans_count INTEGER DEFAULT 0,
    conversions_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for pre_registration_codes
CREATE INDEX IF NOT EXISTS idx_pre_registration_codes_code ON pre_registration_codes(code);
CREATE INDEX IF NOT EXISTS idx_pre_registration_codes_status ON pre_registration_codes(status);
CREATE INDEX IF NOT EXISTS idx_pre_registration_codes_partner_id ON pre_registration_codes(partner_id);
CREATE INDEX IF NOT EXISTS idx_pre_registration_codes_campaign ON pre_registration_codes(marketing_campaign);

-- ===========================================
-- PART 2: CUSTOMER REFERRAL SYSTEM TABLES
-- ===========================================

-- Create customer_referrals table for customer-to-customer referrals
CREATE TABLE IF NOT EXISTS customer_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_customer_id UUID NOT NULL REFERENCES customers(id), -- Customer who made the referral
    referee_customer_id UUID REFERENCES customers(id), -- Customer who was referred (null until they sign up)
    referral_code VARCHAR(50) UNIQUE NOT NULL,
    referee_email VARCHAR(255), -- Email of person being referred
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accessed', 'signed_up', 'purchased', 'credited', 'expired')),
    discount_amount INTEGER, -- Discount amount in cents for referee (20% of first order)
    credit_amount INTEGER, -- Credit amount in cents earned by referrer
    order_id UUID REFERENCES orders(id), -- Order where referral was applied
    order_value INTEGER, -- Value of the order that triggered the referral
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '90 days'),
    accessed_at TIMESTAMP WITH TIME ZONE, -- When referee first visited the link
    signed_up_at TIMESTAMP WITH TIME ZONE, -- When referee created account
    purchased_at TIMESTAMP WITH TIME ZONE, -- When referee made first purchase
    credited_at TIMESTAMP WITH TIME ZONE, -- When referrer received credit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for customer_referrals
CREATE INDEX IF NOT EXISTS idx_customer_referrals_code ON customer_referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_customer_referrals_referrer ON customer_referrals(referrer_customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_referrals_referee ON customer_referrals(referee_customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_referrals_status ON customer_referrals(status);
CREATE INDEX IF NOT EXISTS idx_customer_referrals_order_id ON customer_referrals(order_id);

-- Create customer_credits table for tracking customer credit balances
CREATE TABLE IF NOT EXISTS customer_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    total_earned INTEGER DEFAULT 0, -- Total credits ever earned
    total_used INTEGER DEFAULT 0, -- Total credits ever used
    available_balance INTEGER DEFAULT 0, -- Current available balance
    pending_credits INTEGER DEFAULT 0, -- Credits pending order completion
    last_credit_earned_at TIMESTAMP WITH TIME ZONE,
    last_credit_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(customer_id)
);

-- Add indexes for customer_credits
CREATE INDEX IF NOT EXISTS idx_customer_credits_customer_id ON customer_credits(customer_id);

-- Create customer_credit_transactions table for tracking credit history
CREATE TABLE IF NOT EXISTS customer_credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('earned', 'used', 'expired', 'refunded')),
    amount INTEGER NOT NULL, -- Amount in cents
    balance_after INTEGER NOT NULL, -- Balance after this transaction
    reference_type VARCHAR(20), -- 'referral', 'order', 'adjustment', etc.
    reference_id UUID, -- ID of the referral, order, etc.
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for customer_credit_transactions
CREATE INDEX IF NOT EXISTS idx_customer_credit_transactions_customer_id ON customer_credit_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_credit_transactions_type ON customer_credit_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_customer_credit_transactions_reference ON customer_credit_transactions(reference_type, reference_id);

-- ===========================================
-- PART 3: EXTEND EXISTING TABLES
-- ===========================================

-- Add referral_type field to existing referrals table to distinguish partner vs customer referrals
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referral_type VARCHAR(20) DEFAULT 'partner' CHECK (referral_type IN ('partner', 'customer', 'pre_registration'));

-- Add referrer type and customer referrer fields
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referrer_type VARCHAR(20) DEFAULT 'partner' CHECK (referrer_type IN ('partner', 'customer'));
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS customer_referrer_id UUID REFERENCES customers(id);

-- Add pre-registration code reference
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS pre_registration_code_id UUID REFERENCES pre_registration_codes(id);

-- Add referral tracking fields
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS accessed_from_qr BOOLEAN DEFAULT false;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS conversion_source VARCHAR(50); -- 'qr_scan', 'email', 'social', etc.

-- Add referral code to customers table for easy lookup
ALTER TABLE customers ADD COLUMN IF NOT EXISTS personal_referral_code VARCHAR(50) UNIQUE;

-- Add credit tracking fields to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_credits_earned INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS current_credit_balance INTEGER DEFAULT 0;

-- ===========================================
-- PART 4: CREATE UPDATED TIMESTAMP TRIGGERS
-- ===========================================

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at columns
DROP TRIGGER IF EXISTS update_pre_registration_codes_updated_at ON pre_registration_codes;
CREATE TRIGGER update_pre_registration_codes_updated_at
    BEFORE UPDATE ON pre_registration_codes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customer_referrals_updated_at ON customer_referrals;
CREATE TRIGGER update_customer_referrals_updated_at
    BEFORE UPDATE ON customer_referrals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customer_credits_updated_at ON customer_credits;
CREATE TRIGGER update_customer_credits_updated_at
    BEFORE UPDATE ON customer_credits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- PART 5: CREATE INDEXES FOR PERFORMANCE
-- ===========================================

-- Additional performance indexes
CREATE INDEX IF NOT EXISTS idx_referrals_referral_type ON referrals(referral_type);
CREATE INDEX IF NOT EXISTS idx_referrals_customer_referrer_id ON referrals(customer_referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_pre_registration_code_id ON referrals(pre_registration_code_id);
CREATE INDEX IF NOT EXISTS idx_customers_personal_referral_code ON customers(personal_referral_code);

-- ===========================================
-- PART 6: ENABLE ROW LEVEL SECURITY
-- ===========================================

-- Enable RLS on new tables
ALTER TABLE pre_registration_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_credit_transactions ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ===========================================
-- SUCCESS MESSAGE
-- ===========================================
DO $$
BEGIN
    RAISE NOTICE '✅ Extended Referral System Migration completed successfully!';
    RAISE NOTICE '📋 New tables created:';
    RAISE NOTICE '   - pre_registration_codes';
    RAISE NOTICE '   - customer_referrals';
    RAISE NOTICE '   - customer_credits';
    RAISE NOTICE '   - customer_credit_transactions';
    RAISE NOTICE '🔄 Extended existing tables:';
    RAISE NOTICE '   - referrals (added referral_type, referrer_type, customer_referrer_id)';
    RAISE NOTICE '   - customers (added personal_referral_code, credit fields)';
    RAISE NOTICE '🔒 RLS enabled on all new tables';
    RAISE NOTICE '⚡ Performance indexes created';
    RAISE NOTICE '';
    RAISE NOTICE '➡️  Next: Run the RLS policies script';
END $$;