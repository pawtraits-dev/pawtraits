-- =============================================================================
-- Migration: Collections for customers (phase 3 of docs/specs/collections-plan.md)
-- Date: 2026-10-09
-- Safe to re-run. Run after 2026-10-08-auto-tags-search.sql. Rollback at bottom.
--
-- Read-only helpers for the customer collection pages. A design counts when it is public,
-- listed (not a link-only quiz picture) and not a customer's own customisation. A collection
-- includes the designs of the collections inside it (NFL shows every NFL team's designs).
-- =============================================================================

BEGIN;

-- Per collection: how many designs (including those of collections inside it) and the picture
-- to show for it (the admin's pick, else its most popular design)
CREATE OR REPLACE FUNCTION public.collection_summary()
RETURNS TABLE (collection_id uuid, designs integer, hero_image_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH vis AS (
    SELECT dc.collection_id, ic.id AS image_id,
           (CASE WHEN ic.is_featured THEN 100 ELSE 0 END) + coalesce(ic.like_count, 0) + coalesce(ic.share_count, 0) AS score,
           ic.created_at
      FROM design_collections dc JOIN image_catalog ic ON ic.id = dc.image_id
     WHERE NOT dc.excluded AND ic.is_public IS TRUE
       AND NOT coalesce(ic.is_customer_generated, false)
       AND NOT coalesce(ic.tags, '{}') @> ARRAY['quiz-generated']
  ),
  roll AS (
    SELECT c.id AS collection_id, v.image_id, v.score, v.created_at
      FROM collections c
      JOIN collections m ON (m.path = c.path OR m.path LIKE c.path || '/%') AND m.is_active
      JOIN vis v ON v.collection_id = m.id
     WHERE c.is_active
  )
  SELECT c.id,
         (SELECT count(DISTINCT r.image_id) FROM roll r WHERE r.collection_id = c.id)::int,
         coalesce(c.hero_image_id,
           (SELECT r.image_id FROM roll r WHERE r.collection_id = c.id ORDER BY r.score DESC, r.created_at DESC LIMIT 1))
    FROM collections c
   WHERE c.is_active
$$;

-- Designs in a collection (and the collections inside it), optionally for one animal or breed
CREATE OR REPLACE FUNCTION public.collection_designs(p_path text, p_animal text DEFAULT NULL, p_breed_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 24, p_offset integer DEFAULT 0)
RETURNS TABLE (id uuid, total bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ids AS (
    SELECT DISTINCT ic.id, ic.is_featured, ic.like_count, ic.share_count, ic.created_at
      FROM collections m
      JOIN design_collections dc ON dc.collection_id = m.id AND NOT dc.excluded
      JOIN image_catalog ic ON ic.id = dc.image_id
      LEFT JOIN breeds b ON b.id = ic.breed_id
     WHERE (m.path = p_path OR m.path LIKE p_path || '/%') AND m.is_active
       AND ic.is_public IS TRUE
       AND NOT coalesce(ic.is_customer_generated, false)
       AND NOT coalesce(ic.tags, '{}') @> ARRAY['quiz-generated']
       AND (p_breed_id IS NULL OR ic.breed_id = p_breed_id)
       AND (p_animal IS NULL OR b.animal_type = p_animal)
  )
  SELECT id, count(*) OVER ()
    FROM ids
   ORDER BY is_featured DESC NULLS LAST, coalesce(like_count, 0) + coalesce(share_count, 0) DESC, created_at DESC
   LIMIT least(greatest(p_limit, 1), 100) OFFSET greatest(p_offset, 0)
$$;

-- Breeds that appear in a collection, for "Christmas designs for your Cocker Spaniel"
CREATE OR REPLACE FUNCTION public.collection_breeds(p_path text)
RETURNS TABLE (breed_id uuid, name text, slug text, animal_type text, designs integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.id, b.name, b.slug, b.animal_type, count(DISTINCT ic.id)::int
    FROM collections m
    JOIN design_collections dc ON dc.collection_id = m.id AND NOT dc.excluded
    JOIN image_catalog ic ON ic.id = dc.image_id
    JOIN breeds b ON b.id = ic.breed_id
   WHERE (m.path = p_path OR m.path LIKE p_path || '/%') AND m.is_active
     AND ic.is_public IS TRUE
     AND NOT coalesce(ic.is_customer_generated, false)
     AND NOT coalesce(ic.tags, '{}') @> ARRAY['quiz-generated']
   GROUP BY b.id, b.name, b.slug, b.animal_type
   ORDER BY count(DISTINCT ic.id) DESC, b.name
$$;

REVOKE ALL ON FUNCTION public.collection_summary() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.collection_designs(text, text, uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.collection_breeds(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.collection_summary() TO service_role;
GRANT EXECUTE ON FUNCTION public.collection_designs(text, text, uuid, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.collection_breeds(text) TO service_role;

COMMIT;

-- Rollback:
-- DROP FUNCTION IF EXISTS public.collection_breeds(text);
-- DROP FUNCTION IF EXISTS public.collection_designs(text, text, uuid, integer, integer);
-- DROP FUNCTION IF EXISTS public.collection_summary();
