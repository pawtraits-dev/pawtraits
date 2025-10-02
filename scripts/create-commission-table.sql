-- Commission Tracking Table
-- Purpose: Track commissions for partner referrals and customer referral rewards
-- This replaces the problematic foreign key constraint system

CREATE TABLE IF NOT EXISTS commissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Order information
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_amount INTEGER NOT NULL, -- in pence

  -- Commission recipient information
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('partner', 'customer')),
  recipient_id UUID NOT NULL, -- Can reference partners.id or customers.id depending on type
  recipient_email TEXT NOT NULL,

  -- Referral source information
  referrer_type TEXT NOT NULL CHECK (referrer_type IN ('partner', 'customer')),
  referrer_id UUID, -- The partner or customer who made the referral
  referral_code TEXT, -- The referral code used (if any)

  -- Commission details
  commission_type TEXT NOT NULL CHECK (commission_type IN ('partner_commission', 'customer_credit')),
  commission_rate DECIMAL(5,2) NOT NULL DEFAULT 10.00, -- percentage
  commission_amount INTEGER NOT NULL, -- in pence

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  payment_date TIMESTAMPTZ,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Metadata for debugging
  metadata JSONB,

  -- Indexes for performance
  UNIQUE(order_id, recipient_id) -- Prevent duplicate commissions for same order/recipient
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_commissions_recipient ON commissions(recipient_type, recipient_id);
CREATE INDEX IF NOT EXISTS idx_commissions_referrer ON commissions(referrer_type, referrer_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions(status);
CREATE INDEX IF NOT EXISTS idx_commissions_created_at ON commissions(created_at);
CREATE INDEX IF NOT EXISTS idx_commissions_order_id ON commissions(order_id);

-- Enable RLS
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Service role can manage all commissions" ON commissions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Partners can view their own commissions" ON commissions
  FOR SELECT USING (
    recipient_type = 'partner' AND
    recipient_id IN (
      SELECT partner_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Customers can view their own commission credits" ON commissions
  FOR SELECT USING (
    recipient_type = 'customer' AND
    recipient_id IN (
      SELECT customer_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

COMMENT ON TABLE commissions IS 'Tracks commissions for partner referrals and customer referral credits';
COMMENT ON COLUMN commissions.recipient_type IS 'Who receives the commission: partner or customer';
COMMENT ON COLUMN commissions.commission_type IS 'Type of commission: partner_commission or customer_credit';
COMMENT ON COLUMN commissions.commission_amount IS 'Commission amount in pence (e.g., 1000 = £10.00)';
COMMENT ON COLUMN commissions.status IS 'Commission status: pending, approved, paid, cancelled';