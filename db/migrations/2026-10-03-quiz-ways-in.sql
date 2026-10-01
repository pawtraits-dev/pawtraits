-- =============================================================================
-- Migration: Pawsonality quiz ways in (phase 5)
-- Date: 2026-10-03
-- Spec:  docs/specs/pawsonality-quiz.md (phase 5)
-- Safe to re-run. Rollback at bottom.
--
-- Records where each quiz taker came from (home page band, a design page, an email, My pets,
-- a friend's shared result, a partner link…) so Admin → Quizzes → Results can show which
-- ways in work.
-- =============================================================================

BEGIN;

ALTER TABLE public.quiz_results
  ADD COLUMN IF NOT EXISTS entry_source text CHECK (entry_source IS NULL OR entry_source ~ '^[a-z0-9_-]{1,32}$');

-- Purchases are linked to the buyer's quiz result by saved email
CREATE INDEX IF NOT EXISTS quiz_results_email_idx ON public.quiz_results (email) WHERE email IS NOT NULL;

COMMIT;

-- Rollback:
-- DROP INDEX IF EXISTS public.quiz_results_email_idx;
-- ALTER TABLE public.quiz_results DROP COLUMN IF EXISTS entry_source;
