-- =============================================================================
-- Migration: Collections (phase 1 of docs/specs/collections-plan.md)
-- Date: 2026-10-07
-- Safe to re-run. Rollback at bottom. Seed: 2026-10-07-collections-seed.sql (run after this).
--
-- Customers browse by breed first, then a few curated collections: Occasions, Sports (leagues
-- and teams), 16 Pawsonalities, 12 Zodiac signs. Themes stay as internal production recipes;
-- each theme can point to a default collection so its designs are collected automatically.
-- Sports teams are collections too (Sports › NFL › Kansas City Chiefs), each linked to an
-- outfits row holding the team's kit prompt.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('occasion', 'sport', 'pawsonality', 'zodiac')),
  parent_id uuid REFERENCES public.collections(id) ON DELETE CASCADE,
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  path text NOT NULL UNIQUE,                    -- 'occasions/christmas', 'sports/nfl/kansas-city-chiefs'
  depth integer NOT NULL DEFAULT 0,             -- 0 = top (Occasions), 1 = Christmas / NFL, 2 = a team
  name text NOT NULL,
  short_name text,                              -- 'Chiefs', 'Man City'
  description text,
  season_windows jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{"start":"11-01","end":"12-26"}], promoted only inside
  hero_image_id uuid REFERENCES public.image_catalog(id) ON DELETE SET NULL,
  outfit_id uuid REFERENCES public.outfits(id) ON DELETE SET NULL,   -- sports teams: kit prompt
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,  -- teams: colours, nicknames, kit, recolour prompt; zodiac: dates; pawsonality: code, names
  search_terms text[] NOT NULL DEFAULT '{}',    -- extra words search should match ('xmas', 'toon', 'the u')
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_id, slug)
);
CREATE INDEX IF NOT EXISTS collections_parent_idx ON public.collections (parent_id, sort_order);
CREATE INDEX IF NOT EXISTS collections_kind_idx ON public.collections (kind, depth);

-- Which designs are in which collections (a design can be in several)
CREATE TABLE IF NOT EXISTS public.design_collections (
  image_id uuid NOT NULL REFERENCES public.image_catalog(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'admin' CHECK (source IN ('theme', 'auto', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (image_id, collection_id)
);
CREATE INDEX IF NOT EXISTS design_collections_collection_idx ON public.design_collections (collection_id);

-- Themes are internal now; each can file its designs into a collection
ALTER TABLE public.themes
  ADD COLUMN IF NOT EXISTS default_collection_id uuid REFERENCES public.collections(id) ON DELETE SET NULL;


-- Design counts per collection (Admin → Collections; customer pages hide empty collections)
CREATE OR REPLACE VIEW public.collection_design_counts WITH (security_invoker = true) AS
  SELECT collection_id, count(*)::int AS designs,
         count(*) FILTER (WHERE source = 'theme')::int AS from_themes,
         count(*) FILTER (WHERE source = 'auto')::int AS from_auto,
         count(*) FILTER (WHERE source = 'admin')::int AS from_admin
  FROM public.design_collections GROUP BY collection_id;

-- File every design of a theme into the theme's collection (and take back theme-filed links
-- that no longer match). Admin- and auto-filed links are never touched. Returns rows added.
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
  SELECT id, target, 'theme' FROM image_catalog WHERE theme_id = p_theme_id
  ON CONFLICT (image_id, collection_id) DO NOTHING;
  GET DIAGNOSTICS added = ROW_COUNT;
  RETURN added;
END $$;
REVOKE ALL ON FUNCTION public.apply_theme_collection(uuid) FROM PUBLIC, anon, authenticated;

-- New designs (and designs moved to another theme) are filed automatically
CREATE OR REPLACE FUNCTION public.file_design_by_theme()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.theme_id IS NOT DISTINCT FROM OLD.theme_id THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM design_collections WHERE image_id = NEW.id AND source = 'theme';
  END IF;
  IF NEW.theme_id IS NOT NULL THEN
    SELECT default_collection_id INTO target FROM themes WHERE id = NEW.theme_id;
    IF target IS NOT NULL THEN
      INSERT INTO design_collections (image_id, collection_id, source) VALUES (NEW.id, target, 'theme')
      ON CONFLICT (image_id, collection_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS image_catalog_file_by_theme ON public.image_catalog;
CREATE TRIGGER image_catalog_file_by_theme AFTER INSERT OR UPDATE OF theme_id ON public.image_catalog
  FOR EACH ROW EXECUTE FUNCTION public.file_design_by_theme();

ALTER TABLE public.collections        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.design_collections ENABLE ROW LEVEL SECURITY;
-- No public policies yet: everything goes through the API with the service role (customer pages in phase 3)
GRANT ALL ON public.collections, public.design_collections TO service_role;
GRANT SELECT ON public.collection_design_counts TO service_role;
REVOKE ALL ON public.collection_design_counts FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_theme_collection(uuid) TO service_role;

COMMIT;

-- Rollback:
-- DROP TRIGGER IF EXISTS image_catalog_file_by_theme ON public.image_catalog;
-- DROP FUNCTION IF EXISTS public.file_design_by_theme(); DROP FUNCTION IF EXISTS public.apply_theme_collection(uuid);
-- DROP VIEW IF EXISTS public.collection_design_counts;
-- ALTER TABLE public.themes DROP COLUMN IF EXISTS default_collection_id;
-- DROP TABLE IF EXISTS public.design_collections;
-- DROP TABLE IF EXISTS public.collections;
-- DELETE FROM public.outfits WHERE slug LIKE 'team-%';
