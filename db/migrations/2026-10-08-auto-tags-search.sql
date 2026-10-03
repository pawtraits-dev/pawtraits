-- =============================================================================
-- Migration: Auto-tagging and search (phase 2 of docs/specs/collections-plan.md)
-- Date: 2026-10-08
-- Safe to re-run. Run after 2026-10-07-collections.sql and its seed. Rollback at bottom.
--
-- * image_catalog.display_tags: the customer-facing descriptive tags ("crown", "tartan",
--   "snow"), written by the auto-tagger and editable in Admin → Collections → Tagging.
--   The old `tags` column is left alone (it carries system markers like quiz-generated).
-- * design_collections.excluded: an admin "not in this collection" that theme filing and
--   auto-tagging respect.
-- * image_catalog.search_tsv: a weighted search document (collections, team nicknames and
--   breed first, then tags, then description), kept up to date by triggers.
-- * search_designs(): ranked design search used by /api/public/search.
-- =============================================================================

BEGIN;

ALTER TABLE public.image_catalog
  ADD COLUMN IF NOT EXISTS display_tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS display_tags_edited boolean NOT NULL DEFAULT false,  -- admin edited: auto-tagger keeps them
  ADD COLUMN IF NOT EXISTS auto_tag jsonb,                                      -- last tagger answer (collections, team, confidence, model)
  ADD COLUMN IF NOT EXISTS auto_tagged_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_tag_error text,
  ADD COLUMN IF NOT EXISTS search_tsv tsvector;

ALTER TABLE public.design_collections
  ADD COLUMN IF NOT EXISTS excluded boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS image_catalog_search_idx ON public.image_catalog USING gin (search_tsv);
CREATE INDEX IF NOT EXISTS image_catalog_display_tags_idx ON public.image_catalog USING gin (display_tags);
CREATE INDEX IF NOT EXISTS image_catalog_untagged_idx ON public.image_catalog (created_at) WHERE auto_tagged_at IS NULL;

-- Counts leave out admin exclusions
CREATE OR REPLACE VIEW public.collection_design_counts WITH (security_invoker = true) AS
  SELECT collection_id, count(*)::int AS designs,
         count(*) FILTER (WHERE source = 'theme')::int AS from_themes,
         count(*) FILTER (WHERE source = 'auto')::int AS from_auto,
         count(*) FILTER (WHERE source = 'admin')::int AS from_admin
  FROM public.design_collections WHERE NOT excluded GROUP BY collection_id;

-- Theme filing never removes or overrides an admin exclusion
CREATE OR REPLACE FUNCTION public.apply_theme_collection(p_theme_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target uuid; added integer;
BEGIN
  SELECT default_collection_id INTO target FROM themes WHERE id = p_theme_id;
  DELETE FROM design_collections dc USING image_catalog ic
   WHERE dc.image_id = ic.id AND ic.theme_id = p_theme_id AND dc.source = 'theme'
     AND (target IS NULL OR dc.collection_id <> target);
  IF target IS NULL THEN RETURN 0; END IF;
  INSERT INTO design_collections (image_id, collection_id, source)
  SELECT id, target, 'theme' FROM image_catalog WHERE theme_id = p_theme_id AND NOT coalesce(is_customer_generated, false)
  ON CONFLICT (image_id, collection_id) DO NOTHING;
  GET DIAGNOSTICS added = ROW_COUNT;
  RETURN added;
END $$;

-- Customers' own customisations are never filed into collections
CREATE OR REPLACE FUNCTION public.file_design_by_theme()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.theme_id IS NOT DISTINCT FROM OLD.theme_id THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM design_collections WHERE image_id = NEW.id AND source = 'theme';
  END IF;
  IF NEW.theme_id IS NOT NULL AND NOT coalesce(NEW.is_customer_generated, false) THEN
    SELECT default_collection_id INTO target FROM themes WHERE id = NEW.theme_id;
    IF target IS NOT NULL THEN
      INSERT INTO design_collections (image_id, collection_id, source) VALUES (NEW.id, target, 'theme')
      ON CONFLICT (image_id, collection_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- The weighted search document for one design
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
  parts AS (
    SELECT
      concat_ws(' ',
        (SELECT string_agg(concat_ws(' ', name, short_name, array_to_string(search_terms, ' ')), ' ') FROM member),
        (SELECT concat_ws(' ', b.name, array_to_string(b.alternative_names, ' '), b.animal_type) FROM breeds b WHERE b.id = p_breed_id)
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

CREATE OR REPLACE FUNCTION public.image_catalog_search_doc()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.search_tsv := design_search_vector(NEW.id, NEW.breed_id, NEW.theme_id, NEW.outfit_id,
    NEW.display_tags, NEW.description, NEW.marketing_description);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS image_catalog_search_doc ON public.image_catalog;
CREATE TRIGGER image_catalog_search_doc BEFORE INSERT OR UPDATE OF breed_id, theme_id, outfit_id, display_tags, description, marketing_description, search_tsv
  ON public.image_catalog FOR EACH ROW EXECUTE FUNCTION public.image_catalog_search_doc();

-- Collection membership changes refresh that design's document
CREATE OR REPLACE FUNCTION public.design_collections_search_refresh()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE image_catalog SET search_tsv = NULL WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.image_id ELSE NEW.image_id END;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS design_collections_search_refresh ON public.design_collections;
CREATE TRIGGER design_collections_search_refresh AFTER INSERT OR UPDATE OR DELETE ON public.design_collections
  FOR EACH ROW EXECUTE FUNCTION public.design_collections_search_refresh();

-- Renaming a collection or changing its search words refreshes its designs (and those of its children)
CREATE OR REPLACE FUNCTION public.collections_search_refresh()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name OR NEW.short_name IS DISTINCT FROM OLD.short_name
     OR NEW.search_terms IS DISTINCT FROM OLD.search_terms OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    UPDATE image_catalog SET search_tsv = NULL WHERE id IN (
      SELECT dc.image_id FROM design_collections dc JOIN collections c ON c.id = dc.collection_id
       WHERE c.path = NEW.path OR c.path LIKE NEW.path || '/%');
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS collections_search_refresh ON public.collections;
CREATE TRIGGER collections_search_refresh AFTER UPDATE ON public.collections
  FOR EACH ROW EXECUTE FUNCTION public.collections_search_refresh();

-- Ranked search. p_query is a to_tsquery string built by lib/search/query.ts (synonyms expanded);
-- p_tag narrows to designs with that display tag ("See more crown designs"). Either may be NULL.
-- Only public, listed, catalogue designs (not customers' own customisations).
DROP FUNCTION IF EXISTS public.search_designs(text, text, uuid, integer, integer);
CREATE OR REPLACE FUNCTION public.search_designs(p_query text, p_animal text DEFAULT NULL, p_breed_id uuid DEFAULT NULL,
  p_tag text DEFAULT NULL, p_limit integer DEFAULT 24, p_offset integer DEFAULT 0)
RETURNS TABLE (id uuid, rank real, total bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ic.id,
         (CASE WHEN p_query IS NULL THEN 0 ELSE ts_rank_cd(ic.search_tsv, to_tsquery('english', p_query), 1) END
          + least(coalesce(ic.like_count, 0) + coalesce(ic.share_count, 0), 50) / 500.0)::real AS rank,
         count(*) OVER () AS total
    FROM image_catalog ic
    LEFT JOIN breeds b ON b.id = ic.breed_id
   WHERE (p_query IS NULL OR ic.search_tsv @@ to_tsquery('english', p_query))
     AND (p_tag IS NULL OR ic.display_tags @> ARRAY[p_tag])
     AND (p_query IS NOT NULL OR p_tag IS NOT NULL)
     AND ic.is_public IS TRUE
     AND NOT coalesce(ic.is_customer_generated, false)
     AND NOT coalesce(ic.tags, '{}') @> ARRAY['quiz-generated']
     AND (p_breed_id IS NULL OR ic.breed_id = p_breed_id)
     AND (p_animal IS NULL OR b.animal_type = p_animal)
   ORDER BY rank DESC, ic.created_at DESC
   LIMIT least(greatest(p_limit, 1), 100) OFFSET greatest(p_offset, 0)
$$;
REVOKE ALL ON FUNCTION public.search_designs(text, text, uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_designs(text, text, uuid, text, integer, integer) TO service_role;

-- Build the search document for every existing design
UPDATE public.image_catalog SET search_tsv = NULL;

INSERT INTO public.app_settings (key, value, description)
VALUES ('auto_tag_enabled', 'true'::jsonb, 'Tag new catalogue designs automatically (collections, team, descriptive tags)')
ON CONFLICT (key) DO NOTHING;

COMMIT;

-- Rollback:
-- DROP FUNCTION IF EXISTS public.search_designs(text, text, uuid, text, integer, integer);
-- DROP TRIGGER IF EXISTS collections_search_refresh ON public.collections; DROP FUNCTION IF EXISTS public.collections_search_refresh();
-- DROP TRIGGER IF EXISTS design_collections_search_refresh ON public.design_collections; DROP FUNCTION IF EXISTS public.design_collections_search_refresh();
-- DROP TRIGGER IF EXISTS image_catalog_search_doc ON public.image_catalog; DROP FUNCTION IF EXISTS public.image_catalog_search_doc();
-- DROP FUNCTION IF EXISTS public.design_search_vector(uuid, uuid, uuid, uuid, text[], text, text);
-- ALTER TABLE public.design_collections DROP COLUMN IF EXISTS excluded;
-- ALTER TABLE public.image_catalog DROP COLUMN IF EXISTS display_tags, DROP COLUMN IF EXISTS display_tags_edited,
--   DROP COLUMN IF EXISTS auto_tag, DROP COLUMN IF EXISTS auto_tagged_at, DROP COLUMN IF EXISTS auto_tag_error, DROP COLUMN IF EXISTS search_tsv;
-- DELETE FROM public.app_settings WHERE key = 'auto_tag_enabled';
