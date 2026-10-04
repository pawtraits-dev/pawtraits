-- =============================================================================
-- Migration: Designs with more than one pet, phase 1 (docs/specs/multi-pet-plan.md)
-- Date: 2026-10-12
-- Safe to re-run. Run after 2026-10-11-collections-read.sql. Rollback at bottom.
--
-- One source of truth for a design's pets:
--   image_catalog.subjects        the pets (position, breed, coat, pose…), copied from
--                                 generation_parameters.subjects when empty
--   image_catalog.subject_count   how many pets (1 when unknown), kept in step by a trigger
--   image_catalog.is_multi_subject  subject_count > 1
--   image_catalog_subjects        one row per pet (breed filters), backfilled from subjects
-- Search and collection breed filters now look at every pet's breed, not just the first.
-- =============================================================================

BEGIN;

ALTER TABLE public.image_catalog
  ADD COLUMN IF NOT EXISTS subject_count integer NOT NULL DEFAULT 1;

-- Deleting a design removes its pet rows too (the original constraint had no cascade, so
-- deleting a multi-pet design failed)
ALTER TABLE public.image_catalog_subjects DROP CONSTRAINT IF EXISTS image_catalog_subjects_image_catalog_id_fkey;
ALTER TABLE public.image_catalog_subjects ADD CONSTRAINT image_catalog_subjects_image_catalog_id_fkey
  FOREIGN KEY (image_catalog_id) REFERENCES public.image_catalog(id) ON DELETE CASCADE;

-- Keep subjects / subject_count / is_multi_subject in step
CREATE OR REPLACE FUNCTION public.image_catalog_sync_subjects()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (NEW.subjects IS NULL OR jsonb_typeof(NEW.subjects) <> 'array' OR jsonb_array_length(NEW.subjects) = 0)
     AND jsonb_typeof(NEW.generation_parameters -> 'subjects') = 'array' THEN
    NEW.subjects := NEW.generation_parameters -> 'subjects';
  END IF;
  NEW.subject_count := greatest(1, CASE WHEN jsonb_typeof(NEW.subjects) = 'array' THEN jsonb_array_length(NEW.subjects) ELSE 0 END);
  NEW.is_multi_subject := NEW.subject_count > 1;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS image_catalog_sync_subjects ON public.image_catalog;
CREATE TRIGGER image_catalog_sync_subjects BEFORE INSERT OR UPDATE OF subjects, generation_parameters
  ON public.image_catalog FOR EACH ROW EXECUTE FUNCTION public.image_catalog_sync_subjects();

-- Backfill every existing design
UPDATE public.image_catalog SET subjects = coalesce(subjects, '[]'::jsonb);

-- One row per pet for designs saved before the junction table was filled
INSERT INTO public.image_catalog_subjects (image_catalog_id, subject_order, is_primary, breed_id, coat_id, position, size_prominence, pose_description, gaze_direction, expression)
SELECT ic.id,
       coalesce((s.value ->> 'subjectOrder')::int, s.ord::int),
       coalesce((s.value ->> 'isPrimary')::boolean, s.ord = 1),
       (s.value ->> 'breedId')::uuid,
       nullif(s.value ->> 'coatId', '')::uuid,
       s.value ->> 'position', s.value ->> 'sizeProminence', s.value ->> 'poseDescription', s.value ->> 'gazeDirection', s.value ->> 'expression'
  FROM public.image_catalog ic
  CROSS JOIN LATERAL jsonb_array_elements(ic.subjects) WITH ORDINALITY AS s(value, ord)
 WHERE ic.subject_count > 1
   AND (s.value ->> 'breedId') ~* '^[0-9a-f-]{36}$'
   AND EXISTS (SELECT 1 FROM public.breeds b WHERE b.id = (s.value ->> 'breedId')::uuid)
   AND (nullif(s.value ->> 'coatId', '') IS NULL OR EXISTS (SELECT 1 FROM public.coats c WHERE c.id = (s.value ->> 'coatId')::uuid))
   AND NOT EXISTS (SELECT 1 FROM public.image_catalog_subjects x WHERE x.image_catalog_id = ic.id);

-- Search document: every pet's breed counts
CREATE OR REPLACE FUNCTION public.design_search_vector(p_id uuid, p_breed_id uuid, p_theme_id uuid, p_outfit_id uuid,
  p_tags text[], p_description text, p_marketing text)
RETURNS tsvector LANGUAGE sql STABLE SET search_path = public AS $$
  WITH RECURSIVE member AS (
    SELECT c.id, c.parent_id, c.name, c.short_name, c.search_terms
      FROM design_collections dc JOIN collections c ON c.id = dc.collection_id
     WHERE dc.image_id = p_id AND NOT dc.excluded AND c.is_active
    UNION
    SELECT p.id, p.parent_id, p.name, p.short_name, p.search_terms
      FROM collections p JOIN member m ON p.id = m.parent_id
  ),
  pet_breeds AS (
    SELECT DISTINCT b.id, b.name, b.alternative_names, b.animal_type
      FROM breeds b
     WHERE b.id = p_breed_id
        OR b.id IN (SELECT s.breed_id FROM image_catalog_subjects s WHERE s.image_catalog_id = p_id)
  ),
  parts AS (
    SELECT
      concat_ws(' ',
        (SELECT string_agg(concat_ws(' ', name, short_name, array_to_string(search_terms, ' ')), ' ') FROM member),
        (SELECT string_agg(concat_ws(' ', name, array_to_string(alternative_names, ' '), animal_type), ' ') FROM pet_breeds)
      ) AS a,
      concat_ws(' ',
        array_to_string(p_tags, ' '),
        (SELECT name FROM outfits WHERE id = p_outfit_id),
        (SELECT name FROM themes WHERE id = p_theme_id)
      ) AS b,
      concat_ws(' ', p_description, left(p_marketing, 600)) AS c
  )
  SELECT setweight(to_tsvector('english', coalesce(a, '')), 'A')
      || setweight(to_tsvector('english', coalesce(b, '')), 'B')
      || setweight(to_tsvector('english', coalesce(c, '')), 'C')
    FROM parts
$$;

CREATE OR REPLACE FUNCTION public.image_catalog_subjects_search_refresh()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE image_catalog SET search_tsv = NULL WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.image_catalog_id ELSE NEW.image_catalog_id END;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS image_catalog_subjects_search_refresh ON public.image_catalog_subjects;
CREATE TRIGGER image_catalog_subjects_search_refresh AFTER INSERT OR UPDATE OR DELETE ON public.image_catalog_subjects
  FOR EACH ROW EXECUTE FUNCTION public.image_catalog_subjects_search_refresh();

-- A design "is" every breed and animal in it, for breed / animal filters
CREATE OR REPLACE FUNCTION public.design_has_breed(p_image_id uuid, p_primary uuid, p_breed uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT p_primary = p_breed OR EXISTS (SELECT 1 FROM image_catalog_subjects s WHERE s.image_catalog_id = p_image_id AND s.breed_id = p_breed)
$$;
CREATE OR REPLACE FUNCTION public.design_has_animal(p_image_id uuid, p_primary uuid, p_animal text)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM breeds b WHERE b.id = p_primary AND b.animal_type = p_animal)
      OR EXISTS (SELECT 1 FROM image_catalog_subjects s JOIN breeds b ON b.id = s.breed_id WHERE s.image_catalog_id = p_image_id AND b.animal_type = p_animal)
$$;

CREATE OR REPLACE FUNCTION public.search_designs(p_query text, p_animal text DEFAULT NULL, p_breed_id uuid DEFAULT NULL,
  p_tag text DEFAULT NULL, p_limit integer DEFAULT 24, p_offset integer DEFAULT 0)
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
   ORDER BY rank DESC, ic.created_at DESC
   LIMIT least(greatest(p_limit, 1), 100) OFFSET greatest(p_offset, 0)
$$;

CREATE OR REPLACE FUNCTION public.collection_designs(p_path text, p_animal text DEFAULT NULL, p_breed_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 24, p_offset integer DEFAULT 0)
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
       AND NOT coalesce(ic.tags, '{}') @> ARRAY['quiz-generated']
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

-- Rebuild search documents with every pet's breed
UPDATE public.image_catalog SET search_tsv = NULL;

COMMIT;

-- Rollback (the search / collection functions can be restored by re-running 2026-10-08 and 2026-10-09):
-- DROP TRIGGER IF EXISTS image_catalog_subjects_search_refresh ON public.image_catalog_subjects; DROP FUNCTION IF EXISTS public.image_catalog_subjects_search_refresh();
-- DROP TRIGGER IF EXISTS image_catalog_sync_subjects ON public.image_catalog; DROP FUNCTION IF EXISTS public.image_catalog_sync_subjects();
-- DROP FUNCTION IF EXISTS public.design_has_breed(uuid, uuid, uuid); DROP FUNCTION IF EXISTS public.design_has_animal(uuid, uuid, text);
-- ALTER TABLE public.image_catalog DROP COLUMN IF EXISTS subject_count;
