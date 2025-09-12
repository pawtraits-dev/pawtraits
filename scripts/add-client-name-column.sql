-- Add missing client_name column to client_orders table
-- This fixes the webhook error when creating commission records

-- Add client_name column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'client_orders' AND column_name = 'client_name') THEN
        ALTER TABLE client_orders ADD COLUMN client_name TEXT;
        RAISE NOTICE '✅ Added client_name column to client_orders table';
    ELSE
        RAISE NOTICE 'ℹ️  client_name column already exists in client_orders table';
    END IF;
END $$;

-- Verify the column was added
SELECT 'Updated client_orders table structure:' as section;
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'client_orders' 
AND column_name IN ('client_email', 'client_name', 'partner_id', 'order_id', 'commission_amount', 'order_type')
ORDER BY column_name;