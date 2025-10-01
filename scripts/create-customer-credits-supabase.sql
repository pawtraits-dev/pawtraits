-- Create customer_credits table - Supabase compatible version

CREATE TABLE customer_credits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL,
  credit_amount INTEGER NOT NULL,
  earned_from_order_id UUID,
  used_in_order_id UUID,
  status TEXT DEFAULT 'available',
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '1 year'),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_customer_credits_customer_id ON customer_credits(customer_id);
CREATE INDEX idx_customer_credits_status ON customer_credits(status);
CREATE INDEX idx_customer_credits_expires_at ON customer_credits(expires_at);

-- Create simple function to get customer credit balance
CREATE OR REPLACE FUNCTION get_customer_credit_balance(customer_uuid UUID)
RETURNS INTEGER
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT COALESCE(SUM(credit_amount), 0)::INTEGER
  FROM customer_credits
  WHERE customer_id = customer_uuid
    AND status = 'available'
    AND expires_at > now();
$$;

-- Test the table creation
SELECT 'customer_credits table created successfully' AS result;