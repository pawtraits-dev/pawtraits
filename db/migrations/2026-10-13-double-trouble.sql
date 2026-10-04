-- =============================================================================
-- Migration: Double Trouble collection + pet-count filter (multi-pet plan, phase 3)
-- Date: 2026-10-13
-- Safe to re-run. Run after 2026-10-12-multi-pet-data.sql. Rollback at bottom.
--
-- * New collection kind 'group': Double Trouble › Two dogs / Two cats / Dog & cat / Three or more.
-- * Designs with more than one pet are filed there automatically (source 'pets'), from the
--   number of pets and their species; refiled when the pets change. "Take out" in admin sticks.
-- * search_designs() and collection_designs() take p_pets: 1 = one pet, 2 = two or more.
-- =============================================================================

BEGIN;

ALTER TABLE public.collections DROP CONSTRAINT IF EXISTS collections_kind_check;
ALTER TABLE public.collections ADD CONSTRAINT collections_kind_check
  CHECK (kind IN ('occasion', 'sport', 'pawsonality', 'zodiac', 'group'));
ALTER TABLE public.design_collections DROP CONSTRAINT IF EXISTS design_collections_source_check;
ALTER TABLE public.design_collections ADD CONSTRAINT design_collections_source_check
  CHECK (source IN ('theme', 'auto', 'admin', 'pets'));

-- The collections (also in lib/collections/definitions.ts, so the seed script knows them)
INSERT INTO public.collections (kind, parent_id, slug, path, depth, name, description, sort_order, search_terms)
VALUES ('group', NULL, 'double-trouble', 'double-trouble', 0, 'Double Trouble',
        'Two pets (or more) in one masterpiece. Add a photo of each: they don’t all have to be yours.', 25,
        ARRAY['duo', 'duos', 'pair', 'pairs', 'two pets', 'double', 'together', 'besties', 'siblings', 'family'])
ON CONFLICT (path) DO NOTHING;
INSERT INTO public.collections (kind, parent_id, slug, path, depth, name, sort_order, search_terms, metadata)
SELECT 'group', p.id, v.slug, 'double-trouble/' || v.slug, 1, v.name, v.ord, v.terms, jsonb_build_object('pets', v.rule)
  FROM public.collections p,
       (VALUES ('two-dogs', 'Two dogs', 10, ARRAY['two dogs', 'dog duo', 'puppies'], 'dog+dog'),
               ('two-cats', 'Two cats', 20, ARRAY['two cats', 'cat duo', 'kittens'], 'cat+cat'),
               ('dog-and-cat', 'Dog & cat', 30, ARRAY['dog and cat', 'cat and dog'], 'dog+cat'),
               ('three-or-more', 'Three or more', 40, ARRAY['three pets', 'pack', 'gang', 'family'], '3+')) AS v(slug, name, ord, terms, rule)
 WHERE p.path = 'double-trouble'
ON CONFLICT (path) DO NOTHING;

-- File one design under the right Double Trouble collection (or none)
CREATE OR REPLACE FUNCTION public.file_design_by_pets(p_image_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n integer; dogs integer; cats integer; customer boolean; target text;
BEGIN
  SELECT ic.subject_count, coalesce(ic.is_customer_generated, false) INTO n, customer FROM image_catalog ic WHERE ic.id = p_image_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT count(*) FILTER (WHERE b.animal_type = 'dog'), count(*) FILTER (WHERE b.animal_type = 'cat')
    INTO dogs, cats
    FROM image_catalog_subjects s JOIN breeds b ON b.id = s.breed_id WHERE s.image_catalog_id = p_image_id;
  target := CASE
    WHEN customer OR n < 2 THEN NULL
    WHEN n >= 3 THEN 'double-trouble/three-or-more'
    WHEN dogs = 2 THEN 'double-trouble/two-dogs'
    WHEN cats = 2 THEN 'double-trouble/two-cats'
    WHEN dogs = 1 AND cats = 1 THEN 'double-trouble/dog-and-cat'
    ELSE 'double-trouble' END;
  DELETE FROM design_collections dc USING collections c
   WHERE dc.collection_id = c.id AND dc.image_id = p_image_id AND dc.source = 'pets' AND NOT dc.excluded
     AND (target IS NULL OR c.path <> target);
  IF target IS NOT NULL THEN
    INSERT INTO design_collections (image_id, collection_id, source)
    SELECT p_image_id, c.id, 'pets' FROM collections c WHERE c.path = target
    ON CONFLICT (image_id, collection_id) DO NOTHING;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.file_design_by_pets(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.image_catalog_file_by_pets()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM file_design_by_pets(NEW.id);
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS image_catalog_file_by_pets ON public.image_catalog;
CREATE TRIGGER image_catalog_file_by_pets AFTER INSERT OR UPDATE OF subject_count, breed_id, is_customer_generated
  ON public.image_catalog FOR EACH ROW EXECUTE FUNCTION public.image_catalog_file_by_pets();

CREATE OR REPLACE FUNCTION public.image_catalog_subjects_file_by_pets()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM file_design_by_pets(CASE WHEN TG_OP = 'DELETE' THEN OLD.image_catalog_id ELSE NEW.image_catalog_id END);
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS image_catalog_subjects_file_by_pets ON public.image_catalog_subjects;
CREATE TRIGGER image_catalog_subjects_file_by_pets AFTER INSERT OR UPDATE OR DELETE ON public.image_catalog_subjects
  FOR EACH ROW EXECUTE FUNCTION public.image_catalog_subjects_file_by_pets();

-- File every existing multi-pet design
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT id FROM public.image_catalog WHERE subject_count > 1 LOOP PERFORM public.file_design_by_pets(r.id); END LOOP;
END $$;

-- Pet-count filter (p_pets: NULL = any, 1 = one pet, 2 = two or more)
DROP FUNCTION IF EXISTS public.search_designs(text, text, uuid, text, integer, integer);
CREATE OR REPLACE FUNCTION public.search_designs(p_query text, p_animal text DEFAULT NULL, p_breed_id uuid DEFAULT NULL,
  p_tag text DEFAULT NULL, p_limit integer DEFAULT 24, p_offset integer DEFAULT 0, p_pets integer DEFAULT NULL)
RETURNS TABLE (id uuid, rank real, total bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ic.id,
         (CASE WHEN p_query IS NULL THEN 0 ELSE ts_rank_cd(ic.search_tsv, to_tsquery('english', p_query), 1) END
          + least(coalesce(ic.like_count, 0) + coalesce(ic.share_count, 0), 50) / 500.0)::real AS rank,
         count(*) OVER () AS total
    FROM image_catalog ic
   WHERE (p_query IS NULL OR ic.search_tsv @@ to_tsquery('english', p_query))
     AND (p_tag IS NULL OR ic.display_tags @> ARRAY[p_tag])
     AND (p_query IS NOT NULL OR p_tag IS NOT NULL)
     AND ic.is_public IS TRUE
     AND NOT coalesce(ic.is_customer_generated, false)
     AND NOT coalesce(ic.tags, '{}') @> ARRAY['quiz-generated']
     AND (p_breed_id IS NULL OR design_has_breed(ic.id, ic.breed_id, p_breed_id))
     AND (p_animal IS NULL OR design_has_animal(ic.id, ic.breed_id, p_animal))
     AND (p_pets IS NULL OR (p_pets = 1 AND ic.subject_count = 1) OR (p_pets >= 2 AND ic.subject_count >= 2))
   ORDER BY rank DESC, ic.created_at DESC
   LIMIT least(greatest(p_limit, 1), 100) OFFSET greatest(p_offset, 0)
$$;
REVOKE ALL ON FUNCTION public.search_designs(text, text, uuid, text, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_designs(text, text, uuid, text, integer, integer, integer) TO service_role;

DROP FUNCTION IF EXISTS public.collection_designs(text, text, uuid, integer, integer);
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
       AND NOT coalesce(ic.tags, '{}') @> ARRAY['quiz-generated']
       AND (p_breed_id IS NULL OR design_has_breed(ic.id, ic.breed_id, p_breed_id))
       AND (p_animal IS NULL OR design_has_animal(ic.id, ic.breed_id, p_animal))
       AND (p_pets IS NULL OR (p_pets = 1 AND ic.subject_count = 1) OR (p_pets >= 2 AND ic.subject_count >= 2))
  )
  SELECT id, count(*) OVER ()
    FROM ids
   ORDER BY is_featured DESC NULLS LAST, coalesce(like_count, 0) + coalesce(share_count, 0) DESC, created_at DESC
   LIMIT least(greatest(p_limit, 1), 100) OFFSET greatest(p_offset, 0)
$$;
REVOKE ALL ON FUNCTION public.collection_designs(text, text, uuid, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.collection_designs(text, text, uuid, integer, integer, integer) TO service_role;

COMMIT;

-- Rollback:
-- DROP TRIGGER IF EXISTS image_catalog_subjects_file_by_pets ON public.image_catalog_subjects; DROP FUNCTION IF EXISTS public.image_catalog_subjects_file_by_pets();
-- DROP TRIGGER IF EXISTS image_catalog_file_by_pets ON public.image_catalog; DROP FUNCTION IF EXISTS public.image_catalog_file_by_pets();
-- DROP FUNCTION IF EXISTS public.file_design_by_pets(uuid);
-- DELETE FROM public.design_collections WHERE source = 'pets';
-- DELETE FROM public.collections WHERE path LIKE 'double-trouble%';
-- (re-run 2026-10-12 to restore the previous search_designs / collection_designs)
