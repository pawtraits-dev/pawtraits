-- =============================================================================
-- Migration: Pawsonality breed-matched result pictures
-- Date: 2026-10-02
-- Spec:  docs/specs/pawsonality-quiz.md (phase 4)
-- Safe to re-run. Rollback at bottom.
--
-- One row per (type design, breed): the Gemini breed variation of a Pawsonalities type design.
-- Made in advance for top breeds (Admin → Quizzes → Breed pictures) or on the spot when a quiz
-- taker's type locks. The generated picture is saved to image_catalog as a normal design, so it
-- can be bought; this table only tracks the job and links the result.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.quiz_breed_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_type text NOT NULL CHECK (animal_type IN ('dog', 'cat')),
  type_code text NOT NULL CHECK (type_code ~ '^[EI][SN][TF][BC]$'),
  breed_id uuid NOT NULL REFERENCES public.breeds(id) ON DELETE CASCADE,
  source_image_id uuid NOT NULL REFERENCES public.image_catalog(id) ON DELETE CASCADE,  -- the type's design
  image_id uuid REFERENCES public.image_catalog(id) ON DELETE SET NULL,                -- the breed version
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  error text,
  requested_by text NOT NULL DEFAULT 'quiz' CHECK (requested_by IN ('quiz', 'admin')),
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quiz_breed_images_source_breed_key UNIQUE (source_image_id, breed_id)
);
CREATE INDEX IF NOT EXISTS quiz_breed_images_type_idx ON public.quiz_breed_images (animal_type, type_code);
CREATE INDEX IF NOT EXISTS quiz_breed_images_ip_idx ON public.quiz_breed_images (ip_hash, created_at DESC);

ALTER TABLE public.quiz_breed_images ENABLE ROW LEVEL SECURITY;   -- service role only

COMMIT;

-- Rollback (run manually):
-- DROP TABLE IF EXISTS public.quiz_breed_images;
