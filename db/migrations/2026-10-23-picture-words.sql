-- =============================================================================
-- Migration: Words on the picture ("Please be seated, the Cocker Spaniel will see you shortly")
-- Date: 2026-10-23. Safe to re-run. Rollback at bottom.
--
-- Designs with words on them keep a text-free copy (uploaded by admin) and the wording as a
-- template; the words are drawn on by Cloudinary (never painted by AI, so always spelled right):
--   catalogue designs and their breed versions  "the <breed>" (breeds.short_name when set)
--   customer pictures                           their pet's name, or their breed
-- The stored picture of a design has its own breed's words drawn on, so every page, print file
-- and sticker shows them with no other changes.
-- =============================================================================

BEGIN;

-- { template, font, size, colour, align, line_spacing, box: {x,y,w,h}, aspect,
--   clean_public_id, original_public_id, applied: {text, at} }   (NULL = no words)
ALTER TABLE public.image_catalog
  ADD COLUMN IF NOT EXISTS text_overlay jsonb;

-- How a breed reads in a sentence: "Cavalier" for Cavalier King Charles Spaniel (NULL = its name)
ALTER TABLE public.breeds
  ADD COLUMN IF NOT EXISTS short_name text;

COMMIT;

-- A few long names, as a start (edit in Admin → Breeds):
-- UPDATE public.breeds SET short_name = 'Cavalier' WHERE name ILIKE 'Cavalier King Charles Spaniel';
-- UPDATE public.breeds SET short_name = 'Staffie' WHERE name ILIKE 'Staffordshire Bull Terrier';
-- UPDATE public.breeds SET short_name = 'Westie' WHERE name ILIKE 'West Highland White Terrier';

-- Rollback:
-- ALTER TABLE public.image_catalog DROP COLUMN IF EXISTS text_overlay;
-- ALTER TABLE public.breeds DROP COLUMN IF EXISTS short_name;
