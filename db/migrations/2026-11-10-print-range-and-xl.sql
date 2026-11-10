-- =============================================================================
-- Migration: the full print range from the stall price list, and XL at the stall
-- Date: 2026-11-10 · Safe to re-run.
--
--                 S 15x20   M 20x30   L 30x40   XL 40x60
--   Art paper       £15       £20       £25       £30
--   Foamex          £20       £30       £40       £50   (S/M/L exist as FOAM-PRINT-*; adds XL)
--   Wood frame      £30       £40       £50       £65
--   Acrylic block    –        £50       £65       £80
--
-- Offered on portrait & landscape designs (rect_2x3), posted (self-print queue). Unit costs start
-- at 0: fill them in on /admin/products to see margins. Also lets stall stickers and the stall
-- "take it home" price cover XL.
-- =============================================================================
BEGIN;

-- Materials (the three new ones may already exist: created from the admin on 10 Nov)
INSERT INTO public.media (name, slug, description, category, material_type, finish_type, indoor_outdoor, is_active, display_order)
SELECT v.name, v.slug, v.description, v.category, v.material_type, v.finish_type, 'indoor', true, v.ord
FROM (VALUES
  ('Art Paper', 'art-paper', 'Fine art paper print', 'paper', 'paper', 'matte', 5),
  ('Wood Frame', 'wood-frame', 'Art print in a wooden frame', 'framed', 'paper', 'matte', 6),
  ('Acrylic Block', 'acrylic-block', 'Freestanding acrylic block', 'acrylic', 'acrylic', 'gloss', 7)
) AS v(name, slug, description, category, material_type, finish_type, ord)
WHERE NOT EXISTS (SELECT 1 FROM public.media m WHERE m.slug = v.slug);

WITH seed(slug, sku, name, description, size_name, size_code, w, h, price, ord) AS (VALUES
  ('foam-print',    'FOAM-PRINT-XL',    'Foam Print Extra Large',    'Extra large foamex print',               'Extra Large', 'XL', 40, 60, 5000,  40),
  ('art-paper',     'ART-PAPER-S',      'Art Paper Small',           'Art paper print, 15×20 cm',              'Small',       'S',  15, 20, 1500, 110),
  ('art-paper',     'ART-PAPER-M',      'Art Paper Medium',          'Art paper print, 20×30 cm',              'Medium',      'M',  20, 30, 2000, 120),
  ('art-paper',     'ART-PAPER-L',      'Art Paper Large',           'Art paper print, 30×40 cm',              'Large',       'L',  30, 40, 2500, 130),
  ('art-paper',     'ART-PAPER-XL',     'Art Paper Extra Large',     'Art paper print, 40×60 cm',              'Extra Large', 'XL', 40, 60, 3000, 140),
  ('wood-frame',    'WOOD-FRAME-S',     'Wood Frame Small',          'Art print in a wooden frame, 15×20 cm',  'Small',       'S',  15, 20, 3000, 210),
  ('wood-frame',    'WOOD-FRAME-M',     'Wood Frame Medium',         'Art print in a wooden frame, 20×30 cm',  'Medium',      'M',  20, 30, 4000, 220),
  ('wood-frame',    'WOOD-FRAME-L',     'Wood Frame Large',          'Art print in a wooden frame, 30×40 cm',  'Large',       'L',  30, 40, 5000, 230),
  ('wood-frame',    'WOOD-FRAME-XL',    'Wood Frame Extra Large',    'Art print in a wooden frame, 40×60 cm',  'Extra Large', 'XL', 40, 60, 6500, 240),
  ('acrylic-block', 'ACRYLIC-BLOCK-M',  'Acrylic Block Medium',      'Freestanding acrylic block, 20×30 cm',   'Medium',      'M',  20, 30, 5000, 320),
  ('acrylic-block', 'ACRYLIC-BLOCK-L',  'Acrylic Block Large',       'Freestanding acrylic block, 30×40 cm',   'Large',       'L',  30, 40, 6500, 330),
  ('acrylic-block', 'ACRYLIC-BLOCK-XL', 'Acrylic Block Extra Large', 'Freestanding acrylic block, 40×60 cm',   'Extra Large', 'XL', 40, 60, 8000, 340)
),
m AS (SELECT DISTINCT ON (slug) id, slug FROM public.media WHERE slug IN (SELECT slug FROM seed) ORDER BY slug, created_at),
ins AS (
  INSERT INTO public.products (sku, name, description, medium_id, format_id, shape_family, size_name, size_code,
                               width_cm, height_cm, width_inches, height_inches,
                               product_type, fulfillment_method, requires_shipping, is_active, display_order)
  SELECT s.sku, s.name, s.description, m.id, NULL, 'rect_2x3', s.size_name, s.size_code,
         s.w, s.h, round(s.w / 2.54, 1), round(s.h / 2.54, 1),
         'physical_print', 'manual', true, true, s.ord
  FROM seed s JOIN m ON m.slug = s.slug
  ON CONFLICT (sku) DO NOTHING
  RETURNING id, sku
)
INSERT INTO public.product_pricing (product_id, country_code, product_cost, shipping_cost, sale_price, currency_code, currency_symbol, is_current, notes)
SELECT ins.id, 'GB', 0, 0, s.price, 'GBP', '£', true, 'Stall price list, Nov 2026'
FROM ins JOIN seed s ON s.sku = ins.sku;

-- XL at the stall: sticker scans can carry XL, and the take-home price list has one
ALTER TABLE public.qr_scans DROP CONSTRAINT IF EXISTS qr_scans_size_code_check;
ALTER TABLE public.qr_scans ADD CONSTRAINT qr_scans_size_code_check CHECK (size_code IS NULL OR size_code IN ('S','M','L','XL'));
UPDATE public.app_settings SET value = value || '{"XL": 5000}'::jsonb, updated_at = now()
WHERE key = 'stall_prices_pence' AND NOT (value ? 'XL');
INSERT INTO public.app_settings (key, value, description)
VALUES ('stall_prices_pence', '{"S": 2000, "M": 3000, "L": 4000, "XL": 5000}'::jsonb, 'Stall take-home prices (pence)')
ON CONFLICT (key) DO NOTHING;

COMMIT;

-- Rollback (manual):
-- DELETE FROM public.product_pricing WHERE product_id IN (SELECT id FROM public.products WHERE sku IN
--   ('FOAM-PRINT-XL','ART-PAPER-S','ART-PAPER-M','ART-PAPER-L','ART-PAPER-XL','WOOD-FRAME-S','WOOD-FRAME-M','WOOD-FRAME-L','WOOD-FRAME-XL','ACRYLIC-BLOCK-M','ACRYLIC-BLOCK-L','ACRYLIC-BLOCK-XL'));
-- DELETE FROM public.products WHERE sku IN (... same list ...);
-- UPDATE public.app_settings SET value = value - 'XL' WHERE key = 'stall_prices_pence';
