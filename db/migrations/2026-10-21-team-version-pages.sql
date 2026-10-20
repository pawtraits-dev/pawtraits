-- =============================================================================
-- Migration: Team versions on their team's collection page
-- Date: 2026-10-21. Safe to re-run. Run after 2026-10-20-personalised-kits.sql. Rollback at bottom.
--
-- A team version (e.g. the Liverpool version of a football design) stays out of Browse, search
-- and every other list (tag quiz-generated), but once admin publishes it, it is filed under its
-- own team (design_collections.source = 'team') and shows on that team's page only, e.g.
-- /collections/sports/premier-league/liverpool. Not on the league page above it, so the league
-- page doesn't fill up with 20 copies of one design.
-- =============================================================================

BEGIN;

ALTER TABLE public.design_collections DROP CONSTRAINT IF EXISTS design_collections_source_check;
ALTER TABLE public.design_collections ADD CONSTRAINT design_collections_source_check
  CHECK (source IN ('theme', 'auto', 'admin', 'pets', 'team'));

-- Per collection: design count and cover picture. Published team versions count for their own
-- team only (not the collections above it).
CREATE OR REPLACE FUNCTION public.collection_summary()
RETURNS TABLE (collection_id uuid, designs integer, hero_image_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH vis AS (
    SELECT dc.collection_id, ic.id AS image_id,
           (CASE WHEN ic.is_featured THEN 100 ELSE 0 END) + coalesce(ic.like_count, 0) + coalesce(ic.share_count, 0) AS score,
           ic.created_at,
           coalesce(ic.tags, '{}') @> ARRAY['quiz-generated'] AS team_only
      FROM design_collections dc JOIN image_catalog ic ON ic.id = dc.image_id
     WHERE NOT dc.excluded AND ic.is_public IS TRUE
       AND NOT coalesce(ic.is_customer_generated, false)
       AND (NOT coalesce(ic.tags, '{}') @> ARRAY['quiz-generated'] OR dc.source = 'team')
  ),
  roll AS (
    SELECT c.id AS collection_id, v.image_id, v.score, v.created_at
      FROM collections c
      JOIN collections m ON (m.path = c.path OR m.path LIKE c.path || '/%') AND m.is_active
      JOIN vis v ON v.collection_id = m.id
     WHERE c.is_active AND (NOT v.team_only OR m.id = c.id)
  )
  SELECT c.id,
         (SELECT count(DISTINCT r.image_id) FROM roll r WHERE r.collection_id = c.id)::int,
         coalesce(c.hero_image_id,
           (SELECT r.image_id FROM roll r WHERE r.collection_id = c.id ORDER BY r.score DESC, r.created_at DESC LIMIT 1))
    FROM collections c
   WHERE c.is_active
$$;

CREATE OR REPLACE FUNCTION public.collection_designs(p_path text, p_animal text DEFAULT NULL, p_breed_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 24, p_offset integer DEFAULT 0, p_pets integer DEFAULT NULL)
RETURNS TABLE (id uuid, total bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ids AS (
    SELECT DISTINCT ic.id, ic.is_featured, ic.like_count, ic.share_count, ic.created_at
      FROM collections m
      JOIN design_collections dc ON dc.collection_id = m.id AND NOT dc.excluded
      JOIN image_catalog ic ON ic.id = dc.image_id
     WHERE (m.path = p_path OR m.path LIKE p_path || '/%') AND m.is_active
       AND ic.is_public IS TRUE
       AND NOT coalesce(ic.is_customer_generated, false)
       AND (NOT coalesce(ic.tags, '{}') @> ARRAY['quiz-generated'] OR (dc.source = 'team' AND m.path = p_path))
       AND (p_breed_id IS NULL OR design_has_breed(ic.id, ic.breed_id, p_breed_id))
       AND (p_animal IS NULL OR design_has_animal(ic.id, ic.breed_id, p_animal))
       AND (p_pets IS NULL OR (p_pets = 1 AND ic.subject_count = 1) OR (p_pets >= 2 AND ic.subject_count >= 2))
  )
  SELECT id, count(*) OVER ()
    FROM ids
   ORDER BY is_featured DESC NULLS LAST, coalesce(like_count, 0) + coalesce(share_count, 0) DESC, created_at DESC
   LIMIT least(greatest(p_limit, 1), 100) OFFSET greatest(p_offset, 0)
$$;

CREATE OR REPLACE FUNCTION public.collection_breeds(p_path text)
RETURNS TABLE (breed_id uuid, name text, slug text, animal_type text, designs integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH vis AS (
    SELECT DISTINCT ic.id, ic.breed_id
      FROM collections m
      JOIN design_collections dc ON dc.collection_id = m.id AND NOT dc.excluded
      JOIN image_catalog ic ON ic.id = dc.image_id
     WHERE (m.path = p_path OR m.path LIKE p_path || '/%') AND m.is_active
       AND ic.is_public IS TRUE
       AND NOT coalesce(ic.is_customer_generated, false)
       AND (NOT coalesce(ic.tags, '{}') @> ARRAY['quiz-generated'] OR (dc.source = 'team' AND m.path = p_path))
  ),
  pairs AS (
    SELECT id AS image_id, breed_id FROM vis WHERE breed_id IS NOT NULL
    UNION
    SELECT s.image_catalog_id, s.breed_id FROM image_catalog_subjects s JOIN vis ON vis.id = s.image_catalog_id
  )
  SELECT b.id, b.name, b.slug, b.animal_type, count(DISTINCT p.image_id)::int
    FROM pairs p JOIN breeds b ON b.id = p.breed_id
   GROUP BY b.id, b.name, b.slug, b.animal_type
   ORDER BY count(DISTINCT p.image_id) DESC, b.name
$$;

COMMIT;

-- Rollback: DELETE FROM public.design_collections WHERE source = 'team'; then re-run
-- 2026-10-09-collections-browse.sql (collection_summary), 2026-10-12-multi-pet-data.sql
-- (collection_breeds) and 2026-10-13-double-trouble.sql (collection_designs).
