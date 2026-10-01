-- =============================================================================
-- Migration: Social loop — customisations as content, Instagram carousel preview (phase 3)
-- Date: 2026-10-05
-- Requires: 2026-10-04-social-loop.sql
-- Spec:  docs/specs/social-loop.md
-- Safe to re-run. Rollback at bottom.
--
-- 1. Social items can now come from a free preview (a customisation not yet bought), so there is
--    content before the first orders. Switched on in Admin → Social ("Include free previews").
--    When a preview is later bought, its item becomes a purchase (order, location, time).
-- 2. Carousels: admin can remove a pet from Instagram only, edit the caption, and mark a
--    carousel as posted by hand (before the Meta app is connected).
-- =============================================================================

BEGIN;

ALTER TABLE public.social_items
  ALTER COLUMN order_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'purchase' CHECK (source IN ('purchase', 'preview')),
  ADD COLUMN IF NOT EXISTS ig_excluded boolean NOT NULL DEFAULT false;   -- removed from Instagram by admin (website feed unaffected)
COMMENT ON COLUMN public.social_items.paid_at IS 'When it happened: payment time for purchases, creation time for previews';

ALTER TABLE public.social_batches
  ADD COLUMN IF NOT EXISTS caption_edited boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS social_items_unbatched_idx ON public.social_items (paid_at)
  WHERE batch_id IS NULL AND check_status = 'approved' AND NOT opted_out AND NOT hidden AND NOT ig_excluded;

INSERT INTO public.app_settings (key, value, description) VALUES
  ('social_include_previews', 'false', 'Feature free previews (customisations not yet bought) as well as purchases')
ON CONFLICT (key) DO NOTHING;

COMMIT;

-- Rollback:
-- DELETE FROM public.app_settings WHERE key = 'social_include_previews';
-- DROP INDEX IF EXISTS public.social_items_unbatched_idx;
-- ALTER TABLE public.social_batches DROP COLUMN IF EXISTS caption_edited;
-- DELETE FROM public.social_items WHERE source = 'preview';
-- ALTER TABLE public.social_items DROP COLUMN IF EXISTS ig_excluded, DROP COLUMN IF EXISTS source, ALTER COLUMN order_id SET NOT NULL;
