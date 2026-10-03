-- =============================================================================
-- Migration: Social loop & global social proof (phase 1)
-- Date: 2026-10-04
-- Spec:  docs/specs/social-loop.md
-- Safe to re-run. Rollback at bottom.
--
-- Every paid order line that is a customised portrait becomes a social item: the customer's
-- original photo (before), the watermarked portrait (after), the pet's first name and a
-- town/country. Items pass an automatic photo check, then feed the website "recent creations"
-- strip (phase 2) and fill Instagram carousel batches of 5 (phases 3–4).
-- Customers can opt out by email; admin can hide any item or pause either channel.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.social_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'filling' CHECK (status IN ('filling', 'ready', 'publishing', 'posted', 'failed')),
  caption text,
  ig_media_id text,
  ig_permalink text,
  attempts integer NOT NULL DEFAULT 0,
  error text,
  needs_removal boolean NOT NULL DEFAULT false,   -- someone in a posted carousel opted out
  posted_at timestamptz,
  emailed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.social_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
  custom_image_id uuid NOT NULL UNIQUE REFERENCES public.customer_custom_images(id) ON DELETE CASCADE,
  catalog_image_id uuid REFERENCES public.image_catalog(id) ON DELETE SET NULL,
  customer_email text,                                    -- lowercased; never shown publicly
  pet_name text CHECK (pet_name IS NULL OR char_length(pet_name) BETWEEN 1 AND 30),   -- first name only
  before_public_id text,                                  -- customer's photo (Cloudinary), when it's there
  before_url text NOT NULL,                               -- customer's photo URL (always)
  after_public_id text,                                   -- generated portrait (Cloudinary)
  after_url text NOT NULL,                                -- watermarked portrait URL
  town text CHECK (town IS NULL OR char_length(town) <= 60),
  country text CHECK (country IS NULL OR char_length(country) <= 60),
  location_source text NOT NULL DEFAULT 'none' CHECK (location_source IN ('billing', 'shipping', 'stall', 'none')),
  channel text NOT NULL DEFAULT 'online' CHECK (channel IN ('online', 'stall')),
  stall_name text,
  check_status text NOT NULL DEFAULT 'pending' CHECK (check_status IN ('pending', 'approved', 'rejected', 'error')),
  check_reasons text[] NOT NULL DEFAULT '{}',
  check_attempts integer NOT NULL DEFAULT 0,
  checked_at timestamptz,
  opted_out boolean NOT NULL DEFAULT false,
  hidden boolean NOT NULL DEFAULT false,                  -- hidden by admin
  batch_id uuid REFERENCES public.social_batches(id) ON DELETE SET NULL,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS social_items_feed_idx ON public.social_items (paid_at DESC)
  WHERE check_status = 'approved' AND NOT opted_out AND NOT hidden;
CREATE INDEX IF NOT EXISTS social_items_batch_idx ON public.social_items (batch_id);
CREATE INDEX IF NOT EXISTS social_items_email_idx ON public.social_items (customer_email);

-- Customers who said "don't feature my pet" (covers all their orders, past and future)
CREATE TABLE IF NOT EXISTS public.social_opt_outs (
  email text PRIMARY KEY CHECK (email = lower(email)),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Stalls: town shown for market orders ("Old Spitalfields Market, London")
ALTER TABLE public.stock_locations
  ADD COLUMN IF NOT EXISTS town text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'UK';

-- Channel switches (Admin → Social). Instagram stays off until the Meta app is connected.
INSERT INTO public.app_settings (key, value, description) VALUES
  ('social_feed_enabled', 'true', 'Show the "recent custom creations" feed on the website'),
  ('social_instagram_enabled', 'false', 'Post before/after carousels to Instagram automatically'),
  ('social_photo_check_enabled', 'true', 'Run the automatic photo check before featuring an order')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.social_batches  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_opt_outs ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Rollback:
-- DELETE FROM public.app_settings WHERE key IN ('social_feed_enabled', 'social_instagram_enabled', 'social_photo_check_enabled');
-- ALTER TABLE public.stock_locations DROP COLUMN IF EXISTS town, DROP COLUMN IF EXISTS country;
-- DROP TABLE IF EXISTS public.social_opt_outs;
-- DROP TABLE IF EXISTS public.social_items;
-- DROP TABLE IF EXISTS public.social_batches;
