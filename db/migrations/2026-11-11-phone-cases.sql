-- =============================================================================
-- Migration: phone cases (Gelato, slim glossy wrap), phase 1: data
-- Date: 2026-11-11 · Safe to re-run. Plan: claude/phone-cases-plan.md (project doc)
--
-- phone_layout_groups  camera cut-out shapes, as rounded boxes in mm from the case's top-left corner,
--                      measured from Gelato's design studio (about ±1 mm). One case-art extension per
--                      design per group.
-- phone_models         the 18 models: Gelato productUid, slim case size, layout group
-- products             one "Phone Case · <model>" product each, £24.99, fulfilled by Gelato.
--                      Shape family 'phone' (never matched to a design format: offered only through
--                      the phone-case flow). Created INACTIVE: switched on at launch (phase 3).
-- =============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.phone_layout_groups (
  id          text PRIMARY KEY,                 -- 'A'..'E'
  label       text NOT NULL,
  camera      jsonb NOT NULL,                   -- [{x,y,w,h,r}] mm from the top-left corner
  notes       text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.phone_models (
  id             text PRIMARY KEY,              -- Gelato model key, e.g. 'iphone-16promax'
  brand          text NOT NULL CHECK (brand IN ('apple', 'samsung')),
  name           text NOT NULL,                 -- 'iPhone 16 Pro Max'
  layout_group   text NOT NULL REFERENCES public.phone_layout_groups(id),
  group_verified boolean NOT NULL DEFAULT false, -- camera measured on this model (else assumed from its group)
  gelato_uid     text NOT NULL,
  case_w_mm      numeric(6,2) NOT NULL,
  case_h_mm      numeric(6,2) NOT NULL,
  display_order  integer NOT NULL DEFAULT 0,
  is_active      boolean NOT NULL DEFAULT true,
  product_id     uuid REFERENCES public.products(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_phone_models_group ON public.phone_models(layout_group);

ALTER TABLE public.phone_layout_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_models ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS phone_layout_groups_read ON public.phone_layout_groups;
CREATE POLICY phone_layout_groups_read ON public.phone_layout_groups FOR SELECT USING (true);
DROP POLICY IF EXISTS phone_models_read ON public.phone_models;
CREATE POLICY phone_models_read ON public.phone_models FOR SELECT USING (is_active);

INSERT INTO public.phone_layout_groups (id, label, camera, notes) VALUES
  ('A', 'iPhone Pro / Pro Max: big square island',
   '[{"x":1.5,"y":2.5,"w":45.5,"h":45.8,"r":9}]', 'Measured on 16 Pro and 16 Pro Max'),
  ('B', 'iPhone 16 / 16 Plus: pill and flash',
   '[{"x":1,"y":1.6,"w":27,"h":45,"r":13.5},{"x":20,"y":16,"w":19,"h":15,"r":7.5}]', 'Measured on 16'),
  ('C', 'iPhone 15 / 14: small square island',
   '[{"x":6,"y":6,"w":30,"h":31,"r":7}]', 'Measured on 15'),
  ('D', 'Galaxy Ultra: lens strip and two bumps',
   '[{"x":7,"y":5,"w":21,"h":57,"r":10},{"x":20,"y":8,"w":21,"h":31,"r":9}]', 'Measured on S23 Ultra'),
  ('E', 'Galaxy S22 / S23 / Plus: lens strip and flash',
   '[{"x":2,"y":2,"w":25,"h":55,"r":10},{"x":18,"y":9,"w":16,"h":11,"r":5.5}]', 'Union of S22, S23 and S23 Plus')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.phone_models (id, brand, name, layout_group, group_verified, gelato_uid, case_w_mm, case_h_mm, display_order) VALUES
  ('iphone-16promax', 'apple',   'iPhone 16 Pro Max', 'A', true,  'phonecase_apple_iphone-16promax_slim_white_glossy', 80.36, 165.34, 10),
  ('iphone-16pro',    'apple',   'iPhone 16 Pro',     'A', true,  'phonecase_apple_iphone-16pro_slim_white_glossy',    74.03, 152.04, 20),
  ('iphone-16plus',   'apple',   'iPhone 16 Plus',    'B', false, 'phonecase_apple_iphone-16plus_slim_white_glossy',   80.62, 163.41, 30),
  ('iphone-16',       'apple',   'iPhone 16',         'B', true,  'phonecase_apple_iphone-16_slim_white_glossy',       74.27, 150.18, 40),
  ('iphone-15promax', 'apple',   'iPhone 15 Pro Max', 'A', false, 'phonecase_apple_iphone-15promax_slim_white_glossy', 77.50, 159.90, 50),
  ('iphone-15pro',    'apple',   'iPhone 15 Pro',     'A', false, 'phonecase_apple_iphone-15pro_slim_white_glossy',    71.40, 146.60, 60),
  ('iphone-15plus',   'apple',   'iPhone 15 Plus',    'C', false, 'phonecase_apple_iphone-15plus_slim_white_glossy',   77.80, 160.90, 70),
  ('iphone-15',       'apple',   'iPhone 15',         'C', true,  'phonecase_apple_iphone-15_slim_white_glossy',       72.40, 147.60, 80),
  ('iphone-14promax', 'apple',   'iPhone 14 Pro Max', 'A', false, 'phonecase_apple_iphone-14promax_slim_white_glossy', 80.00, 162.80, 90),
  ('iphone-14pro',    'apple',   'iPhone 14 Pro',     'A', false, 'phonecase_apple_iphone-14pro_slim_white_glossy',    73.90, 149.00, 100),
  ('iphone-14plus',   'apple',   'iPhone 14 Plus',    'C', false, 'phonecase_apple_iphone-14plus_slim_white_glossy',   80.50, 162.00, 110),
  ('iphone-14',       'apple',   'iPhone 14',         'C', false, 'phonecase_apple_iphone-14_slim_white_glossy',       73.90, 148.00, 120),
  ('galaxy-s23ultra', 'samsung', 'Galaxy S23 Ultra',  'D', true,  'phonecase_samsung_galaxy-s23ultra_slim_white_glossy', 82, 167, 210),
  ('galaxy-s23plus',  'samsung', 'Galaxy S23+',       'E', true,  'phonecase_samsung_galaxy-s23plus_slim_white_glossy',  79, 161, 220),
  ('galaxy-s23',      'samsung', 'Galaxy S23',        'E', true,  'phonecase_samsung_galaxy-s23_slim_white_glossy',      74, 149, 230),
  ('galaxy-s22ultra', 'samsung', 'Galaxy S22 Ultra',  'D', false, 'phonecase_samsung_galaxy-s22ultra_slim_white_glossy', 81, 167, 240),
  ('galaxy-s22plus',  'samsung', 'Galaxy S22+',       'E', false, 'phonecase_samsung_galaxy-s22plus_slim_white_glossy',  78, 159, 250),
  ('galaxy-s22',      'samsung', 'Galaxy S22',        'E', true,  'phonecase_samsung_galaxy-s22_slim_white_glossy',      74, 148, 260)
ON CONFLICT (id) DO NOTHING;

-- Products: shape family 'phone'
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_shape_family_check;
ALTER TABLE public.products ADD CONSTRAINT products_shape_family_check
  CHECK (shape_family IS NULL OR shape_family IN ('rect_2x3', 'square', 'wide', 'any', 'phone'));

INSERT INTO public.media (name, slug, description, category, material_type, finish_type, indoor_outdoor, is_active, display_order)
SELECT 'Phone Case', 'phone-case', 'Slim glossy phone case, printed edge to edge', 'phone_case', NULL, 'gloss', NULL, true, 20
WHERE NOT EXISTS (SELECT 1 FROM public.media WHERE slug = 'phone-case');

WITH m AS (SELECT id FROM public.media WHERE slug = 'phone-case' ORDER BY created_at LIMIT 1),
ins AS (
  INSERT INTO public.products (sku, name, description, medium_id, format_id, shape_family, size_name, size_code,
                               width_cm, height_cm, width_inches, height_inches, product_type, fulfillment_method,
                               requires_shipping, is_active, display_order, gelato_sku)
  SELECT 'PHONE-CASE-' || upper(pm.id), 'Phone Case · ' || pm.name, 'Slim glossy phone case for ' || pm.name,
         m.id, NULL, 'phone', pm.name, NULL,
         round(pm.case_w_mm / 10, 2), round(pm.case_h_mm / 10, 2), round(pm.case_w_mm / 25.4, 1), round(pm.case_h_mm / 25.4, 1),
         'physical_print', 'gelato', true, false, 1000 + pm.display_order, pm.gelato_uid
  FROM public.phone_models pm CROSS JOIN m
  ON CONFLICT (sku) DO NOTHING
  RETURNING id, sku
)
INSERT INTO public.product_pricing (product_id, country_code, product_cost, shipping_cost, sale_price, currency_code, currency_symbol, is_current, notes)
SELECT ins.id, 'GB', CASE WHEN ins.sku LIKE 'PHONE-CASE-IPHONE-16%' THEN 1054 ELSE 1004 END, 0, 2499, 'GBP', '£', true,
       'Phone case launch price; cost = Gelato base ex VAT, ex shipping (Nov 2026)'
FROM ins;

UPDATE public.phone_models pm SET product_id = p.id, updated_at = now()
FROM public.products p WHERE p.sku = 'PHONE-CASE-' || upper(pm.id) AND pm.product_id IS NULL;

COMMIT;

-- Rollback (manual):
-- DELETE FROM public.product_pricing WHERE product_id IN (SELECT id FROM public.products WHERE sku LIKE 'PHONE-CASE-%');
-- DELETE FROM public.products WHERE sku LIKE 'PHONE-CASE-%';
-- DROP TABLE public.phone_models; DROP TABLE public.phone_layout_groups;
-- DELETE FROM public.media WHERE slug = 'phone-case';
