-- =============================================================================
-- Migration: Personalised football kits (phase 1: admin)
-- Date: 2026-10-20. Safe to re-run. Rollback at bottom.
--
-- A sports design can carry a name and number on the pet's shirt ("DAISY 7"). Its team
-- versions then recolour the whole scene (pet, players and fans) and keep the lettering; each
-- version's lettering is read back and checked. Admin can try other names on a design
-- (kit_lettering_tests) before customers get to choose their own (phase 2).
-- =============================================================================

BEGIN;

-- {"name": "DAISY", "number": 7, "scene": true}  (NULL = not a personalised kit)
ALTER TABLE public.image_catalog
  ADD COLUMN IF NOT EXISTS kit_personalisation jsonb;

-- {"name": "DAISY", "number": 7, "logos": false, "ok": true}: what the version's shirt reads
ALTER TABLE public.design_team_variants
  ADD COLUMN IF NOT EXISTS kit_check jsonb;

CREATE TABLE IF NOT EXISTS public.kit_lettering_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id uuid NOT NULL REFERENCES public.image_catalog(id) ON DELETE CASCADE,  -- the design (or team version) it was painted on
  source_id uuid REFERENCES public.image_catalog(id) ON DELETE CASCADE,            -- the original design, for listing
  kit_name text NOT NULL,
  kit_number integer CHECK (kit_number IS NULL OR kit_number BETWEEN 0 AND 99),
  image_url text,
  cloudinary_public_id text,
  read_name text,
  read_number integer,
  logos boolean,
  matches boolean,
  error text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kit_lettering_tests_source_idx ON public.kit_lettering_tests (source_id, created_at DESC);
ALTER TABLE public.kit_lettering_tests ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.kit_lettering_tests TO service_role;

COMMIT;

-- Rollback:
-- DROP TABLE IF EXISTS public.kit_lettering_tests;
-- ALTER TABLE public.design_team_variants DROP COLUMN IF EXISTS kit_check;
-- ALTER TABLE public.image_catalog DROP COLUMN IF EXISTS kit_personalisation;
