-- =============================================
-- SIZES AND DIRECT PRICING MIGRATION
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Create sizes table
CREATE TABLE IF NOT EXISTS public.sizes (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  width_cm DECIMAL(10,2) NOT NULL,
  height_cm DECIMAL(10,2) NOT NULL,
  width_inches DECIMAL(10,2),
  height_inches DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT sizes_pkey PRIMARY KEY (id)
);

-- 2. Insert standard sizes
INSERT INTO public.sizes (name, code, width_cm, height_cm, width_inches, height_inches, display_order) VALUES
('Small', 'S', 20.0, 20.0, 8.0, 8.0, 1),
('Medium', 'M', 30.0, 30.0, 12.0, 12.0, 2),
('Large', 'L', 40.0, 40.0, 16.0, 16.0, 3),
('X-Large', 'XL', 50.0, 50.0, 20.0, 20.0, 4)
ON CONFLICT (code) DO NOTHING;

-- 3. Add size_id column to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS size_id UUID REFERENCES public.sizes(id);

-- 4. Add gelato_sku column to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS gelato_sku TEXT;

-- 5. Update unique constraint to include size
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_medium_format_unique;
ALTER TABLE public.products ADD CONSTRAINT IF NOT EXISTS products_medium_format_size_unique UNIQUE (medium_id, format_id, size_id);

-- 6. Update product_pricing table for direct pricing
DROP TABLE IF EXISTS public.product_pricing CASCADE;

CREATE TABLE public.product_pricing (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL REFERENCES public.countries(code),
  
  -- What Gelato charges me (cost prices)
  product_cost INTEGER NOT NULL, -- In minor currency units (pence/cents)
  shipping_cost INTEGER NOT NULL DEFAULT 0, -- What Gelato charges for shipping
  
  -- What I charge customers (sale prices)  
  sale_price INTEGER NOT NULL, -- My selling price to customers
  
  -- Currency info (from countries table, but stored for easy access)
  currency_code TEXT NOT NULL, -- GBP, USD, EUR, etc.
  currency_symbol TEXT NOT NULL, -- £, $, €, etc.
  
  -- Optional sale/discount pricing
  discount_price INTEGER, -- Optional discounted price
  is_on_sale BOOLEAN DEFAULT false,
  sale_start_date TIMESTAMP WITH TIME ZONE,
  sale_end_date TIMESTAMP WITH TIME ZONE,
  
  -- Calculated margins (auto-updated via trigger)
  profit_amount INTEGER, -- sale_price - (product_cost + shipping_cost)
  profit_margin_percent DECIMAL(5,2), -- (profit / sale_price) * 100
  markup_percent DECIMAL(5,2), -- (profit / cost) * 100
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT product_pricing_pkey PRIMARY KEY (id),
  CONSTRAINT product_pricing_product_country_unique UNIQUE (product_id, country_code)
);

-- 7. Create trigger to auto-calculate profit margins
CREATE OR REPLACE FUNCTION calculate_pricing_margins()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate profit and margins
  NEW.profit_amount := NEW.sale_price - (NEW.product_cost + NEW.shipping_cost);
  
  -- Calculate profit margin percentage
  IF NEW.sale_price > 0 THEN
    NEW.profit_margin_percent := (NEW.profit_amount::DECIMAL / NEW.sale_price) * 100;
  ELSE
    NEW.profit_margin_percent := 0;
  END IF;
  
  -- Calculate markup percentage
  IF (NEW.product_cost + NEW.shipping_cost) > 0 THEN
    NEW.markup_percent := (NEW.profit_amount::DECIMAL / (NEW.product_cost + NEW.shipping_cost)) * 100;
  ELSE
    NEW.markup_percent := 0;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_pricing_margins
  BEFORE INSERT OR UPDATE ON public.product_pricing
  FOR EACH ROW
  EXECUTE FUNCTION calculate_pricing_margins();

-- 8. Create indexes
CREATE INDEX IF NOT EXISTS idx_sizes_code ON public.sizes(code);
CREATE INDEX IF NOT EXISTS idx_sizes_active ON public.sizes(is_active);
CREATE INDEX IF NOT EXISTS idx_products_size ON public.products(size_id);
CREATE INDEX IF NOT EXISTS idx_product_pricing_product ON public.product_pricing(product_id);
CREATE INDEX IF NOT EXISTS idx_product_pricing_country ON public.product_pricing(country_code);

-- 9. Enable RLS
ALTER TABLE public.sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_pricing ENABLE ROW LEVEL SECURITY;

-- 10. Create RLS policies for sizes
DROP POLICY IF EXISTS "Public can view active sizes" ON public.sizes;
CREATE POLICY "Public can view active sizes" ON public.sizes FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Service role can manage sizes" ON public.sizes;
CREATE POLICY "Service role can manage sizes" ON public.sizes FOR ALL USING (true);

-- 11. Create RLS policies for pricing
DROP POLICY IF EXISTS "Public can view pricing" ON public.product_pricing;
CREATE POLICY "Public can view pricing" ON public.product_pricing FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage pricing" ON public.product_pricing;
CREATE POLICY "Service role can manage pricing" ON public.product_pricing FOR ALL USING (true);

-- 12. Grant permissions
GRANT SELECT ON public.sizes TO anon, authenticated;
GRANT SELECT ON public.product_pricing TO anon, authenticated;
GRANT ALL ON public.sizes TO service_role;
GRANT ALL ON public.product_pricing TO service_role;

-- 13. Helper function to create product with size
CREATE OR REPLACE FUNCTION create_product_with_size(
  p_medium_id UUID,
  p_format_id UUID,
  p_size_id UUID,
  p_gelato_sku TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
) RETURNS products AS $$
DECLARE
  new_product products;
  medium_name TEXT;
  medium_slug TEXT;
  format_name TEXT;
  size_name TEXT;
  size_code TEXT;
  size_dims TEXT;
  generated_sku TEXT;
  generated_name TEXT;
BEGIN
  -- Get component details
  SELECT 
    m.name, m.slug,
    f.name,
    s.name, s.code, (s.width_cm || 'x' || s.height_cm || 'cm')
  INTO medium_name, medium_slug, format_name, size_name, size_code, size_dims
  FROM media m, formats f, sizes s
  WHERE m.id = p_medium_id AND f.id = p_format_id AND s.id = p_size_id;
  
  -- Generate SKU: CANVAS-SQUARE-S
  generated_sku := UPPER(medium_slug) || '-' || UPPER(REPLACE(format_name, ' ', '-')) || '-' || size_code;
  
  -- Generate name: Canvas Print Square Small (20x20cm)
  generated_name := medium_name || ' ' || format_name || ' ' || size_name || ' (' || size_dims || ')';
  
  INSERT INTO products (
    medium_id, format_id, size_id, sku, name, description, gelato_sku
  ) VALUES (
    p_medium_id, p_format_id, p_size_id, generated_sku, generated_name, p_description, p_gelato_sku
  ) RETURNING * INTO new_product;
  
  RETURN new_product;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. Helper function to set pricing
CREATE OR REPLACE FUNCTION set_product_pricing(
  p_product_id UUID,
  p_country_code TEXT,
  p_product_cost INTEGER, -- What Gelato charges me
  p_shipping_cost INTEGER, -- What Gelato charges for shipping  
  p_sale_price INTEGER -- What I charge customers
) RETURNS product_pricing AS $$
DECLARE
  new_pricing product_pricing;
  country_currency TEXT;
  country_symbol TEXT;
BEGIN
  -- Get country currency info
  SELECT currency_code, currency_symbol
  INTO country_currency, country_symbol
  FROM countries WHERE code = p_country_code;
  
  -- Insert or update pricing
  INSERT INTO product_pricing (
    product_id, country_code, product_cost, shipping_cost, sale_price,
    currency_code, currency_symbol
  ) VALUES (
    p_product_id, p_country_code, p_product_cost, p_shipping_cost, p_sale_price,
    country_currency, country_symbol
  )
  ON CONFLICT (product_id, country_code) 
  DO UPDATE SET
    product_cost = EXCLUDED.product_cost,
    shipping_cost = EXCLUDED.shipping_cost,
    sale_price = EXCLUDED.sale_price,
    updated_at = now()
  RETURNING * INTO new_pricing;
  
  RETURN new_pricing;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION create_product_with_size TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION set_product_pricing TO authenticated, service_role;

-- Success message
SELECT 'Sizes and direct pricing migration completed successfully!' as status;

-- Example usage (commented out):
/*
-- 1. Create a product: Canvas Square Small
SELECT create_product_with_size(
  (SELECT id FROM media WHERE slug = 'canvas-print'),
  (SELECT id FROM formats WHERE name = 'Square'), 
  (SELECT id FROM sizes WHERE code = 'S'),
  'gelato_canvas_square_small_12345'
);

-- 2. Set UK pricing: Gelato charges £15 + £5 shipping, I charge £35
SELECT set_product_pricing(
  (SELECT id FROM products WHERE sku = 'CANVAS-SQUARE-S'),
  'GB', 1500, 500, 3500
);

-- 3. Set US pricing: Gelato charges $18 + $7 shipping, I charge $45  
SELECT set_product_pricing(
  (SELECT id FROM products WHERE sku = 'CANVAS-SQUARE-S'),
  'US', 1800, 700, 4500
);
*/