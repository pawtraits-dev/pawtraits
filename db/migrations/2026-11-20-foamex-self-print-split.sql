-- =============================================================================
-- Migration: Split orders by material, "foamex to me, everything else to Gelato"
-- Date: 2026-11-20 · Safe to re-run. Rollback at the bottom.
--
-- Adds what the split needs (lib/fulfillment/split-routing.ts):
--   order_items.fulfillment_provider   who makes this line: 'self_print' or 'gelato'.
--                                     NULL means "follows the order" (every order made before this change).
--   orders.gelato_tracking_code/_url  the Gelato parcel's tracking, kept apart from our own Royal Mail
--   orders.gelato_shipped_at          fields (tracking_code, tracking_url, shipped_at) so the two never clash
--   app_settings.self_print_materials the materials (media slugs) printed here in split mode
--                                     (starts as foamex and foam-print; everything else goes to Gelato)
--
-- Depends on 2026-09-29-self-print-fulfilment.sql (the orders' self-print columns) and
-- 2026-09-28-guest-checkout.sql (the app_settings table).
--
-- Nothing changes until "New orders go to" is set to "Split by material" in Admin > Orders.
-- The value of default_fulfillment_provider is NOT changed here.
-- =============================================================================
BEGIN;

ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS fulfillment_provider text;
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_fulfillment_provider_check;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_fulfillment_provider_check
  CHECK (fulfillment_provider IS NULL OR fulfillment_provider IN ('self_print', 'gelato'));
COMMENT ON COLUMN public.order_items.fulfillment_provider IS
  'Who makes this line: self_print (printed and posted by us) or gelato. NULL = follows the order (all orders made before the split).';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS gelato_tracking_code text,
  ADD COLUMN IF NOT EXISTS gelato_tracking_url text,
  ADD COLUMN IF NOT EXISTS gelato_shipped_at timestamptz;
COMMENT ON COLUMN public.orders.gelato_tracking_code IS 'Tracking code of the Gelato parcel of a split order (our own parcel uses tracking_code).';
COMMENT ON COLUMN public.orders.gelato_tracking_url IS 'Tracking link of the Gelato parcel of a split order (https only).';
COMMENT ON COLUMN public.orders.gelato_shipped_at IS 'When Gelato first reported the parcel of a split order as shipped.';

INSERT INTO public.app_settings (key, value, description) VALUES
  ('self_print_materials', '["foamex", "foam-print"]'::jsonb,
   'Materials (media slugs) printed here when "New orders go to" is "Split by material"; everything else goes to Gelato')
ON CONFLICT (key) DO NOTHING;

UPDATE public.app_settings
SET description = 'Where new paid orders with posted prints go: "self_print" (queue in /admin/orders), "gelato" (sent automatically) or "split" (materials in self_print_materials queue here, the rest go to Gelato)'
WHERE key = 'default_fulfillment_provider';

COMMIT;

-- Rollback (only after switching "New orders go to" back to self-print or Gelato, and only if no split order exists):
-- BEGIN;
-- DELETE FROM public.app_settings WHERE key = 'self_print_materials';
-- ALTER TABLE public.orders DROP COLUMN IF EXISTS gelato_tracking_code, DROP COLUMN IF EXISTS gelato_tracking_url, DROP COLUMN IF EXISTS gelato_shipped_at;
-- ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_fulfillment_provider_check;
-- ALTER TABLE public.order_items DROP COLUMN IF EXISTS fulfillment_provider;
-- COMMIT;
