-- Create customer_credits table for tracking referral credits
-- This table tracks credits earned by customers when they refer other customers

CREATE TABLE IF NOT EXISTS customer_credits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL, -- References user_profiles.id for the customer receiving the credit
  credit_amount INTEGER NOT NULL, -- Credit amount in pence
  earned_from_order_id UUID REFERENCES orders(id), -- Order that generated this credit
  used_in_order_id UUID REFERENCES orders(id), -- Order where this credit was used (nullable)
  status TEXT NOT NULL DEFAULT 'available',
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '1 year'), -- Credits expire after 1 year
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  -- Foreign key constraints
  CONSTRAINT fk_customer_credits_customer_id
    FOREIGN KEY (customer_id)
    REFERENCES user_profiles(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_customer_credits_earned_from_order
    FOREIGN KEY (earned_from_order_id)
    REFERENCES orders(id)
    ON DELETE SET NULL,

  CONSTRAINT fk_customer_credits_used_in_order
    FOREIGN KEY (used_in_order_id)
    REFERENCES orders(id)
    ON DELETE SET NULL
);

-- Add CHECK constraint for status column
ALTER TABLE customer_credits
ADD CONSTRAINT chk_customer_credits_status
CHECK (status IN ('available', 'used', 'expired'));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customer_credits_customer_id ON customer_credits(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_credits_status ON customer_credits(status);
CREATE INDEX IF NOT EXISTS idx_customer_credits_expires_at ON customer_credits(expires_at);
CREATE INDEX IF NOT EXISTS idx_customer_credits_earned_from_order ON customer_credits(earned_from_order_id);
CREATE INDEX IF NOT EXISTS idx_customer_credits_used_in_order ON customer_credits(used_in_order_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_customer_credits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_customer_credits_updated_at ON customer_credits;
CREATE TRIGGER update_customer_credits_updated_at
    BEFORE UPDATE ON customer_credits
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_credits_updated_at();

-- Enable RLS if needed
-- ALTER TABLE customer_credits ENABLE ROW LEVEL SECURITY;

-- Grant permissions (adjust as needed)
-- GRANT ALL ON customer_credits TO authenticated;
-- GRANT ALL ON customer_credits TO service_role;

-- Create function to get available credits for a customer
CREATE OR REPLACE FUNCTION get_customer_available_credits(p_customer_id UUID)
RETURNS TABLE (
  id UUID,
  credit_amount INTEGER,
  earned_from_order_id UUID,
  created_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cc.id,
    cc.credit_amount,
    cc.earned_from_order_id,
    cc.created_at,
    cc.expires_at
  FROM customer_credits cc
  WHERE
    cc.customer_id = p_customer_id
    AND cc.status = 'available'
    AND cc.expires_at > now()
  ORDER BY cc.created_at ASC; -- FIFO - use oldest credits first
END;
$$;

-- Create function to get total available credit balance for a customer
CREATE OR REPLACE FUNCTION get_customer_credit_balance(p_customer_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_credits INTEGER;
BEGIN
  SELECT COALESCE(SUM(credit_amount), 0)
  INTO total_credits
  FROM customer_credits
  WHERE
    customer_id = p_customer_id
    AND status = 'available'
    AND expires_at > now();

  RETURN total_credits;
END;
$$;

-- Grant permissions for the functions
GRANT EXECUTE ON FUNCTION get_customer_available_credits(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_customer_credit_balance(UUID) TO authenticated;

-- Add comments explaining the table
COMMENT ON TABLE customer_credits IS 'Tracks credits earned by customers when they refer other customers';
COMMENT ON COLUMN customer_credits.customer_id IS 'Customer who earned the credit (referrer)';
COMMENT ON COLUMN customer_credits.credit_amount IS 'Credit amount in pence (10% of referred customer first order)';
COMMENT ON COLUMN customer_credits.earned_from_order_id IS 'Order that generated this credit (referred customer order)';
COMMENT ON COLUMN customer_credits.used_in_order_id IS 'Order where this credit was applied (nullable until used)';
COMMENT ON COLUMN customer_credits.status IS 'Credit status: available, used, or expired';
COMMENT ON COLUMN customer_credits.expires_at IS 'Credits expire after 1 year from creation';

-- Show the created table structure
SELECT 'Created customer_credits table with structure:' as section;
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'customer_credits'
ORDER BY ordinal_position;