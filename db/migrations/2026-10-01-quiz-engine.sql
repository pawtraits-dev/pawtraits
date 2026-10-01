-- =============================================================================
-- Migration: Quiz engine (16 Pawsonalities first; zodiac and Love Languages reuse it)
-- Date: 2026-10-01
-- Spec:  docs/specs/pawsonality-quiz.md  (quiz engine functional spec v1.0, sections 3 and 5)
-- Safe to re-run (IF NOT EXISTS). Rollback at bottom.
-- Content is loaded separately: db/migrations/2026-10-01-pawsonality-seed.sql
--
-- Editing model: admins edit quiz_questions / quiz_result_types (the working draft).
-- "Publish" freezes them into quiz_versions.content; customers always take the latest
-- published version, and each result records the version it was scored against.
-- All tables: RLS on, no policies → service role only (accessed through API routes).
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9-]{2,40}$'),          -- 'pawsonality', later 'zodiac-aries', 'love-languages'
  animal_type text NOT NULL CHECK (animal_type IN ('dog', 'cat')),
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live', 'paused')),
  current_version integer NOT NULL DEFAULT 0,                       -- 0 = never published
  has_unpublished_changes boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quizzes_slug_animal_key UNIQUE (slug, animal_type)
);

CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  dimension text NOT NULL CHECK (dimension IN ('EI', 'SN', 'TF', 'BC')),
  right_pole text NOT NULL CHECK (right_pole IN ('E','I','S','N','T','F','B','C')),
  statement text NOT NULL CHECK (char_length(statement) BETWEEN 5 AND 200),   -- uses [PET_NAME]
  share_quote text,
  visual_brief text,
  image_public_id text,                                              -- Cloudinary base picture
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quiz_questions_pole_matches_dimension CHECK (
    (dimension = 'EI' AND right_pole IN ('E','I')) OR (dimension = 'SN' AND right_pole IN ('S','N')) OR
    (dimension = 'TF' AND right_pole IN ('T','F')) OR (dimension = 'BC' AND right_pole IN ('B','C')))
);
CREATE INDEX IF NOT EXISTS quiz_questions_quiz_idx ON public.quiz_questions (quiz_id, sort_order);

CREATE TABLE IF NOT EXISTS public.quiz_result_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  code text NOT NULL CHECK (code ~ '^[EI][SN][TF][BC]$'),
  name text NOT NULL,
  tagline text,
  traits text[] NOT NULL DEFAULT '{}',
  signature_move text,
  owner_reality text,
  share_quote text,
  design_image_id uuid REFERENCES public.image_catalog(id) ON DELETE SET NULL,   -- Pawsonalities theme design
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quiz_result_types_quiz_code_key UNIQUE (quiz_id, code)
);

CREATE TABLE IF NOT EXISTS public.quiz_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  content jsonb NOT NULL,                                            -- { questions: [...], resultTypes: [...] }
  published_at timestamptz NOT NULL DEFAULT now(),
  published_by uuid,                                                 -- auth user id of the admin
  CONSTRAINT quiz_versions_quiz_version_key UNIQUE (quiz_id, version)
);

-- Spec 5.2 quiz_results, plus share code, pet details, raw answers and attribution
CREATE TABLE IF NOT EXISTS public.quiz_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_code text NOT NULL UNIQUE CHECK (share_code ~ '^[a-z0-9]{8,12}$'),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id),
  quiz_type text NOT NULL,                                           -- 'pawsonality' (spec enum, kept as text)
  quiz_version integer NOT NULL,
  animal_type text NOT NULL CHECK (animal_type IN ('dog', 'cat')),
  pet_name text NOT NULL CHECK (char_length(pet_name) BETWEEN 1 AND 30),
  breed_id uuid REFERENCES public.breeds(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  pet_id uuid REFERENCES public.pets(id) ON DELETE SET NULL,
  email text,                                                        -- set when saved by email
  answers jsonb NOT NULL,                                            -- { questionId: 'right' | 'left' }
  answer_order text[] NOT NULL DEFAULT '{}',
  score_data jsonb NOT NULL,                                         -- { E: 80, I: 20, ... }
  result_type text NOT NULL,                                         -- e.g. 'ESFB'
  result_image_id uuid REFERENCES public.image_catalog(id) ON DELETE SET NULL,   -- breed-matched picture, when made
  partner_code text,
  referral_code text,
  ip_hash text,                                                      -- sha256 of IP + salt, rate limiting only
  completed_at timestamptz NOT NULL DEFAULT now(),
  shared_at timestamptz,
  share_platform text CHECK (share_platform IN ('instagram','whatsapp','facebook','copy_link','native_share')),
  converted_to_purchase boolean NOT NULL DEFAULT false,
  purchase_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS quiz_results_quiz_idx ON public.quiz_results (quiz_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS quiz_results_user_idx ON public.quiz_results (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS quiz_results_ip_idx ON public.quiz_results (ip_hash, completed_at DESC);

ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS pawsonality_type text CHECK (pawsonality_type ~ '^[EI][SN][TF][BC]$'),
  ADD COLUMN IF NOT EXISTS pawsonality_result_id uuid REFERENCES public.quiz_results(id) ON DELETE SET NULL;

ALTER TABLE public.quizzes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_result_types  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_versions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_results       ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Rollback (run manually):
-- BEGIN;
-- ALTER TABLE public.pets DROP COLUMN IF EXISTS pawsonality_result_id, DROP COLUMN IF EXISTS pawsonality_type;
-- DROP TABLE IF EXISTS public.quiz_results, public.quiz_versions, public.quiz_result_types, public.quiz_questions, public.quizzes;
-- COMMIT;
