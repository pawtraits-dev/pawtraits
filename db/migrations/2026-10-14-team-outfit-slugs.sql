-- =============================================================================
-- Migration: restore team kit outfit slugs
-- Date: 2026-10-14. Safe to re-run; no rollback needed.
--
-- Editing an outfit in Admin → Outfits used to regenerate its slug from the name
-- ("Arsenal kit" → "arsenal-kit"). Team kits are recognised by their slug
-- (team-<league>-<team>), so an edited kit dropped out of its league. The API no
-- longer changes slugs on edit; this puts back any that were changed, using the
-- sports collection each kit belongs to (collections.outfit_id, path sports/<league>/<team>).
-- =============================================================================

UPDATE public.outfits o
   SET slug = 'team-' || split_part(c.path, '/', 2) || '-' || split_part(c.path, '/', 3),
       updated_at = now()
  FROM public.collections c
 WHERE c.outfit_id = o.id
   AND c.kind = 'sport'
   AND c.depth = 2
   AND c.path LIKE 'sports/%/%'
   AND o.slug IS DISTINCT FROM 'team-' || split_part(c.path, '/', 2) || '-' || split_part(c.path, '/', 3);

-- Show what's linked now (every row should have a team-… slug)
SELECT c.path, o.name, o.slug
  FROM public.collections c JOIN public.outfits o ON o.id = c.outfit_id
 WHERE c.kind = 'sport' AND o.slug NOT LIKE 'team-%';
