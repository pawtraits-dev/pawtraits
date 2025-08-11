-- =============================================
-- Physical Products System Migration
-- =============================================

-- 1. Add sizes and dimensions to formats table
ALTER TABLE public.formats 
ADD COLUMN IF NOT EXISTS size_code TEXT, -- S, M, L, XL, etc.
ADD COLUMN IF NOT EXISTS width_cm DECIMAL(10,2), -- Width in centimeters
ADD COLUMN IF NOT EXISTS height_cm DECIMAL(10,2), -- Height in centimeters
ADD COLUMN IF NOT EXISTS aspect_ratio TEXT, -- e.g., "1:1", "4:3", "16:9"
ADD COLUMN IF NOT EXISTS is_square BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Update existing formats with size information (example data)
UPDATE public.formats SET 
  size_code = 'S',
  width_cm = 20.0,
  height_cm = 20.0,
  aspect_ratio = '1:1',
  is_square = true,
  display_order = 1
WHERE name ILIKE '%small%' OR name ILIKE '%20%';

UPDATE public.formats SET 
  size_code = 'M',
  width_cm = 30.0,
  height_cm = 30.0,
  aspect_ratio = '1:1',
  is_square = true,
  display_order = 2
WHERE name ILIKE '%medium%' OR name ILIKE '%30%';

UPDATE public.formats SET 
  size_code = 'L',
  width_cm = 40.0,
  height_cm = 40.0,
  aspect_ratio = '1:1',
  is_square = true,
  display_order = 3
WHERE name ILIKE '%large%' OR name ILIKE '%40%';

-- Create index for format sizing
CREATE INDEX IF NOT EXISTS idx_formats_size_code ON public.formats(size_code);
CREATE INDEX IF NOT EXISTS idx_formats_display_order ON public.formats(display_order);

-- 2. Create media table for print types
CREATE TABLE IF NOT EXISTS public.media (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- Canvas Print, Framed Print, Acrylic Print, etc.
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT, -- print, canvas, acrylic, metal, etc.
  
  -- Material properties
  material_type TEXT, -- canvas, paper, acrylic, metal, wood
  finish_type TEXT, -- matte, gloss, satin, textured
  thickness_mm DECIMAL(5,2), -- Material thickness
  
  -- Durability and care
  indoor_outdoor TEXT CHECK (indoor_outdoor IN ('indoor', 'outdoor', 'both')),
  uv_resistant BOOLEAN DEFAULT false,
  water_resistant BOOLEAN DEFAULT false,
  care_instructions TEXT,
  
  -- Availability and pricing
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  gelato_category TEXT, -- Gelato API category identifier
  base_cost_multiplier DECIMAL(4,2) DEFAULT 1.0, -- Cost multiplier vs base price
  
  -- SEO and display
  meta_title TEXT,
  meta_description TEXT,
  preview_image_url TEXT,
  display_order INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT media_pkey PRIMARY KEY (id)
);

-- Insert default media types
INSERT INTO public.media (name, slug, description, category, material_type, finish_type, thickness_mm, indoor_outdoor, uv_resistant, water_resistant, care_instructions, gelato_category, base_cost_multiplier, display_order) VALUES
('Canvas Print', 'canvas-print', 'Premium canvas print with gallery wrap finish', 'canvas', 'canvas', 'matte', 2.0, 'indoor', false, false, 'Dust gently with soft cloth. Avoid direct sunlight.', 'canvas', 1.0, 1),
('Framed Print', 'framed-print', 'High-quality print in elegant black or white frame', 'framed', 'paper', 'matte', 1.5, 'indoor', false, false, 'Clean frame with damp cloth. Print protected behind glass.', 'framed', 1.3, 2),
('Acrylic Print', 'acrylic-print', 'Vibrant colors on crystal-clear acrylic with floating mount', 'acrylic', 'acrylic', 'gloss', 4.0, 'both', true, true, 'Clean with microfiber cloth and glass cleaner.', 'acrylic', 1.8, 3),
('Metal Print', 'metal-print', 'Durable aluminum print with vibrant HD colors', 'metal', 'aluminum', 'gloss', 1.2, 'both', true, true, 'Clean with damp cloth. Scratch resistant surface.', 'metal', 1.6, 4),
('Premium Paper Print', 'premium-paper', 'Museum-quality paper print with archival inks', 'paper', 'paper', 'matte', 0.3, 'indoor', false, false, 'Frame recommended. Handle with clean hands only.', 'paper', 0.7, 5);

-- Create indexes for media
CREATE INDEX IF NOT EXISTS idx_media_slug ON public.media(slug);
CREATE INDEX IF NOT EXISTS idx_media_category ON public.media(category);
CREATE INDEX IF NOT EXISTS idx_media_is_active ON public.media(is_active);
CREATE INDEX IF NOT EXISTS idx_media_display_order ON public.media(display_order);

-- 3. Create products table combining medium + format + size
CREATE TABLE IF NOT EXISTS public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  
  -- Product composition
  medium_id UUID NOT NULL REFERENCES public.media(id),
  format_id UUID NOT NULL REFERENCES public.formats(id),
  
  -- Product identification
  sku TEXT NOT NULL UNIQUE, -- Generated: CANVAS-SQUARE-M, FRAME-LANDSCAPE-L
  name TEXT NOT NULL, -- Auto-generated: Canvas Print - Square Medium (30x30cm)
  description TEXT,
  
  -- Gelato integration
  gelato_product_id TEXT, -- Gelato's product identifier
  gelato_variant_id TEXT, -- Specific variant within Gelato
  
  -- Availability
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  stock_status TEXT DEFAULT 'in_stock' CHECK (stock_status IN ('in_stock', 'low_stock', 'out_of_stock', 'discontinued')),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_medium_format_unique UNIQUE (medium_id, format_id)
);

-- 4. Create product pricing table (country-specific)
CREATE TABLE IF NOT EXISTS public.product_pricing (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  
  -- Geographic pricing
  country_code TEXT NOT NULL DEFAULT 'GB', -- ISO 3166-1 alpha-2
  currency_code TEXT NOT NULL DEFAULT 'GBP', -- ISO 4217
  
  -- Costs and pricing (in minor currency units: pence, cents, etc.)
  base_cost INTEGER NOT NULL, -- What we pay (in pence/cents)
  shipping_cost INTEGER NOT NULL DEFAULT 0, -- Shipping cost (in pence/cents)
  retail_price INTEGER NOT NULL, -- What customer pays (in pence/cents)
  
  -- Discounts and promotions
  sale_price INTEGER, -- Optional sale price
  is_on_sale BOOLEAN DEFAULT false,
  sale_start_date TIMESTAMP WITH TIME ZONE,
  sale_end_date TIMESTAMP WITH TIME ZONE,
  
  -- Margins
  profit_margin_percent DECIMAL(5,2), -- Calculated field
  markup_percent DECIMAL(5,2), -- Calculated field
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT product_pricing_pkey PRIMARY KEY (id),
  CONSTRAINT product_pricing_product_country_unique UNIQUE (product_id, country_code)
);

-- 5. Create countries reference table
CREATE TABLE IF NOT EXISTS public.countries (
  code TEXT NOT NULL PRIMARY KEY, -- ISO 3166-1 alpha-2
  name TEXT NOT NULL,
  currency_code TEXT NOT NULL, -- ISO 4217
  currency_symbol TEXT NOT NULL,
  is_supported BOOLEAN DEFAULT true,
  shipping_zone TEXT, -- For grouping shipping rates
  tax_rate_percent DECIMAL(5,2) DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert supported countries (starting with UK and common markets)
INSERT INTO public.countries (code, name, currency_code, currency_symbol, is_supported, shipping_zone, tax_rate_percent, display_order) VALUES
('GB', 'United Kingdom', 'GBP', '£', true, 'domestic', 20.0, 1),
('US', 'United States', 'USD', '$', true, 'international', 0.0, 2),
('CA', 'Canada', 'CAD', 'C$', true, 'international', 0.0, 3),
('AU', 'Australia', 'AUD', 'A$', true, 'international', 10.0, 4),
('DE', 'Germany', 'EUR', '€', true, 'eu', 19.0, 5),
('FR', 'France', 'EUR', '€', true, 'eu', 20.0, 6),
('ES', 'Spain', 'EUR', '€', true, 'eu', 21.0, 7),
('IT', 'Italy', 'EUR', '€', true, 'eu', 22.0, 8),
('NL', 'Netherlands', 'EUR', '€', true, 'eu', 21.0, 9);

-- Create indexes for pricing and countries
CREATE INDEX IF NOT EXISTS idx_product_pricing_product_id ON public.product_pricing(product_id);
CREATE INDEX IF NOT EXISTS idx_product_pricing_country ON public.product_pricing(country_code);
CREATE INDEX IF NOT EXISTS idx_countries_is_supported ON public.countries(is_supported);

-- 6. Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_media_updated_at
  BEFORE UPDATE ON public.media
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_product_pricing_updated_at
  BEFORE UPDATE ON public.product_pricing
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 7. Create RLS policies
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;

-- Media policies (public read, admin write)
CREATE POLICY "Public can view active media" ON public.media FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage media" ON public.media FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND user_type = 'admin')
);

-- Products policies (public read, admin write)
CREATE POLICY "Public can view active products" ON public.products FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage products" ON public.products FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND user_type = 'admin')
);

-- Pricing policies (public read for supported countries, admin write)
CREATE POLICY "Public can view pricing for supported countries" ON public.product_pricing FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.countries WHERE code = country_code AND is_supported = true)
);
CREATE POLICY "Admins can manage pricing" ON public.product_pricing FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND user_type = 'admin')
);

-- Countries policies (public read)
CREATE POLICY "Public can view supported countries" ON public.countries FOR SELECT USING (is_supported = true);
CREATE POLICY "Admins can manage countries" ON public.countries FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND user_type = 'admin')
);

-- 8. Helper functions
-- Function to generate SKU automatically
CREATE OR REPLACE FUNCTION generate_product_sku(p_medium_id UUID, p_format_id UUID)
RETURNS TEXT AS $$
DECLARE
  medium_slug TEXT;
  format_name TEXT;
  size_code TEXT;
  sku TEXT;
BEGIN
  SELECT m.slug, f.name, f.size_code
  INTO medium_slug, format_name, size_code
  FROM public.media m, public.formats f
  WHERE m.id = p_medium_id AND f.id = p_format_id;
  
  -- Generate SKU: CANVAS-SQUARE-M
  sku := UPPER(medium_slug) || '-' || UPPER(REPLACE(format_name, ' ', '-'));
  IF size_code IS NOT NULL THEN
    sku := sku || '-' || UPPER(size_code);
  END IF;
  
  RETURN sku;
END;
$$ LANGUAGE plpgsql;

-- Function to generate product name automatically
CREATE OR REPLACE FUNCTION generate_product_name(p_medium_id UUID, p_format_id UUID)
RETURNS TEXT AS $$
DECLARE
  medium_name TEXT;
  format_name TEXT;
  width_cm DECIMAL;
  height_cm DECIMAL;
  product_name TEXT;
BEGIN
  SELECT 
    m.name,
    f.name,
    f.width_cm,
    f.height_cm
  INTO medium_name, format_name, width_cm, height_cm
  FROM public.media m, public.formats f
  WHERE m.id = p_medium_id AND f.id = p_format_id;
  
  product_name := medium_name || ' - ' || format_name;
  
  IF width_cm IS NOT NULL AND height_cm IS NOT NULL THEN
    product_name := product_name || ' (' || width_cm || 'x' || height_cm || 'cm)';
  END IF;
  
  RETURN product_name;
END;
$$ LANGUAGE plpgsql;

-- Function to create product with auto-generated fields
CREATE OR REPLACE FUNCTION create_product(
  p_medium_id UUID,
  p_format_id UUID,
  p_gelato_product_id TEXT DEFAULT NULL,
  p_gelato_variant_id TEXT DEFAULT NULL
) RETURNS products AS $$
DECLARE
  new_product products;
  generated_sku TEXT;
  generated_name TEXT;
BEGIN
  -- Generate SKU and name
  generated_sku := generate_product_sku(p_medium_id, p_format_id);
  generated_name := generate_product_name(p_medium_id, p_format_id);
  
  INSERT INTO public.products (
    medium_id,
    format_id,
    sku,
    name,
    gelato_product_id,
    gelato_variant_id
  ) VALUES (
    p_medium_id,
    p_format_id,
    generated_sku,
    generated_name,
    p_gelato_product_id,
    p_gelato_variant_id
  ) RETURNING * INTO new_product;
  
  RETURN new_product;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION generate_product_sku TO authenticated;
GRANT EXECUTE ON FUNCTION generate_product_name TO authenticated;
GRANT EXECUTE ON FUNCTION create_product TO authenticated;

COMMENT ON TABLE public.media IS 'Print media types (canvas, framed, acrylic, etc.)';
COMMENT ON TABLE public.products IS 'Products combining media type and format/size';
COMMENT ON TABLE public.product_pricing IS 'Country-specific pricing for products';
COMMENT ON TABLE public.countries IS 'Supported countries with currency and tax info';
COMMENT ON FUNCTION create_product IS 'Create product with auto-generated SKU and name';