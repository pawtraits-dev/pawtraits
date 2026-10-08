-- =============================================================================
-- Migration: AI descriptions for batch variations, written before review
-- Date: 2026-10-18. Safe to re-run. Run after 2026-10-17-variation-batches.sql.
--
-- Each batch image gets its description (Claude, from the preview) as soon as it comes back
-- from Gemini, so it can be read and edited on the review page and is saved with the design.
-- =============================================================================

ALTER TABLE public.variation_run_items ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.variation_run_items ADD COLUMN IF NOT EXISTS description_error text;
CREATE INDEX IF NOT EXISTS variation_run_items_describe_idx ON public.variation_run_items (created_at)
  WHERE status = 'generated' AND description IS NULL AND description_error IS NULL;

-- Rollback:
-- ALTER TABLE public.variation_run_items DROP COLUMN IF EXISTS description_error, DROP COLUMN IF EXISTS description;
