-- Create customer_credits table in minimal steps to avoid column reference issues

-- Step 1: Create basic table structure
CREATE TABLE IF NOT EXISTS customer_credits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL,
  credit_amount INTEGER NOT NULL,
  earned_from_order_id UUID,
  used_in_order_id UUID,
  status TEXT DEFAULT 'available',
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '1 year'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Step 2: Verify table exists before adding constraints
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_credits') THEN
    RAISE NOTICE 'Table customer_credits created successfully';
  ELSE
    RAISE EXCEPTION 'Failed to create customer_credits table';
  END IF;
END $$;

-- Step 3: Add basic indexes first
CREATE INDEX IF NOT EXISTS idx_customer_credits_customer_id ON customer_credits(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_credits_status ON customer_credits(status);

-- Step 4: Show table structure to confirm
SELECT 'Table structure:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'customer_credits'
ORDER BY ordinal_position;