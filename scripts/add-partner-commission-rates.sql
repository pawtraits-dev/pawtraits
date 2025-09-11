-- Add partner-specific commission rates to partners table
-- This allows each partner to have configurable commission rates for initial and subsequent customer orders

-- Add commission rate columns to partners table
ALTER TABLE partners 
ADD COLUMN initial_commission_rate DECIMAL(5,2) DEFAULT 20.00,
ADD COLUMN subsequent_commission_rate DECIMAL(5,2) DEFAULT 5.00;

-- Add comments explaining the new columns
COMMENT ON COLUMN partners.initial_commission_rate IS 'Commission rate (%) for first-time customer orders';
COMMENT ON COLUMN partners.subsequent_commission_rate IS 'Commission rate (%) for repeat customer orders';

-- Add constraints to ensure rates are within reasonable bounds (0-100%)
ALTER TABLE partners 
ADD CONSTRAINT check_initial_commission_rate 
CHECK (initial_commission_rate >= 0 AND initial_commission_rate <= 100);

ALTER TABLE partners 
ADD CONSTRAINT check_subsequent_commission_rate 
CHECK (subsequent_commission_rate >= 0 AND subsequent_commission_rate <= 100);

-- Update existing partners to have default rates
UPDATE partners 
SET 
  initial_commission_rate = 20.00,
  subsequent_commission_rate = 5.00
WHERE initial_commission_rate IS NULL OR subsequent_commission_rate IS NULL;

-- Verify the schema changes
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'partners' 
AND column_name IN ('initial_commission_rate', 'subsequent_commission_rate')
ORDER BY column_name;