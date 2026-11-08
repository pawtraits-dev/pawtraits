-- =============================================================================
-- Migration: Captions on Pawsonality and Zodiac pictures (lib/captions/)
-- Date: 2026-11-08 · Safe to re-run.
--
-- A translucent gold plate with the type or sign and its tagline, drawn by Cloudinary on a
-- stored copy of the picture. caption_overlay keeps the picture without it:
--   { "clean_public_id": "...", "applied": { "title", "tagline", "symbol", "at" } | null }
-- Wording lives in collections.metadata.caption (Admin → Collections → Captions); no column.
-- =============================================================================
ALTER TABLE public.image_catalog ADD COLUMN IF NOT EXISTS caption_overlay jsonb;

-- Rollback: ALTER TABLE public.image_catalog DROP COLUMN IF EXISTS caption_overlay;
