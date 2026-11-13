-- =============================================================================
-- Migration: Framed cards, phase A (lib/frames/) + the Tarot collection
-- Date: 2026-11-13 · Safe to re-run. Rollback at the bottom.
--
-- * image_catalog.frame_overlay: an ornate frame (medallion, title plate, tagline) drawn by
--   Cloudinary over a clean picture, baked into a stored copy. It keeps the picture without it:
--     { "style": "celestial", "clean_public_id": "...",
--       "applied": { "title", "tagline", "medallion", "at" } | null }
--   A design has either a caption plate (caption_overlay) or a frame, never both.
-- * New collection kind 'tarot': Tarot cards › the 22 Major Arcana, each with its Roman numeral
--   in metadata (also in lib/tarot.ts and lib/collections/definitions.ts).
-- Wording (title/tagline per card or sign) lives in collections.metadata.caption, as for captions.
-- =============================================================================

BEGIN;

ALTER TABLE public.image_catalog ADD COLUMN IF NOT EXISTS frame_overlay jsonb;

ALTER TABLE public.collections DROP CONSTRAINT IF EXISTS collections_kind_check;
ALTER TABLE public.collections ADD CONSTRAINT collections_kind_check
  CHECK (kind IN ('occasion', 'sport', 'pawsonality', 'zodiac', 'group', 'tarot'));

INSERT INTO public.collections (kind, parent_id, slug, path, depth, name, description, sort_order, search_terms)
VALUES ('tarot', NULL, 'tarot', 'tarot', 0, 'Tarot cards',
        'Your pet as a card from the Major Arcana, in an ornate frame.', 60,
        ARRAY['tarot', 'tarot card', 'major arcana', 'oracle', 'fortune'])
ON CONFLICT (path) DO NOTHING;

INSERT INTO public.collections (kind, parent_id, slug, path, depth, name, sort_order, search_terms, metadata)
SELECT 'tarot', p.id, v.slug, 'tarot/' || v.slug, 1, v.name, v.ord, ARRAY[lower(v.name)],
       jsonb_build_object('numeral', v.numeral, 'number', v.num)
  FROM public.collections p,
       (VALUES
               ('the-fool', 'The Fool', 10, '0', 0),
               ('the-magician', 'The Magician', 20, 'I', 1),
               ('the-high-priestess', 'The High Priestess', 30, 'II', 2),
               ('the-empress', 'The Empress', 40, 'III', 3),
               ('the-emperor', 'The Emperor', 50, 'IV', 4),
               ('the-hierophant', 'The Hierophant', 60, 'V', 5),
               ('the-lovers', 'The Lovers', 70, 'VI', 6),
               ('the-chariot', 'The Chariot', 80, 'VII', 7),
               ('strength', 'Strength', 90, 'VIII', 8),
               ('the-hermit', 'The Hermit', 100, 'IX', 9),
               ('wheel-of-fortune', 'Wheel of Fortune', 110, 'X', 10),
               ('justice', 'Justice', 120, 'XI', 11),
               ('the-hanged-man', 'The Hanged Man', 130, 'XII', 12),
               ('death', 'Death', 140, 'XIII', 13),
               ('temperance', 'Temperance', 150, 'XIV', 14),
               ('the-devil', 'The Devil', 160, 'XV', 15),
               ('the-tower', 'The Tower', 170, 'XVI', 16),
               ('the-star', 'The Star', 180, 'XVII', 17),
               ('the-moon', 'The Moon', 190, 'XVIII', 18),
               ('the-sun', 'The Sun', 200, 'XIX', 19),
               ('judgement', 'Judgement', 210, 'XX', 20),
               ('the-world', 'The World', 220, 'XXI', 21)
       ) AS v(slug, name, ord, numeral, num)
 WHERE p.path = 'tarot'
ON CONFLICT (path) DO NOTHING;

COMMIT;

-- Rollback (take frames off first in admin, or the clean pictures are lost to the designs):
-- BEGIN;
-- DELETE FROM public.design_collections WHERE collection_id IN (SELECT id FROM public.collections WHERE path = 'tarot' OR path LIKE 'tarot/%');
-- DELETE FROM public.collections WHERE path LIKE 'tarot/%';
-- DELETE FROM public.collections WHERE path = 'tarot';
-- ALTER TABLE public.collections DROP CONSTRAINT IF EXISTS collections_kind_check;
-- ALTER TABLE public.collections ADD CONSTRAINT collections_kind_check
--   CHECK (kind IN ('occasion', 'sport', 'pawsonality', 'zodiac', 'group'));
-- ALTER TABLE public.image_catalog DROP COLUMN IF EXISTS frame_overlay;
-- COMMIT;
