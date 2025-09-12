-- Fix client_orders table structure for commission tracking
-- This adds missing columns that the webhook expects

-- Add missing order_type column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'client_orders' AND column_name = 'order_type') THEN
        ALTER TABLE client_orders ADD COLUMN order_type TEXT;
        RAISE NOTICE 'Added order_type column to client_orders';
    ELSE
        RAISE NOTICE 'order_type column already exists';
    END IF;
END $$;

-- Ensure all required columns exist with proper types
DO $$ 
BEGIN 
    -- Add order_id column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'client_orders' AND column_name = 'order_id') THEN
        ALTER TABLE client_orders ADD COLUMN order_id UUID REFERENCES orders(id);
        RAISE NOTICE 'Added order_id column to client_orders';
    END IF;
    
    -- Add order_value column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'client_orders' AND column_name = 'order_value') THEN
        ALTER TABLE client_orders ADD COLUMN order_value INTEGER;
        RAISE NOTICE 'Added order_value column to client_orders';
    END IF;
    
    -- Add is_initial_order column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'client_orders' AND column_name = 'is_initial_order') THEN
        ALTER TABLE client_orders ADD COLUMN is_initial_order BOOLEAN DEFAULT false;
        RAISE NOTICE 'Added is_initial_order column to client_orders';
    END IF;
    
    -- Add commission_rate column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'client_orders' AND column_name = 'commission_rate') THEN
        ALTER TABLE client_orders ADD COLUMN commission_rate DECIMAL(5,2);
        RAISE NOTICE 'Added commission_rate column to client_orders';
    END IF;
    
    -- Add commission_amount column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'client_orders' AND column_name = 'commission_amount') THEN
        ALTER TABLE client_orders ADD COLUMN commission_amount INTEGER;
        RAISE NOTICE 'Added commission_amount column to client_orders';
    END IF;
    
    -- Add commission_paid column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'client_orders' AND column_name = 'commission_paid') THEN
        ALTER TABLE client_orders ADD COLUMN commission_paid BOOLEAN DEFAULT false;
        RAISE NOTICE 'Added commission_paid column to client_orders';
    END IF;
    
    -- Add order_status column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'client_orders' AND column_name = 'order_status') THEN
        ALTER TABLE client_orders ADD COLUMN order_status TEXT DEFAULT 'completed';
        RAISE NOTICE 'Added order_status column to client_orders';
    END IF;
END $$;

-- Show final table structure
SELECT 'Updated client_orders table structure:' as section;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'client_orders' 
ORDER BY ordinal_position;