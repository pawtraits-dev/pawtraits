-- =============================================================================
-- Migration: saved variation batches + Gemini Batch runs
-- Date: 2026-10-17. Safe to re-run. Run after 2026-10-16-ai-usage.sql. Rollback at bottom.
--
-- * variation_recipes: a saved, reusable batch (breed/coats × outfits), e.g. "Top 100 coats" or
--   "NFL + NBA on popular dogs". Breed/coats and outfits are combined: every breed/coat wears
--   every outfit.
-- * variation_runs: a recipe applied to one or more reference designs, sent to the Gemini Batch
--   API (half price, results within 24 h) in jobs of ~20 images (variation_run_jobs).
-- * variation_run_items: one row per image; results come back as previews to approve or reject.
-- * image_catalog.variation_of / variation_key: which reference and combination a saved
--   variation came from, so re-running a batch on the same reference only makes what's missing.
-- =============================================================================

BEGIN;

ALTER TABLE public.image_catalog ADD COLUMN IF NOT EXISTS variation_of uuid;
ALTER TABLE public.image_catalog ADD COLUMN IF NOT EXISTS variation_key text;
CREATE INDEX IF NOT EXISTS image_catalog_variation_of_idx ON public.image_catalog (variation_of, variation_key) WHERE variation_of IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.variation_recipes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  description  text,
  breed_coats  jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{ "breedId": uuid, "coatId": uuid }]
  outfit_ids   uuid[] NOT NULL DEFAULT '{}',
  image_size   text NOT NULL DEFAULT '4K' CHECK (image_size IN ('1K', '2K', '4K')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  last_run_at  timestamptz
);

CREATE TABLE IF NOT EXISTS public.variation_runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id        uuid REFERENCES public.variation_recipes(id) ON DELETE SET NULL,
  name             text NOT NULL,
  recipe_snapshot  jsonb NOT NULL,                     -- the recipe as it was when run
  reference_ids    uuid[] NOT NULL,
  reference_files  jsonb NOT NULL DEFAULT '{}'::jsonb, -- { refId: { uri, mimeType, uploadedAt } } (Gemini File API)
  image_size       text NOT NULL DEFAULT '4K',
  model            text NOT NULL,
  status           text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'review', 'done', 'cancelled')),
  estimated_cost_usd numeric(10, 4),
  error            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  completed_at     timestamptz
);
CREATE INDEX IF NOT EXISTS variation_runs_created_idx ON public.variation_runs (created_at DESC);

CREATE TABLE IF NOT EXISTS public.variation_run_jobs (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id                 uuid NOT NULL REFERENCES public.variation_runs(id) ON DELETE CASCADE,
  gemini_name            text,                 -- batches/…
  state                  text NOT NULL DEFAULT 'queued'
                         CHECK (state IN ('queued', 'submitted', 'running', 'succeeded', 'processed', 'failed', 'cancelled', 'expired')),
  item_count             integer NOT NULL DEFAULT 0,
  result_file            text,                 -- files/… (JSONL of responses)
  submitted_at           timestamptz,
  finished_at            timestamptz,
  processing_started_at  timestamptz,          -- lock while results are being read
  processed_at           timestamptz,
  attempts               integer NOT NULL DEFAULT 0,
  error                  text,
  created_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS variation_run_jobs_state_idx ON public.variation_run_jobs (state);

CREATE TABLE IF NOT EXISTS public.variation_run_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id              uuid NOT NULL REFERENCES public.variation_runs(id) ON DELETE CASCADE,
  job_id              uuid REFERENCES public.variation_run_jobs(id) ON DELETE SET NULL,
  reference_image_id  uuid NOT NULL,
  variation_key       text NOT NULL,
  label               text NOT NULL,
  breed_id            uuid,
  coat_id             uuid,
  outfit_id           uuid,
  status              text NOT NULL DEFAULT 'queued'
                      CHECK (status IN ('queued', 'submitted', 'generated', 'failed', 'approved', 'rejected', 'cancelled')),
  gemini_prompt       text,
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,  -- catalogue prompt, ids, tags, filename
  preview_public_id   text,
  preview_url         text,
  preview_thumb_url   text,
  width               integer,
  height              integer,
  saved_image_id      uuid,
  error               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS variation_run_items_run_idx ON public.variation_run_items (run_id, status);
CREATE INDEX IF NOT EXISTS variation_run_items_ref_idx ON public.variation_run_items (reference_image_id, variation_key);
CREATE INDEX IF NOT EXISTS variation_run_items_job_idx ON public.variation_run_items (job_id);

-- Server only
ALTER TABLE public.variation_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variation_run_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variation_run_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.variation_recipes, public.variation_runs, public.variation_run_jobs, public.variation_run_items FROM anon, authenticated;
GRANT ALL ON public.variation_recipes, public.variation_runs, public.variation_run_jobs, public.variation_run_items TO service_role;

-- Counts per run and status, for the batch pages
CREATE OR REPLACE VIEW public.variation_run_counts WITH (security_invoker = true) AS
  SELECT run_id,
         count(*)                                          AS total,
         count(*) FILTER (WHERE status IN ('queued', 'submitted')) AS waiting,
         count(*) FILTER (WHERE status = 'generated')      AS to_review,
         count(*) FILTER (WHERE status = 'approved')       AS approved,
         count(*) FILTER (WHERE status = 'rejected')       AS rejected,
         count(*) FILTER (WHERE status = 'failed')         AS failed,
         count(*) FILTER (WHERE status = 'cancelled')      AS cancelled
    FROM public.variation_run_items
   GROUP BY run_id;
GRANT SELECT ON public.variation_run_counts TO service_role;

COMMIT;

-- Rollback:
-- DROP VIEW IF EXISTS public.variation_run_counts;
-- DROP TABLE IF EXISTS public.variation_run_items, public.variation_run_jobs, public.variation_runs, public.variation_recipes;
-- ALTER TABLE public.image_catalog DROP COLUMN IF EXISTS variation_key, DROP COLUMN IF EXISTS variation_of;
