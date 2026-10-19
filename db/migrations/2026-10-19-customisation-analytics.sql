-- =============================================================================
-- Migration: Customisation analytics (Admin > Customisations)
-- Date: 2026-10-19
-- Safe to re-run. Rollback at bottom.
--
-- Records when a customer shares a customised portrait, and when someone opens a shared link,
-- so Admin > Customisations can show share rates by design and breed. Breeds of uploaded pet
-- photos are detected after painting and kept in customer_custom_images.pet_breed_id
-- (metadata.breed_source = 'detected').
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.custom_image_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_image_id uuid NOT NULL REFERENCES public.customer_custom_images(id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN ('share', 'share_view')),
  channel text,                                   -- share: 'native' | 'copy'
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS custom_image_events_image_idx ON public.custom_image_events (custom_image_id, event);
CREATE INDEX IF NOT EXISTS custom_image_events_created_idx ON public.custom_image_events (created_at);

ALTER TABLE public.custom_image_events ENABLE ROW LEVEL SECURITY;
-- No policies: written and read by server routes with the service role only

-- Analytics reads customisations by date, design and breed
CREATE INDEX IF NOT EXISTS customer_custom_images_created_idx ON public.customer_custom_images (created_at DESC);
CREATE INDEX IF NOT EXISTS customer_custom_images_catalog_idx ON public.customer_custom_images (catalog_image_id);
CREATE INDEX IF NOT EXISTS customer_custom_images_breed_idx ON public.customer_custom_images (pet_breed_id);

-- Purchases of a customisation are order lines whose image_id is the customisation's id
CREATE INDEX IF NOT EXISTS order_items_image_id_idx ON public.order_items (image_id);

COMMIT;

-- Rollback:
-- DROP TABLE IF EXISTS public.custom_image_events;
-- DROP INDEX IF EXISTS public.customer_custom_images_created_idx, public.customer_custom_images_catalog_idx,
--   public.customer_custom_images_breed_idx, public.order_items_image_id_idx;
