-- =============================================================================
-- COST TRACKING SCHEMA - CAPTURE COSTS AT TIME OF SALE
-- =============================================================================
-- This migration adds cost tracking fields to capture actual costs at the time
-- orders are placed, rather than using fixed percentages or current costs

-- ============================================================================= 
-- STEP 1: Add cost fields to order_items table
-- =============================================================================

-- Add cost tracking fields to order_items
ALTER TABLE public.order_items 
ADD COLUMN cost_price DECIMAL(10,2) DEFAULT 0,           -- Base product cost
ADD COLUMN fulfillment_cost DECIMAL(10,2) DEFAULT 0,     -- Printing/shipping cost  
ADD COLUMN ai_generation_cost DECIMAL(10,2) DEFAULT 0,   -- AI image generation cost
ADD COLUMN total_cost DECIMAL(10,2) DEFAULT 0,           -- Total cost for this item
ADD COLUMN gross_profit DECIMAL(10,2) DEFAULT 0,         -- unit_price - total_cost
ADD COLUMN cost_captured_at TIMESTAMP DEFAULT NOW(),     -- When costs were captured
ADD COLUMN cost_currency VARCHAR(3) DEFAULT 'USD';       -- Currency for costs

-- Add comment explaining the fields
COMMENT ON COLUMN public.order_items.cost_price IS 'Base product cost at time of sale';
COMMENT ON COLUMN public.order_items.fulfillment_cost IS 'Printing/shipping cost at time of sale';
COMMENT ON COLUMN public.order_items.ai_generation_cost IS 'AI generation cost at time of sale';
COMMENT ON COLUMN public.order_items.total_cost IS 'Total cost for this line item';
COMMENT ON COLUMN public.order_items.gross_profit IS 'Gross profit: unit_price - total_cost';

-- =============================================================================
-- STEP 2: Add cost fields to orders table  
-- =============================================================================

-- Add order-level cost tracking
ALTER TABLE public.orders
ADD COLUMN commission_rate DECIMAL(5,4) DEFAULT 0,       -- Actual commission rate applied
ADD COLUMN commission_amount DECIMAL(10,2) DEFAULT 0,    -- Commission amount calculated
ADD COLUMN processing_fee DECIMAL(10,2) DEFAULT 0,       -- Payment processing fee
ADD COLUMN total_order_cost DECIMAL(10,2) DEFAULT 0,     -- Sum of all item costs
ADD COLUMN total_gross_profit DECIMAL(10,2) DEFAULT 0,   -- Total revenue - total costs
ADD COLUMN exchange_rate DECIMAL(10,6) DEFAULT 1.0,      -- Currency exchange rate if applicable
ADD COLUMN cost_notes TEXT;                              -- Notes about cost calculation

-- Add comment explaining the fields
COMMENT ON COLUMN public.orders.commission_rate IS 'Actual partner commission rate at time of sale';
COMMENT ON COLUMN public.orders.commission_amount IS 'Commission amount calculated at sale time';
COMMENT ON COLUMN public.orders.total_order_cost IS 'Sum of all order item costs';
COMMENT ON COLUMN public.orders.total_gross_profit IS 'Order revenue minus order costs';

-- =============================================================================
-- STEP 3: Create historical cost tracking tables
-- =============================================================================

-- Product cost history - track how costs change over time
CREATE TABLE IF NOT EXISTS public.product_cost_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    
    -- Cost breakdown
    base_cost DECIMAL(10,2) NOT NULL,                     -- Base product cost
    fulfillment_cost DECIMAL(10,2) DEFAULT 0,             -- Fulfillment cost
    ai_generation_cost DECIMAL(10,2) DEFAULT 0,           -- AI generation cost
    total_cost DECIMAL(10,2) NOT NULL,                    -- Total cost
    
    -- Metadata
    effective_date TIMESTAMP NOT NULL DEFAULT NOW(),       -- When this cost becomes effective
    created_by UUID REFERENCES auth.users(id),            -- Who set this cost
    currency VARCHAR(3) DEFAULT 'USD',                    -- Cost currency
    notes TEXT,                                           -- Notes about cost change
    is_active BOOLEAN DEFAULT true,                       -- Is this the current cost
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for efficient querying
CREATE INDEX idx_product_cost_history_product_id ON public.product_cost_history(product_id);
CREATE INDEX idx_product_cost_history_effective_date ON public.product_cost_history(effective_date);
CREATE INDEX idx_product_cost_history_active ON public.product_cost_history(is_active);

-- Cost snapshots - capture complete cost structure at order time
CREATE TABLE IF NOT EXISTS public.cost_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    
    -- Captured costs at time of order
    total_product_costs DECIMAL(10,2) DEFAULT 0,          -- Sum of all product costs
    total_fulfillment_costs DECIMAL(10,2) DEFAULT 0,      -- Sum of fulfillment costs  
    total_ai_costs DECIMAL(10,2) DEFAULT 0,               -- Sum of AI generation costs
    commission_rate DECIMAL(5,4) DEFAULT 0,               -- Commission rate applied
    processing_fee_rate DECIMAL(5,4) DEFAULT 0,           -- Processing fee rate
    
    -- Market conditions
    exchange_rates JSONB,                                  -- Currency exchange rates
    cost_basis TEXT,                                       -- How costs were calculated
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_cost_snapshots_order_id ON public.cost_snapshots(order_id);
CREATE INDEX idx_cost_snapshots_created_at ON public.cost_snapshots(created_at);

-- =============================================================================
-- STEP 4: Create functions to calculate and capture costs
-- =============================================================================

-- Function to get current product cost
CREATE OR REPLACE FUNCTION get_current_product_cost(product_uuid UUID)
RETURNS TABLE(
    base_cost DECIMAL(10,2),
    fulfillment_cost DECIMAL(10,2), 
    ai_generation_cost DECIMAL(10,2),
    total_cost DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pch.base_cost,
        pch.fulfillment_cost,
        pch.ai_generation_cost,
        pch.total_cost
    FROM product_cost_history pch
    WHERE pch.product_id = product_uuid
      AND pch.is_active = true
      AND pch.effective_date <= NOW()
    ORDER BY pch.effective_date DESC
    LIMIT 1;
    
    -- If no cost history found, return defaults
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 
            0.00::DECIMAL(10,2) as base_cost,
            0.00::DECIMAL(10,2) as fulfillment_cost, 
            0.00::DECIMAL(10,2) as ai_generation_cost,
            0.00::DECIMAL(10,2) as total_cost;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to capture costs when order is placed
CREATE OR REPLACE FUNCTION capture_order_costs(order_uuid UUID)
RETURNS VOID AS $$
DECLARE
    item_record RECORD;
    order_record RECORD;
    current_costs RECORD;
    total_order_cost DECIMAL(10,2) := 0;
    total_gross_profit DECIMAL(10,2) := 0;
BEGIN
    -- Get order details
    SELECT * INTO order_record FROM orders WHERE id = order_uuid;
    
    -- Process each order item
    FOR item_record IN 
        SELECT oi.*, p.id as product_id
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id  
        WHERE oi.order_id = order_uuid
    LOOP
        -- Get current costs for this product
        SELECT * INTO current_costs FROM get_current_product_cost(item_record.product_id);
        
        -- Calculate item costs
        DECLARE
            item_total_cost DECIMAL(10,2);
            item_gross_profit DECIMAL(10,2);
        BEGIN
            item_total_cost := (current_costs.total_cost * item_record.quantity);
            item_gross_profit := ((item_record.unit_price * item_record.quantity) - item_total_cost);
            
            -- Update order item with captured costs
            UPDATE order_items 
            SET 
                cost_price = current_costs.base_cost,
                fulfillment_cost = current_costs.fulfillment_cost,
                ai_generation_cost = current_costs.ai_generation_cost,
                total_cost = item_total_cost,
                gross_profit = item_gross_profit,
                cost_captured_at = NOW()
            WHERE id = item_record.id;
            
            -- Add to order totals
            total_order_cost := total_order_cost + item_total_cost;
            total_gross_profit := total_gross_profit + item_gross_profit;
        END;
    END LOOP;
    
    -- Calculate commission if referral order
    DECLARE
        commission_rate DECIMAL(5,4) := 0;
        commission_amount DECIMAL(10,2) := 0;
    BEGIN
        IF order_record.referral_code IS NOT NULL THEN
            -- Get commission rate from referral
            SELECT r.commission_rate INTO commission_rate
            FROM referrals r 
            WHERE r.referral_code = order_record.referral_code;
            
            commission_amount := (order_record.total_amount * COALESCE(commission_rate, 0));
        END IF;
        
        -- Update order with cost summary
        UPDATE orders 
        SET 
            commission_rate = commission_rate,
            commission_amount = commission_amount,
            total_order_cost = total_order_cost,
            total_gross_profit = total_gross_profit - commission_amount,
            updated_at = NOW()
        WHERE id = order_uuid;
    END;
    
    -- Create cost snapshot
    INSERT INTO cost_snapshots (
        order_id,
        total_product_costs,
        total_fulfillment_costs,
        total_ai_costs,
        commission_rate,
        cost_basis
    )
    SELECT 
        order_uuid,
        SUM(oi.cost_price * oi.quantity),
        SUM(oi.fulfillment_cost * oi.quantity), 
        SUM(oi.ai_generation_cost * oi.quantity),
        o.commission_rate,
        'Captured at order completion'
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE oi.order_id = order_uuid
    GROUP BY o.commission_rate;
    
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- STEP 5: Add RLS policies for new tables
-- =============================================================================

-- Enable RLS on new tables
ALTER TABLE public.product_cost_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_snapshots ENABLE ROW LEVEL SECURITY;

-- Allow admins to manage cost history
CREATE POLICY "Admin can manage product cost history" ON public.product_cost_history
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() 
            AND user_type = 'admin'
        )
    );

-- Allow admins to view cost snapshots
CREATE POLICY "Admin can view cost snapshots" ON public.cost_snapshots
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() 
            AND user_type = 'admin'
        )
    );

-- =============================================================================
-- STEP 6: Add sample cost data for existing products
-- =============================================================================

-- Insert initial cost data for existing products
INSERT INTO product_cost_history (product_id, base_cost, fulfillment_cost, ai_generation_cost, total_cost, notes)
SELECT 
    id as product_id,
    CASE 
        WHEN name ILIKE '%digital%' THEN 5.00   -- Digital products
        WHEN name ILIKE '%print%' THEN 15.00    -- Physical prints
        ELSE 10.00                              -- Default
    END as base_cost,
    CASE 
        WHEN name ILIKE '%digital%' THEN 0.00   -- No fulfillment for digital
        WHEN name ILIKE '%print%' THEN 8.00     -- Printing cost
        ELSE 4.00                               -- Default shipping
    END as fulfillment_cost,
    2.50 as ai_generation_cost,                 -- AI generation cost
    CASE 
        WHEN name ILIKE '%digital%' THEN 7.50   -- 5.00 + 0.00 + 2.50
        WHEN name ILIKE '%print%' THEN 25.50    -- 15.00 + 8.00 + 2.50  
        ELSE 16.50                              -- 10.00 + 4.00 + 2.50
    END as total_cost,
    'Initial cost setup - estimated values' as notes
FROM products 
WHERE NOT EXISTS (
    SELECT 1 FROM product_cost_history pch 
    WHERE pch.product_id = products.id
);

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Verify new columns were added
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('order_items', 'orders') 
  AND column_name LIKE '%cost%' 
  OR column_name LIKE '%commission%'
  OR column_name LIKE '%profit%'
ORDER BY table_name, ordinal_position;

-- Check cost history records
SELECT 
    'product_cost_history' as table_name,
    COUNT(*) as records
FROM product_cost_history
UNION ALL
SELECT 
    'cost_snapshots' as table_name,
    COUNT(*) as records  
FROM cost_snapshots;

-- Test cost lookup function
SELECT * FROM get_current_product_cost(
    (SELECT id FROM products LIMIT 1)
);