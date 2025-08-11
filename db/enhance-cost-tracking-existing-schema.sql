-- =============================================================================
-- ENHANCE EXISTING COST TRACKING - USE PRODUCT_PRICING TABLE
-- =============================================================================
-- This migration enhances the existing product_pricing table to support
-- date-based cost tracking and captures costs at the time of sale

-- =============================================================================
-- STEP 1: Add date-based pricing to product_pricing table
-- =============================================================================

-- Add date fields to track when prices/costs are effective
ALTER TABLE public.product_pricing 
ADD COLUMN effective_date TIMESTAMP DEFAULT NOW(),          -- When this pricing becomes effective
ADD COLUMN end_date TIMESTAMP,                              -- When this pricing expires (NULL = current)
ADD COLUMN is_current BOOLEAN DEFAULT true,                 -- Is this the current pricing
ADD COLUMN price_type VARCHAR(20) DEFAULT 'standard',       -- 'standard', 'promotional', 'bulk', etc.
ADD COLUMN ai_generation_cost INTEGER DEFAULT 0,            -- AI generation cost in cents
ADD COLUMN processing_fee_percent DECIMAL(5,4) DEFAULT 0.029, -- Payment processing fee (2.9%)
ADD COLUMN commission_cost INTEGER DEFAULT 0,               -- Estimated commission cost
ADD COLUMN total_cost_with_fees INTEGER,                    -- Total cost including all fees
ADD COLUMN created_by UUID REFERENCES auth.users(id),       -- Who created this pricing
ADD COLUMN notes TEXT;                                      -- Notes about pricing changes

-- Add comments
COMMENT ON COLUMN public.product_pricing.effective_date IS 'When this pricing becomes effective';
COMMENT ON COLUMN public.product_pricing.end_date IS 'When this pricing expires (NULL = current)';
COMMENT ON COLUMN public.product_pricing.is_current IS 'Whether this is the current active pricing';
COMMENT ON COLUMN public.product_pricing.ai_generation_cost IS 'AI generation cost in cents';
COMMENT ON COLUMN public.product_pricing.total_cost_with_fees IS 'Total cost including processing fees and commissions';

-- Create indexes for efficient date-based queries
CREATE INDEX idx_product_pricing_effective_date ON public.product_pricing(effective_date);
CREATE INDEX idx_product_pricing_current ON public.product_pricing(is_current) WHERE is_current = true;
CREATE INDEX idx_product_pricing_product_date ON public.product_pricing(product_id, effective_date);

-- =============================================================================
-- STEP 2: Add cost capture fields to order_items
-- =============================================================================

-- Add fields to capture actual costs at time of order
ALTER TABLE public.order_items
ADD COLUMN captured_product_cost INTEGER DEFAULT 0,         -- Product cost at time of sale (cents)
ADD COLUMN captured_shipping_cost INTEGER DEFAULT 0,        -- Shipping cost at time of sale (cents)  
ADD COLUMN captured_ai_cost INTEGER DEFAULT 0,              -- AI generation cost at time of sale (cents)
ADD COLUMN captured_processing_fee INTEGER DEFAULT 0,       -- Payment processing fee (cents)
ADD COLUMN captured_commission_rate DECIMAL(5,4) DEFAULT 0, -- Commission rate applied
ADD COLUMN captured_commission_amount INTEGER DEFAULT 0,    -- Commission amount (cents)
ADD COLUMN captured_total_cost INTEGER DEFAULT 0,           -- Total cost for this item (cents)
ADD COLUMN captured_gross_profit INTEGER DEFAULT 0,         -- Gross profit: price - total_cost
ADD COLUMN cost_captured_at TIMESTAMP DEFAULT NOW(),        -- When costs were captured
ADD COLUMN pricing_snapshot_id UUID;                        -- Reference to pricing used

-- Add comments
COMMENT ON COLUMN public.order_items.captured_product_cost IS 'Product cost captured at time of sale in cents';
COMMENT ON COLUMN public.order_items.captured_total_cost IS 'Total cost captured at time of sale in cents';
COMMENT ON COLUMN public.order_items.captured_gross_profit IS 'Gross profit calculated at time of sale';

-- =============================================================================
-- STEP 3: Create function to get pricing at specific date
-- =============================================================================

CREATE OR REPLACE FUNCTION get_product_pricing_at_date(
    product_uuid UUID,
    country_code TEXT,
    pricing_date TIMESTAMP DEFAULT NOW()
)
RETURNS TABLE(
    id UUID,
    product_cost INTEGER,
    shipping_cost INTEGER,
    ai_generation_cost INTEGER,
    sale_price INTEGER,
    processing_fee_percent DECIMAL(5,4),
    total_cost_with_fees INTEGER,
    profit_amount INTEGER,
    effective_date TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pp.id,
        pp.product_cost,
        pp.shipping_cost,
        pp.ai_generation_cost,
        pp.sale_price,
        pp.processing_fee_percent,
        pp.total_cost_with_fees,
        pp.profit_amount,
        pp.effective_date
    FROM product_pricing pp
    WHERE pp.product_id = product_uuid
      AND pp.country_code = country_code
      AND pp.effective_date <= pricing_date
      AND (pp.end_date IS NULL OR pp.end_date > pricing_date)
    ORDER BY pp.effective_date DESC
    LIMIT 1;
    
    -- If no pricing found, try to get the most recent pricing
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 
            pp.id,
            pp.product_cost,
            pp.shipping_cost,
            COALESCE(pp.ai_generation_cost, 0) as ai_generation_cost,
            pp.sale_price,
            COALESCE(pp.processing_fee_percent, 0.029) as processing_fee_percent,
            COALESCE(pp.total_cost_with_fees, pp.product_cost + pp.shipping_cost) as total_cost_with_fees,
            pp.profit_amount,
            pp.effective_date
        FROM product_pricing pp
        WHERE pp.product_id = product_uuid
          AND pp.country_code = country_code
        ORDER BY pp.effective_date DESC
        LIMIT 1;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- STEP 4: Create function to capture costs when order is placed
-- =============================================================================

CREATE OR REPLACE FUNCTION capture_order_item_costs(order_item_uuid UUID)
RETURNS VOID AS $$
DECLARE
    item_record RECORD;
    pricing_record RECORD;
    order_record RECORD;
    commission_rate DECIMAL(5,4) := 0;
    processing_fee INTEGER := 0;
    commission_amount INTEGER := 0;
    total_item_cost INTEGER := 0;
    gross_profit INTEGER := 0;
BEGIN
    -- Get order item details
    SELECT oi.*, o.referral_code, o.created_at as order_date, o.total_amount as order_total
    INTO item_record
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE oi.id = order_item_uuid;
    
    -- Get pricing that was effective when order was placed
    SELECT * INTO pricing_record 
    FROM get_product_pricing_at_date(
        item_record.product_id, 
        'US', -- Default to US, could be enhanced to use order country
        item_record.order_date
    );
    
    -- Get commission rate if this was a referral order
    IF item_record.referral_code IS NOT NULL THEN
        SELECT r.commission_rate INTO commission_rate
        FROM referrals r 
        WHERE r.referral_code = item_record.referral_code;
    END IF;
    
    -- Calculate costs for this item
    IF pricing_record.id IS NOT NULL THEN
        -- Calculate processing fee (percentage of item total)
        processing_fee := ((item_record.unit_price * item_record.quantity) * pricing_record.processing_fee_percent)::INTEGER;
        
        -- Calculate commission (percentage of item total)
        commission_amount := ((item_record.unit_price * item_record.quantity) * COALESCE(commission_rate, 0))::INTEGER;
        
        -- Calculate total cost
        total_item_cost := (
            (pricing_record.product_cost * item_record.quantity) +
            (pricing_record.shipping_cost * item_record.quantity) + 
            (pricing_record.ai_generation_cost * item_record.quantity) +
            processing_fee +
            commission_amount
        );
        
        -- Calculate gross profit
        gross_profit := (item_record.unit_price * item_record.quantity) - total_item_cost;
        
        -- Update order item with captured costs
        UPDATE order_items 
        SET 
            captured_product_cost = pricing_record.product_cost * item_record.quantity,
            captured_shipping_cost = pricing_record.shipping_cost * item_record.quantity,
            captured_ai_cost = pricing_record.ai_generation_cost * item_record.quantity,
            captured_processing_fee = processing_fee,
            captured_commission_rate = commission_rate,
            captured_commission_amount = commission_amount,
            captured_total_cost = total_item_cost,
            captured_gross_profit = gross_profit,
            cost_captured_at = NOW(),
            pricing_snapshot_id = pricing_record.id
        WHERE id = order_item_uuid;
        
    ELSE
        -- No pricing found, log warning but don't fail
        RAISE WARNING 'No pricing found for product % at date %', item_record.product_id, item_record.order_date;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- STEP 5: Create function to capture all costs for an order
-- =============================================================================

CREATE OR REPLACE FUNCTION capture_all_order_costs(order_uuid UUID)
RETURNS VOID AS $$
DECLARE
    item_record RECORD;
    total_order_cost INTEGER := 0;
    total_gross_profit INTEGER := 0;
BEGIN
    -- Capture costs for each order item
    FOR item_record IN 
        SELECT id FROM order_items WHERE order_id = order_uuid
    LOOP
        PERFORM capture_order_item_costs(item_record.id);
    END LOOP;
    
    -- Calculate order totals
    SELECT 
        SUM(captured_total_cost),
        SUM(captured_gross_profit)
    INTO total_order_cost, total_gross_profit
    FROM order_items 
    WHERE order_id = order_uuid;
    
    -- Update order with cost summary (if orders table has these fields)
    -- UPDATE orders 
    -- SET 
    --     total_cost = total_order_cost,
    --     total_profit = total_gross_profit
    -- WHERE id = order_uuid;
    
    RAISE NOTICE 'Captured costs for order %: Total Cost = %, Total Profit = %', 
        order_uuid, total_order_cost, total_gross_profit;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- STEP 6: Update existing pricing records with current flag
-- =============================================================================

-- Mark all existing pricing as current (they'll be the only records initially)
UPDATE product_pricing 
SET 
    is_current = true,
    effective_date = COALESCE(created_at, NOW()),
    ai_generation_cost = 250, -- 2.50 in cents, estimated AI cost
    total_cost_with_fees = product_cost + shipping_cost + 250 + (sale_price * 0.029)::INTEGER
WHERE is_current IS NULL;

-- =============================================================================
-- STEP 7: Create view for current pricing
-- =============================================================================

CREATE OR REPLACE VIEW current_product_pricing AS
SELECT 
    pp.*,
    p.name as product_name,
    p.description as product_description,
    c.name as country_name,
    c.currency_symbol
FROM product_pricing pp
JOIN products p ON pp.product_id = p.id
JOIN countries c ON pp.country_code = c.code
WHERE pp.is_current = true;

-- =============================================================================
-- STEP 8: Create trigger to auto-expire old pricing when new pricing is added
-- =============================================================================

CREATE OR REPLACE FUNCTION expire_old_pricing()
RETURNS TRIGGER AS $$
BEGIN
    -- When new pricing is inserted, mark old pricing as expired
    UPDATE product_pricing 
    SET 
        is_current = false,
        end_date = NEW.effective_date
    WHERE product_id = NEW.product_id 
      AND country_code = NEW.country_code
      AND id != NEW.id
      AND is_current = true;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_expire_old_pricing
    AFTER INSERT ON product_pricing
    FOR EACH ROW
    EXECUTE FUNCTION expire_old_pricing();

-- =============================================================================
-- STEP 9: Create functions for financial reporting
-- =============================================================================

-- Function to get profit/loss for a date range using captured costs
CREATE OR REPLACE FUNCTION get_profit_loss_report(
    start_date TIMESTAMP,
    end_date TIMESTAMP
)
RETURNS TABLE(
    total_revenue BIGINT,
    total_costs BIGINT,
    total_profit BIGINT,
    profit_margin DECIMAL(5,2),
    order_count BIGINT,
    avg_order_value DECIMAL(10,2),
    avg_profit_per_order DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        SUM(oi.unit_price * oi.quantity) as total_revenue,
        SUM(COALESCE(oi.captured_total_cost, 0)) as total_costs,
        SUM((oi.unit_price * oi.quantity) - COALESCE(oi.captured_total_cost, 0)) as total_profit,
        CASE 
            WHEN SUM(oi.unit_price * oi.quantity) > 0 THEN
                (SUM((oi.unit_price * oi.quantity) - COALESCE(oi.captured_total_cost, 0))::DECIMAL / SUM(oi.unit_price * oi.quantity)::DECIMAL * 100)
            ELSE 0 
        END as profit_margin,
        COUNT(DISTINCT o.id) as order_count,
        AVG(o.total_amount / 100.0) as avg_order_value,
        AVG((oi.unit_price * oi.quantity - COALESCE(oi.captured_total_cost, 0)) / 100.0) as avg_profit_per_order
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.created_at BETWEEN start_date AND end_date
      AND o.status = 'completed';
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Check new columns were added
SELECT 
    table_name,
    column_name, 
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('product_pricing', 'order_items')
  AND column_name LIKE '%cost%' 
  OR column_name LIKE '%captured%'
  OR column_name LIKE '%effective%'
ORDER BY table_name, ordinal_position;

-- Test pricing function
SELECT * FROM get_product_pricing_at_date(
    (SELECT id FROM products LIMIT 1),
    'US',
    NOW()
);

-- Test profit/loss function  
SELECT * FROM get_profit_loss_report(
    NOW() - INTERVAL '30 days',
    NOW()
);