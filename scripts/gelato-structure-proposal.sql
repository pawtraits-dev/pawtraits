-- =============================================
-- Improved Product System for Gelato Integration
-- =============================================

-- 1. Create separate sizes table
CREATE TABLE IF NOT EXISTS public.sizes (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- "Small", "Medium", "Large", "X-Large"
  code TEXT NOT NULL UNIQUE, -- "S", "M", "L", "XL"
  width_cm DECIMAL(10,2) NOT NULL,
  height_cm DECIMAL(10,2) NOT NULL,
  aspect_ratio TEXT, -- "1:1", "4:3", "16:9"
  is_square BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT sizes_pkey PRIMARY KEY (id)
);

-- Insert common sizes
INSERT INTO public.sizes (name, code, width_cm, height_cm, aspect_ratio, is_square, display_order) VALUES
('Small', 'S', 20.0, 20.0, '1:1', true, 1),
('Medium', 'M', 30.0, 30.0, '1:1', true, 2),
('Large', 'L', 40.0, 40.0, '1:1', true, 3),
('X-Large', 'XL', 50.0, 50.0, '1:1', true, 4),
('Small Rectangle', 'SR', 20.0, 30.0, '2:3', false, 5),
('Medium Rectangle', 'MR', 30.0, 40.0, '3:4', false, 6),
('Large Rectangle', 'LR', 40.0, 60.0, '2:3', false, 7);

-- 2. Update products table structure
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_medium_format_unique;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS size_id UUID REFERENCES public.sizes(id);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS base_price_gbp INTEGER; -- Base price in pence
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS gelato_sku TEXT; -- Gelato's SKU for this exact combination

-- Update unique constraint to include size
ALTER TABLE public.products 
ADD CONSTRAINT products_medium_format_size_unique UNIQUE (medium_id, format_id, size_id);

-- 3. Simplify product_pricing for country adjustments only
-- Instead of full pricing per country, just store adjustments/multipliers
CREATE TABLE IF NOT EXISTS public.country_pricing_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL REFERENCES public.countries(code),
  currency_multiplier DECIMAL(8,4) DEFAULT 1.0, -- GBP to local currency
  price_adjustment_percent DECIMAL(5,2) DEFAULT 0, -- +/- percentage adjustment
  shipping_cost_local INTEGER DEFAULT 0, -- Shipping in local currency minor units
  tax_rate_percent DECIMAL(5,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT country_pricing_adjustments_pkey PRIMARY KEY (id),
  CONSTRAINT country_pricing_adjustments_country_unique UNIQUE (country_code)
);

-- Insert default country adjustments
INSERT INTO public.country_pricing_adjustments (country_code, currency_multiplier, shipping_cost_local, tax_rate_percent) VALUES
('GB', 1.0, 500, 20.0),      -- £5.00 shipping, 20% VAT
('US', 1.25, 699, 0.0),      -- $6.99 shipping, no tax
('CA', 1.65, 899, 0.0),      -- C$8.99 shipping
('AU', 1.85, 999, 10.0),     -- A$9.99 shipping, 10% GST
('DE', 1.15, 590, 19.0),     -- €5.90 shipping, 19% VAT
('FR', 1.15, 590, 20.0),     -- €5.90 shipping, 20% VAT
('ES', 1.15, 590, 21.0),     -- €5.90 shipping, 21% VAT
('IT', 1.15, 590, 22.0),     -- €5.90 shipping, 22% VAT
('NL', 1.15, 590, 21.0);     -- €5.90 shipping, 21% VAT

-- 4. Helper function to calculate final price for any country
CREATE OR REPLACE FUNCTION calculate_product_price(
  p_product_id UUID,
  p_country_code TEXT DEFAULT 'GB'
) RETURNS TABLE(
  base_price_local INTEGER,
  shipping_cost INTEGER,
  tax_amount INTEGER,
  total_price INTEGER,
  currency_code TEXT,
  currency_symbol TEXT
) AS $$
DECLARE
  product_base_price INTEGER;
  country_multiplier DECIMAL;
  price_adjustment DECIMAL;
  shipping_local INTEGER;
  tax_rate DECIMAL;
  country_currency TEXT;
  country_symbol TEXT;
  adjusted_price INTEGER;
BEGIN
  -- Get product base price
  SELECT p.base_price_gbp INTO product_base_price
  FROM products p WHERE p.id = p_product_id;
  
  -- Get country adjustments
  SELECT 
    cpa.currency_multiplier,
    cpa.price_adjustment_percent,
    cpa.shipping_cost_local,
    cpa.tax_rate_percent,
    c.currency_code,
    c.currency_symbol
  INTO country_multiplier, price_adjustment, shipping_local, tax_rate, country_currency, country_symbol
  FROM country_pricing_adjustments cpa
  JOIN countries c ON c.code = cpa.country_code
  WHERE cpa.country_code = p_country_code;
  
  -- Calculate adjusted price
  adjusted_price := ROUND(product_base_price * country_multiplier * (1 + price_adjustment/100));
  
  RETURN QUERY SELECT
    adjusted_price as base_price_local,
    shipping_local as shipping_cost,
    ROUND(adjusted_price * tax_rate / 100) as tax_amount,
    adjusted_price + shipping_local + ROUND(adjusted_price * tax_rate / 100) as total_price,
    country_currency as currency_code,
    country_symbol as currency_symbol;
END;
$$ LANGUAGE plpgsql;

-- 5. Updated product creation function
CREATE OR REPLACE FUNCTION create_gelato_product(
  p_medium_id UUID,
  p_format_id UUID,
  p_size_id UUID,
  p_base_price_gbp INTEGER,
  p_gelato_sku TEXT DEFAULT NULL
) RETURNS products AS $$
DECLARE
  new_product products;
  medium_slug TEXT;
  format_name TEXT;
  size_code TEXT;
  size_dims TEXT;
  generated_sku TEXT;
  generated_name TEXT;
BEGIN
  -- Get component details
  SELECT m.slug, f.name, s.code, (s.width_cm || 'x' || s.height_cm || 'cm')
  INTO medium_slug, format_name, size_code, size_dims
  FROM media m, formats f, sizes s
  WHERE m.id = p_medium_id AND f.id = p_format_id AND s.id = p_size_id;
  
  -- Generate SKU: CANVAS-PORTRAIT-M
  generated_sku := UPPER(medium_slug) || '-' || UPPER(REPLACE(format_name, ' ', '-')) || '-' || size_code;
  
  -- Generate name: Canvas Print - Portrait Medium (30x40cm)
  generated_name := (SELECT name FROM media WHERE id = p_medium_id) || 
                   ' - ' || format_name || ' ' || 
                   (SELECT name FROM sizes WHERE id = p_size_id) || 
                   ' (' || size_dims || ')';
  
  INSERT INTO products (
    medium_id, format_id, size_id, sku, name, 
    base_price_gbp, gelato_sku
  ) VALUES (
    p_medium_id, p_format_id, p_size_id, generated_sku, generated_name,
    p_base_price_gbp, p_gelato_sku
  ) RETURNING * INTO new_product;
  
  RETURN new_product;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE sizes IS 'Print sizes with dimensions (separate from formats)';
COMMENT ON TABLE country_pricing_adjustments IS 'Country-specific pricing multipliers and adjustments';
COMMENT ON FUNCTION calculate_product_price IS 'Calculate final price for product in any supported country';
COMMENT ON FUNCTION create_gelato_product IS 'Create product with medium + format + size + base price';