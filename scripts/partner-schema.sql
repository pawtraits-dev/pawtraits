-- Partner Account Management Database Schema
-- Run these commands in your Supabase SQL editor

-- 1. Partners table (B2B clients: groomers, breeders, vets)
CREATE TABLE IF NOT EXISTS partners (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    business_name TEXT,
    business_type TEXT CHECK (business_type IN ('groomer', 'breeder', 'vet', 'salon', 'mobile', 'independent', 'chain')),
    business_address JSONB, -- {street, city, state, zip, country}
    business_phone TEXT,
    business_website TEXT,
    bio TEXT,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    onboarding_completed BOOLEAN DEFAULT false,
    -- Payment information
    payment_method TEXT CHECK (payment_method IN ('paypal', 'bank_transfer')),
    payment_details JSONB, -- Encrypted payment info
    -- Preferences
    notification_preferences JSONB DEFAULT '{"email_commissions": true, "email_referrals": true, "sms_enabled": false}',
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Referrals table
CREATE TABLE IF NOT EXISTS referrals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    referral_code TEXT NOT NULL UNIQUE,
    -- Client information
    client_name TEXT NOT NULL,
    client_email TEXT NOT NULL,
    client_phone TEXT,
    client_notes TEXT,
    -- Referral status and tracking
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'viewed', 'clicked', 'purchased', 'expired')),
    qr_code_url TEXT,
    qr_scans INTEGER DEFAULT 0,
    email_opens INTEGER DEFAULT 0,
    last_viewed_at TIMESTAMP WITH TIME ZONE,
    -- Order and commission details
    order_id UUID, -- Will reference orders table when created
    order_value DECIMAL(10,2),
    discount_amount DECIMAL(10,2),
    commission_rate DECIMAL(5,2) DEFAULT 20.00, -- Initial 20%
    lifetime_commission_rate DECIMAL(5,2) DEFAULT 5.00, -- Subsequent 5%
    commission_amount DECIMAL(10,2),
    commission_paid BOOLEAN DEFAULT false,
    -- Timestamps
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
    purchased_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Commission payments table
CREATE TABLE IF NOT EXISTS commission_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    -- Payment period
    payment_period_start DATE NOT NULL,
    payment_period_end DATE NOT NULL,
    -- Totals
    total_amount DECIMAL(10,2) NOT NULL,
    referral_count INTEGER NOT NULL DEFAULT 0,
    initial_commission_amount DECIMAL(10,2) DEFAULT 0, -- 20% from initial orders
    lifetime_commission_amount DECIMAL(10,2) DEFAULT 0, -- 5% from repeat orders
    -- Payment status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'cancelled')),
    payment_method TEXT NOT NULL,
    payment_details JSONB, -- Transaction IDs, etc.
    failure_reason TEXT,
    -- Timestamps
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Client orders table (for tracking repeat customers)
CREATE TABLE IF NOT EXISTS client_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_email TEXT NOT NULL,
    referral_id UUID REFERENCES referrals(id) ON DELETE SET NULL,
    partner_id UUID REFERENCES partners(id) ON DELETE SET NULL,
    -- Order details
    order_value DECIMAL(10,2) NOT NULL,
    discount_applied DECIMAL(10,2) DEFAULT 0,
    is_initial_order BOOLEAN DEFAULT true,
    -- Commission tracking
    commission_rate DECIMAL(5,2),
    commission_amount DECIMAL(10,2),
    commission_paid BOOLEAN DEFAULT false,
    payment_id UUID REFERENCES commission_payments(id) ON DELETE SET NULL,
    -- Order metadata
    order_items JSONB, -- Array of items ordered
    order_status TEXT DEFAULT 'pending' CHECK (order_status IN ('pending', 'processing', 'completed', 'cancelled', 'refunded')),
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Referral analytics table (for detailed tracking)
CREATE TABLE IF NOT EXISTS referral_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('qr_scan', 'email_open', 'link_click', 'page_view', 'order_start', 'order_complete')),
    event_data JSONB, -- Additional event metadata
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_partners_email ON partners(email);
CREATE INDEX IF NOT EXISTS idx_partners_business_type ON partners(business_type);
CREATE INDEX IF NOT EXISTS idx_partners_is_active ON partners(is_active);

CREATE INDEX IF NOT EXISTS idx_referrals_partner_id ON referrals(partner_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_referrals_client_email ON referrals(client_email);
CREATE INDEX IF NOT EXISTS idx_referrals_expires_at ON referrals(expires_at);
CREATE INDEX IF NOT EXISTS idx_referrals_created_at ON referrals(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_commission_payments_partner_id ON commission_payments(partner_id);
CREATE INDEX IF NOT EXISTS idx_commission_payments_status ON commission_payments(status);
CREATE INDEX IF NOT EXISTS idx_commission_payments_period ON commission_payments(payment_period_start, payment_period_end);

CREATE INDEX IF NOT EXISTS idx_client_orders_client_email ON client_orders(client_email);
CREATE INDEX IF NOT EXISTS idx_client_orders_partner_id ON client_orders(partner_id);
CREATE INDEX IF NOT EXISTS idx_client_orders_referral_id ON client_orders(referral_id);
CREATE INDEX IF NOT EXISTS idx_client_orders_is_initial ON client_orders(is_initial_order);

CREATE INDEX IF NOT EXISTS idx_referral_analytics_referral_id ON referral_analytics(referral_id);
CREATE INDEX IF NOT EXISTS idx_referral_analytics_event_type ON referral_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_referral_analytics_created_at ON referral_analytics(created_at DESC);

-- 7. Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_partners_updated_at 
    BEFORE UPDATE ON partners 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_referrals_updated_at 
    BEFORE UPDATE ON referrals 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_commission_payments_updated_at 
    BEFORE UPDATE ON commission_payments 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_orders_updated_at 
    BEFORE UPDATE ON client_orders 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 8. Enable Row Level Security
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_analytics ENABLE ROW LEVEL SECURITY;

-- 9. Create RLS policies for partners
CREATE POLICY "Partners can view their own profile" ON partners
    FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Partners can update their own profile" ON partners
    FOR UPDATE USING (auth.uid()::text = id::text);

CREATE POLICY "Public can view active partner profiles" ON partners
    FOR SELECT USING (is_active = true);

-- 10. Create RLS policies for referrals
CREATE POLICY "Partners can manage their own referrals" ON referrals
    FOR ALL USING (partner_id IN (SELECT id FROM partners WHERE auth.uid()::text = id::text));

CREATE POLICY "Public can view referrals by code" ON referrals
    FOR SELECT USING (true);

-- 11. Create RLS policies for commission payments
CREATE POLICY "Partners can view their own commission payments" ON commission_payments
    FOR SELECT USING (partner_id IN (SELECT id FROM partners WHERE auth.uid()::text = id::text));

-- 12. Create RLS policies for client orders
CREATE POLICY "Partners can view orders from their referrals" ON client_orders
    FOR SELECT USING (partner_id IN (SELECT id FROM partners WHERE auth.uid()::text = id::text));

-- 13. Create RLS policies for referral analytics
CREATE POLICY "Partners can view analytics for their referrals" ON referral_analytics
    FOR SELECT USING (referral_id IN (
        SELECT id FROM referrals WHERE partner_id IN (
            SELECT id FROM partners WHERE auth.uid()::text = id::text
        )
    ));

CREATE POLICY "Public can insert analytics events" ON referral_analytics
    FOR INSERT WITH CHECK (true);

-- 14. Grant necessary permissions
GRANT ALL ON partners TO authenticated;
GRANT ALL ON referrals TO authenticated;
GRANT ALL ON commission_payments TO authenticated;
GRANT ALL ON client_orders TO authenticated;
GRANT ALL ON referral_analytics TO authenticated;

GRANT SELECT ON partners TO anon;
GRANT SELECT ON referrals TO anon;
GRANT INSERT ON referral_analytics TO anon;

-- 15. Create views for dashboard statistics
CREATE OR REPLACE VIEW partner_stats AS
SELECT 
    p.id as partner_id,
    p.first_name,
    p.last_name,
    p.business_name,
    COUNT(r.id) as total_referrals,
    COUNT(CASE WHEN r.status = 'purchased' THEN 1 END) as successful_referrals,
    COUNT(CASE WHEN r.status = 'pending' THEN 1 END) as pending_referrals,
    COUNT(CASE WHEN r.status = 'expired' THEN 1 END) as expired_referrals,
    COALESCE(SUM(r.commission_amount), 0) as total_commission_earned,
    COALESCE(SUM(r.order_value), 0) as total_order_value,
    COALESCE(AVG(r.order_value), 0) as avg_order_value,
    CASE 
        WHEN COUNT(r.id) = 0 THEN 0 
        ELSE ROUND((COUNT(CASE WHEN r.status = 'purchased' THEN 1 END)::DECIMAL / COUNT(r.id)::DECIMAL) * 100, 2) 
    END as conversion_rate,
    SUM(r.qr_scans) as total_qr_scans
FROM partners p
LEFT JOIN referrals r ON p.id = r.partner_id
GROUP BY p.id, p.first_name, p.last_name, p.business_name;

-- Grant permissions on view
GRANT SELECT ON partner_stats TO authenticated;

-- 16. Function to generate unique referral codes
CREATE OR REPLACE FUNCTION generate_referral_code(partner_prefix TEXT DEFAULT '')
RETURNS TEXT AS $$
DECLARE
    code TEXT;
    code_exists BOOLEAN;
BEGIN
    LOOP
        -- Generate code: PARTNER_PREFIX + 6 random chars
        code := UPPER(partner_prefix || substring(md5(random()::text) from 1 for 6));
        
        -- Check if code already exists
        SELECT EXISTS(SELECT 1 FROM referrals WHERE referral_code = code) INTO code_exists;
        
        -- Exit loop if code is unique
        EXIT WHEN NOT code_exists;
    END LOOP;
    
    RETURN code;
END;
$$ LANGUAGE plpgsql;

-- 17. Function to calculate commissions
CREATE OR REPLACE FUNCTION calculate_commission(
    order_value DECIMAL,
    is_initial BOOLEAN DEFAULT true
) RETURNS DECIMAL AS $$
BEGIN
    IF is_initial THEN
        RETURN ROUND(order_value * 0.20, 2); -- 20% for initial orders
    ELSE
        RETURN ROUND(order_value * 0.05, 2); -- 5% for repeat orders
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 18. Functions to increment counters safely
CREATE OR REPLACE FUNCTION increment_qr_scans(referral_id UUID)
RETURNS INTEGER AS $$
DECLARE
    new_count INTEGER;
BEGIN
    UPDATE referrals 
    SET qr_scans = qr_scans + 1 
    WHERE id = referral_id
    RETURNING qr_scans INTO new_count;
    
    RETURN COALESCE(new_count, 0);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_email_opens(referral_id UUID)
RETURNS INTEGER AS $$
DECLARE
    new_count INTEGER;
BEGIN
    UPDATE referrals 
    SET email_opens = email_opens + 1 
    WHERE id = referral_id
    RETURNING email_opens INTO new_count;
    
    RETURN COALESCE(new_count, 0);
END;
$$ LANGUAGE plpgsql;