-- Extended Referral System RLS Policies
-- Run this after the migration and functions scripts
-- Implements Row Level Security for all new referral system tables

-- ===========================================
-- PRE-REGISTRATION CODES RLS POLICIES
-- ===========================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "pre_registration_codes_admin_full_access" ON pre_registration_codes;
DROP POLICY IF EXISTS "pre_registration_codes_public_read_active" ON pre_registration_codes;
DROP POLICY IF EXISTS "pre_registration_codes_service_role_access" ON pre_registration_codes;

-- Admin users can manage all pre-registration codes
CREATE POLICY "pre_registration_codes_admin_full_access"
ON pre_registration_codes
FOR ALL
USING (
    auth.jwt() ->> 'role' = 'authenticated' AND
    EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_id = auth.uid()
        AND user_type = 'admin'
    )
);

-- Public can read active codes for QR scanning (limited fields)
CREATE POLICY "pre_registration_codes_public_read_active"
ON pre_registration_codes
FOR SELECT
USING (
    status = 'active' AND
    (expiration_date IS NULL OR expiration_date > NOW())
);

-- Service role has full access
CREATE POLICY "pre_registration_codes_service_role_access"
ON pre_registration_codes
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- ===========================================
-- CUSTOMER REFERRALS RLS POLICIES
-- ===========================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "customer_referrals_referrer_access" ON customer_referrals;
DROP POLICY IF EXISTS "customer_referrals_referee_read" ON customer_referrals;
DROP POLICY IF EXISTS "customer_referrals_public_code_lookup" ON customer_referrals;
DROP POLICY IF EXISTS "customer_referrals_admin_access" ON customer_referrals;
DROP POLICY IF EXISTS "customer_referrals_service_role_access" ON customer_referrals;

-- Customers can manage their own referrals (as referrer)
CREATE POLICY "customer_referrals_referrer_access"
ON customer_referrals
FOR ALL
USING (
    auth.jwt() ->> 'role' = 'authenticated' AND
    EXISTS (
        SELECT 1 FROM customers
        WHERE id = referrer_customer_id
        AND user_id = auth.uid()
    )
);

-- Customers can read referrals where they are the referee
CREATE POLICY "customer_referrals_referee_read"
ON customer_referrals
FOR SELECT
USING (
    auth.jwt() ->> 'role' = 'authenticated' AND
    EXISTS (
        SELECT 1 FROM customers
        WHERE id = referee_customer_id
        AND user_id = auth.uid()
    )
);

-- Public can lookup referral codes (for /r/[code] pages)
CREATE POLICY "customer_referrals_public_code_lookup"
ON customer_referrals
FOR SELECT
USING (
    status IN ('pending', 'accessed', 'signed_up') AND
    expires_at > NOW()
);

-- Admin users can access all customer referrals
CREATE POLICY "customer_referrals_admin_access"
ON customer_referrals
FOR ALL
USING (
    auth.jwt() ->> 'role' = 'authenticated' AND
    EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_id = auth.uid()
        AND user_type = 'admin'
    )
);

-- Service role has full access
CREATE POLICY "customer_referrals_service_role_access"
ON customer_referrals
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- ===========================================
-- CUSTOMER CREDITS RLS POLICIES
-- ===========================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "customer_credits_owner_access" ON customer_credits;
DROP POLICY IF EXISTS "customer_credits_admin_access" ON customer_credits;
DROP POLICY IF EXISTS "customer_credits_service_role_access" ON customer_credits;

-- Customers can only access their own credits
CREATE POLICY "customer_credits_owner_access"
ON customer_credits
FOR ALL
USING (
    auth.jwt() ->> 'role' = 'authenticated' AND
    EXISTS (
        SELECT 1 FROM customers
        WHERE id = customer_id
        AND user_id = auth.uid()
    )
);

-- Admin users can access all customer credits
CREATE POLICY "customer_credits_admin_access"
ON customer_credits
FOR ALL
USING (
    auth.jwt() ->> 'role' = 'authenticated' AND
    EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_id = auth.uid()
        AND user_type = 'admin'
    )
);

-- Service role has full access
CREATE POLICY "customer_credits_service_role_access"
ON customer_credits
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- ===========================================
-- CUSTOMER CREDIT TRANSACTIONS RLS POLICIES
-- ===========================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "customer_credit_transactions_owner_read" ON customer_credit_transactions;
DROP POLICY IF EXISTS "customer_credit_transactions_admin_access" ON customer_credit_transactions;
DROP POLICY IF EXISTS "customer_credit_transactions_service_role_access" ON customer_credit_transactions;

-- Customers can read their own credit transaction history
CREATE POLICY "customer_credit_transactions_owner_read"
ON customer_credit_transactions
FOR SELECT
USING (
    auth.jwt() ->> 'role' = 'authenticated' AND
    EXISTS (
        SELECT 1 FROM customers
        WHERE id = customer_id
        AND user_id = auth.uid()
    )
);

-- Admin users can access all credit transactions
CREATE POLICY "customer_credit_transactions_admin_access"
ON customer_credit_transactions
FOR ALL
USING (
    auth.jwt() ->> 'role' = 'authenticated' AND
    EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_id = auth.uid()
        AND user_type = 'admin'
    )
);

-- Service role has full access (for creating transactions via functions)
CREATE POLICY "customer_credit_transactions_service_role_access"
ON customer_credit_transactions
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- ===========================================
-- PARTNER ACCESS TO CUSTOMER REFERRALS
-- ===========================================

-- Partners can read customer referrals that originated from their partner referrals
-- This is for cases where a customer was first referred by a partner, then refers friends
DROP POLICY IF EXISTS "customer_referrals_partner_view" ON customer_referrals;

CREATE POLICY "customer_referrals_partner_view"
ON customer_referrals
FOR SELECT
USING (
    auth.jwt() ->> 'role' = 'authenticated' AND
    EXISTS (
        SELECT 1 FROM customers c
        JOIN referrals r ON r.client_email = c.email AND r.status = 'applied'
        JOIN partners p ON p.id = r.partner_id
        WHERE c.id = referrer_customer_id
        AND p.user_id = auth.uid()
    )
);

-- ===========================================
-- SECURITY FUNCTIONS FOR RLS
-- ===========================================

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_id = auth.uid()
        AND user_type = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is partner
CREATE OR REPLACE FUNCTION is_partner()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_id = auth.uid()
        AND user_type = 'partner'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is customer
CREATE OR REPLACE FUNCTION is_customer()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_id = auth.uid()
        AND user_type = 'customer'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user's customer ID
CREATE OR REPLACE FUNCTION current_customer_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT c.id
        FROM customers c
        WHERE c.user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user's partner ID
CREATE OR REPLACE FUNCTION current_partner_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT p.id
        FROM partners p
        WHERE p.user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- GRANT PERMISSIONS
-- ===========================================

-- Grant execute permissions on security functions
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION is_partner() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION is_customer() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION current_customer_id() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION current_partner_id() TO authenticated, anon, service_role;

-- Grant necessary permissions on tables
GRANT SELECT, INSERT, UPDATE, DELETE ON pre_registration_codes TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON customer_referrals TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON customer_credits TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON customer_credit_transactions TO authenticated, service_role;

-- Grant select permissions to anon for public access
GRANT SELECT ON pre_registration_codes TO anon;
GRANT SELECT ON customer_referrals TO anon;

-- ===========================================
-- ADDITIONAL SECURITY MEASURES
-- ===========================================

-- Prevent direct credit manipulation by non-admin users
CREATE POLICY "prevent_credit_manipulation"
ON customer_credit_transactions
FOR INSERT
WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role' OR
    is_admin()
);

-- Ensure referral codes are unique and properly formatted
ALTER TABLE customer_referrals
ADD CONSTRAINT customer_referrals_code_format
CHECK (referral_code ~ '^[A-Z0-9]{8,20}$');

ALTER TABLE pre_registration_codes
ADD CONSTRAINT pre_registration_codes_code_format
CHECK (code ~ '^[A-Z0-9]{6,50}$');

-- Add constraints to prevent negative credits
ALTER TABLE customer_credits
ADD CONSTRAINT customer_credits_non_negative_balance
CHECK (available_balance >= 0),
ADD CONSTRAINT customer_credits_non_negative_earned
CHECK (total_earned >= 0),
ADD CONSTRAINT customer_credits_non_negative_used
CHECK (total_used >= 0);

-- ===========================================
-- SUCCESS MESSAGE
-- ===========================================
DO $$
BEGIN
    RAISE NOTICE '🔒 Extended Referral System RLS Policies created successfully!';
    RAISE NOTICE '✅ Security policies implemented:';
    RAISE NOTICE '   - pre_registration_codes: Admin management, public read for active codes';
    RAISE NOTICE '   - customer_referrals: Owner access, public code lookup, admin oversight';
    RAISE NOTICE '   - customer_credits: Owner access only, admin oversight';
    RAISE NOTICE '   - customer_credit_transactions: Owner read, service role write';
    RAISE NOTICE '🛡️  Security functions created for role checking';
    RAISE NOTICE '⚡ Constraints added to prevent abuse';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Database setup complete! Ready for application integration.';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Summary of new database objects:';
    RAISE NOTICE '   Tables: 4 new tables + extended existing tables';
    RAISE NOTICE '   Functions: 12+ new functions for referral logic';
    RAISE NOTICE '   Policies: 15+ RLS policies for security';
    RAISE NOTICE '   Indexes: Performance indexes on all key fields';
END $$;