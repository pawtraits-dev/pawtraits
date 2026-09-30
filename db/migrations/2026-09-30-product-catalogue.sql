-- =============================================================================
-- Product catalogue for self-print: products by shape family, UK price on the product,
-- optional Gelato SKUs. Seeds a starter range (Foamex S/M/L + digital download).
-- Spec: docs/specs/product-catalogue.md
-- Safe to re-run.
-- =============================================================================
BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Products: shape family instead of one format per product
--    rect_2x3 → offered on portrait 2:3 AND landscape 3:2 designs (printed turned to match)
--    square   → 1:1 designs
--    wide     → 2:1 designs (mugs)
--    any      → every design (digital downloads)
-- -----------------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS shape_family text,
  ADD COLUMN IF NOT EXISTS gelato_sku_landscape text,
  ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_shape_family_check;
ALTER TABLE public.products ADD CONSTRAINT products_shape_family_check
  CHECK (shape_family IS NULL OR shape_family IN ('rect_2x3', 'square', 'wide', 'any'));

-- A family product isn't tied to one format any more
ALTER TABLE public.products ALTER COLUMN format_id DROP NOT NULL;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_format_or_family;
ALTER TABLE public.products ADD CONSTRAINT products_format_or_family
  CHECK (format_id IS NOT NULL OR shape_family IS NOT NULL);

-- Self-print is the default now; gelato_sku is optional (used only by "Send to Gelato")
ALTER TABLE public.products ALTER COLUMN fulfillment_method SET DEFAULT 'manual';

COMMENT ON COLUMN public.products.width_cm IS 'Width as printed for a PORTRAIT design (landscape designs print turned: width and height swap)';
COMMENT ON COLUMN public.products.gelato_sku IS 'Optional Gelato product UID (portrait / square) for "Send to Gelato"';
COMMENT ON COLUMN public.products.gelato_sku_landscape IS 'Optional Gelato product UID for landscape designs, if Gelato uses a different UID';

-- -----------------------------------------------------------------------------
-- 2. Starter range. Prices can be changed in /admin/products; unit costs start at 0 —
--    fill them in there to see your margin.
-- -----------------------------------------------------------------------------
INSERT INTO public.media (name, slug, description, category, material_type, finish_type, thickness_mm, indoor_outdoor, is_active, display_order)
VALUES
  ('Foamex', 'foamex', 'UV-printed on 3 mm rigid foamex board — light, ready to lean or hang', 'rigid', 'pvc_foam', 'matt', 3, 'indoor', true, 1),
  ('Digital', 'digital', 'High-resolution digital file', 'digital', NULL, NULL, NULL, NULL, true, 99)
ON CONFLICT (slug) DO NOTHING;

WITH m AS (SELECT id, slug FROM public.media WHERE slug IN ('foamex', 'digital')),
seed(sku, slug, name, size_name, size_code, w, h, product_type, family, fulfilment, needs_shipping, price, ord, description) AS (VALUES
  ('FOAMEX-S', 'foamex', 'Foamex Small',  'Small',  'S', 15::numeric, 20::numeric, 'physical_print', 'rect_2x3', 'manual', true, 2500, 10, 'Small foamex print'),
  ('FOAMEX-M', 'foamex', 'Foamex Medium', 'Medium', 'M', 20, 30, 'physical_print', 'rect_2x3', 'manual', true, 3500, 20, 'Medium foamex print'),
  ('FOAMEX-L', 'foamex', 'Foamex Large',  'Large',  'L', 30, 40, 'physical_print', 'rect_2x3', 'manual', true, 5000, 30, 'Large foamex print'),
  ('DIGITAL',  'digital', 'Digital download', 'Digital', 'D', NULL, NULL, 'digital_download', 'any', 'download', false, 999, 0, 'High-resolution digital download')
),
ins AS (
  INSERT INTO public.products (sku, name, description, medium_id, format_id, shape_family, size_name, size_code, width_cm, height_cm,
                               product_type, fulfillment_method, requires_shipping, is_active, display_order,
                               digital_file_type, license_type)
  SELECT s.sku, s.name, s.description, m.id, NULL, s.family, s.size_name, s.size_code, s.w, s.h,
         s.product_type, s.fulfilment, s.needs_shipping, true, s.ord,
         CASE WHEN s.product_type = 'digital_download' THEN 'jpg' END,
         CASE WHEN s.product_type = 'digital_download' THEN 'personal' END
  FROM seed s JOIN m ON m.slug = s.slug
  ON CONFLICT (sku) DO NOTHING
  RETURNING id, sku
)
INSERT INTO public.product_pricing (product_id, country_code, product_cost, shipping_cost, sale_price, currency_code, currency_symbol, is_current, notes)
SELECT ins.id, 'GB', 0, 0, s.price, 'GBP', '£', true, 'Starter range'
FROM ins JOIN seed s ON s.sku = ins.sku;

COMMIT;

-- =============================================================================
-- ROLLBACK (manual)
-- =============================================================================
-- BEGIN;
-- DELETE FROM public.product_pricing WHERE product_id IN (SELECT id FROM public.products WHERE sku IN ('FOAMEX-S','FOAMEX-M','FOAMEX-L','DIGITAL'));
-- DELETE FROM public.products WHERE sku IN ('FOAMEX-S','FOAMEX-M','FOAMEX-L','DIGITAL');
-- ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_format_or_family, DROP CONSTRAINT IF EXISTS products_shape_family_check;
-- -- (format_id can only be made NOT NULL again once every product has one)
-- ALTER TABLE public.products DROP COLUMN IF EXISTS shape_family, DROP COLUMN IF EXISTS gelato_sku_landscape, DROP COLUMN IF EXISTS display_order;
-- COMMIT;
