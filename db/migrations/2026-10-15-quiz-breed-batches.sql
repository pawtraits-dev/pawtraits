-- =============================================================================
-- Migration: breed versions of quiz pictures, made in bulk with the Gemini Batch API
-- Date: 2026-10-15. Safe to re-run. Rollback at bottom.
--
-- * quiz_question_breed_images: a question's picture repainted as one breed (1K). Served in place
--   of the base picture when the quiz taker picked that breed, while source_public_id still
--   matches the question's current picture (replacing the base picture retires its versions).
-- * Result type pictures (2K) keep using quiz_breed_images + image_catalog (as before), so the
--   result page picks batch-made ones up with no other change.
-- * quiz_image_runs / _jobs / _items: one "Make breed versions" request, split into Gemini batch
--   jobs of ~20 images, one item per picture. Processed by /api/cron/quiz-images (every 2 min).
-- All tables: RLS on, no policies → service role only.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.quiz_question_breed_images (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id      uuid NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  breed_id         uuid NOT NULL REFERENCES public.breeds(id) ON DELETE CASCADE,
  source_public_id text NOT NULL,                 -- the question picture it was made from
  image_public_id  text NOT NULL,                 -- the breed version (Cloudinary)
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quiz_question_breed_images_key UNIQUE (question_id, breed_id)
);
CREATE INDEX IF NOT EXISTS quiz_question_breed_images_breed_idx ON public.quiz_question_breed_images (breed_id);
ALTER TABLE public.quiz_question_breed_images ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.quiz_image_runs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id            uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  kind               text NOT NULL CHECK (kind IN ('question', 'type')),
  image_size         text NOT NULL CHECK (image_size IN ('1K', '2K', '4K')),
  model              text NOT NULL,
  status             text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'cancelled')),
  item_count         integer NOT NULL DEFAULT 0,
  estimated_cost_usd numeric(10, 4),
  reference_files    jsonb NOT NULL DEFAULT '{}'::jsonb,   -- { sourcePublicId: { uri, mimeType, uploadedAt } }
  created_at         timestamptz NOT NULL DEFAULT now(),
  completed_at       timestamptz
);
CREATE INDEX IF NOT EXISTS quiz_image_runs_quiz_idx ON public.quiz_image_runs (quiz_id, created_at DESC);
ALTER TABLE public.quiz_image_runs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.quiz_image_run_jobs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id                uuid NOT NULL REFERENCES public.quiz_image_runs(id) ON DELETE CASCADE,
  gemini_name           text,
  state                 text NOT NULL DEFAULT 'queued'
                        CHECK (state IN ('queued', 'submitted', 'running', 'succeeded', 'processed', 'failed', 'cancelled', 'expired')),
  item_count            integer NOT NULL DEFAULT 0,
  result_file           text,
  attempts              integer NOT NULL DEFAULT 0,
  error                 text,
  submitted_at          timestamptz,
  finished_at           timestamptz,
  processing_started_at timestamptz,
  processed_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quiz_image_run_jobs_state_idx ON public.quiz_image_run_jobs (state, created_at);
ALTER TABLE public.quiz_image_run_jobs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.quiz_image_run_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id           uuid NOT NULL REFERENCES public.quiz_image_runs(id) ON DELETE CASCADE,
  job_id           uuid REFERENCES public.quiz_image_run_jobs(id) ON DELETE SET NULL,
  question_id      uuid REFERENCES public.quiz_questions(id) ON DELETE CASCADE,   -- kind = question
  type_code        text,                                                          -- kind = type
  source_image_id  uuid REFERENCES public.image_catalog(id) ON DELETE CASCADE,     -- kind = type: the type's design
  source_public_id text NOT NULL,                                                 -- Cloudinary id of the source picture
  breed_id         uuid NOT NULL REFERENCES public.breeds(id) ON DELETE CASCADE,
  prompt           text NOT NULL,
  aspect_ratio     text,
  status           text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'submitted', 'done', 'failed', 'cancelled')),
  error            text,
  result_public_id text,
  result_image_id  uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quiz_image_run_items_run_idx ON public.quiz_image_run_items (run_id, status);
CREATE INDEX IF NOT EXISTS quiz_image_run_items_job_idx ON public.quiz_image_run_items (job_id);
ALTER TABLE public.quiz_image_run_items ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Rollback (run manually):
-- DROP TABLE IF EXISTS public.quiz_image_run_items;
-- DROP TABLE IF EXISTS public.quiz_image_run_jobs;
-- DROP TABLE IF EXISTS public.quiz_image_runs;
-- DROP TABLE IF EXISTS public.quiz_question_breed_images;
