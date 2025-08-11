-- Create client_orders table for commission tracking
-- This table tracks orders that came through referrals for commission calculation

CREATE TABLE IF NOT EXISTS client_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_email TEXT NOT NULL,
  referral_id UUID REFERENCES referrals(id),
  partner_id UUID REFERENCES partners(id),
  order_value NUMERIC NOT NULL,
  discount_applied NUMERIC DEFAULT 0,
  is_initial_order BOOLEAN DEFAULT true,
  commission_rate NUMERIC,
  commission_amount NUMERIC,
  commission_paid BOOLEAN DEFAULT false,
  payment_id UUID REFERENCES commission_payments(id),
  order_items JSONB,
  order_status TEXT DEFAULT 'pending' CHECK (order_status IN ('pending', 'processing', 'completed', 'cancelled', 'refunded')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_client_orders_client_email ON client_orders(client_email);
CREATE INDEX IF NOT EXISTS idx_client_orders_referral_id ON client_orders(referral_id);
CREATE INDEX IF NOT EXISTS idx_client_orders_partner_id ON client_orders(partner_id);
CREATE INDEX IF NOT EXISTS idx_client_orders_commission_paid ON client_orders(commission_paid);
CREATE INDEX IF NOT EXISTS idx_client_orders_created_at ON client_orders(created_at);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_client_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_client_orders_updated_at ON client_orders;
CREATE TRIGGER update_client_orders_updated_at
    BEFORE UPDATE ON client_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_client_orders_updated_at();

-- Enable RLS if needed
-- ALTER TABLE client_orders ENABLE ROW LEVEL SECURITY;

-- Grant permissions (adjust as needed)
-- GRANT ALL ON client_orders TO authenticated;
-- GRANT ALL ON client_orders TO service_role;