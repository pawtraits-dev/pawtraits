-- =============================================================================
-- Migration: Collections readable by the site (Admin → Catalogue collection filter)
-- Date: 2026-10-11
-- Safe to re-run. Rollback at bottom.
--
-- Which collections exist and which designs are in them is public information (it's what the
-- collection pages show), so signed-in and anonymous clients may read both tables. Writes stay
-- service-role only (admin API routes). Lets Admin → Catalogue filter by collection with a join.
-- =============================================================================

BEGIN;

GRANT SELECT ON public.collections, public.design_collections TO anon, authenticated;

DROP POLICY IF EXISTS collections_read ON public.collections;
CREATE POLICY collections_read ON public.collections FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS design_collections_read ON public.design_collections;
CREATE POLICY design_collections_read ON public.design_collections FOR SELECT TO anon, authenticated USING (true);

COMMIT;

-- Rollback:
-- DROP POLICY IF EXISTS collections_read ON public.collections;
-- DROP POLICY IF EXISTS design_collections_read ON public.design_collections;
-- REVOKE SELECT ON public.collections, public.design_collections FROM anon, authenticated;
