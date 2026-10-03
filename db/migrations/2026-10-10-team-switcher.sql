-- =============================================================================
-- Migration: Sports team switcher (phase 4 of docs/specs/collections-plan.md)
-- Date: 2026-10-10
-- Safe to re-run. Run after 2026-10-09-collections-browse.sql. Rollback at bottom.
--
-- A sports design can be repainted in any team's colours. Each design + team version is made
-- once (in advance by admin, or on demand by a customer), saved as a link-only design (tag
-- quiz-generated = "not listed in the catalogue, buyable by link") and tracked here.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.design_team_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_image_id uuid NOT NULL REFERENCES public.image_catalog(id) ON DELETE CASCADE,
  team_collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  image_id uuid REFERENCES public.image_catalog(id) ON DELETE SET NULL,   -- the team version, when done
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'done', 'failed')),
  attempts integer NOT NULL DEFAULT 1,
  error text,
  requested_by text NOT NULL DEFAULT 'customer' CHECK (requested_by IN ('customer', 'admin')),
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_image_id, team_collection_id)
);
CREATE INDEX IF NOT EXISTS design_team_variants_image_idx ON public.design_team_variants (image_id);
CREATE INDEX IF NOT EXISTS design_team_variants_ip_idx ON public.design_team_variants (ip_hash, created_at);

-- Which teams a design offers: NULL = its own league (colleges for college designs),
-- 'any' = every team, 'off' = no team switching
ALTER TABLE public.image_catalog
  ADD COLUMN IF NOT EXISTS team_switch text CHECK (team_switch IN ('any', 'off'));

ALTER TABLE public.design_team_variants ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.design_team_variants TO service_role;

INSERT INTO public.app_settings (key, value, description) VALUES
  ('team_switch_enabled', 'true'::jsonb, 'Customers can change a sports design to another team'),
  ('team_switch_hourly_limit', '6'::jsonb, 'New team versions one visitor can have painted per hour (ready-made ones are unlimited)')
ON CONFLICT (key) DO NOTHING;

COMMIT;

-- Rollback:
-- ALTER TABLE public.image_catalog DROP COLUMN IF EXISTS team_switch;
-- DROP TABLE IF EXISTS public.design_team_variants;
-- DELETE FROM public.app_settings WHERE key IN ('team_switch_enabled', 'team_switch_hourly_limit');
