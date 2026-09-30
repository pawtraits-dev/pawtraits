-- =============================================================================
-- Print files cropped per size (S/L are 3:4 crops of a 2:3 / 3:2 reference)
-- Spec: docs/specs/print-aspect-ratios.md
-- Safe to re-run.
-- =============================================================================
BEGIN;

-- order_items.print_image_url now holds the exact-size crop (what Gelato gets).
-- The self-print file adds 1.5 mm bleed for printing onto pre-cut blanks.
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS self_print_file_url text,
  ADD COLUMN IF NOT EXISTS print_file_meta jsonb;

COMMENT ON COLUMN public.order_items.print_file_meta IS
  'How the print file was made: source_px, print_mm, output_px, crop, effective_dpi, quality, mismatch';

-- 4K print masters: re-rendered at 4K when a Large custom portrait is ordered
ALTER TABLE public.customer_custom_images
  ADD COLUMN IF NOT EXISTS print_master_cloudinary_id text,
  ADD COLUMN IF NOT EXISTS print_master_status text,
  ADD COLUMN IF NOT EXISTS print_master_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS print_master_at timestamptz,
  ADD COLUMN IF NOT EXISTS print_master_px integer[],
  ADD COLUMN IF NOT EXISTS print_master_error text;
ALTER TABLE public.customer_custom_images DROP CONSTRAINT IF EXISTS customer_custom_images_print_master_status_check;
ALTER TABLE public.customer_custom_images ADD CONSTRAINT customer_custom_images_print_master_status_check
  CHECK (print_master_status IS NULL OR print_master_status IN ('rendering', 'ready', 'failed'));

-- Reference images must be one of four shapes
ALTER TABLE public.formats DROP CONSTRAINT IF EXISTS formats_aspect_ratio_allowed;
ALTER TABLE public.formats ADD CONSTRAINT formats_aspect_ratio_allowed
  CHECK (aspect_ratio IN ('1:1', '2:3', '3:2', '2:1') OR is_active = false) NOT VALID;
-- Active formats must use an allowed ratio; a legacy format can still be deactivated.
-- NOT VALID: existing rows aren't checked, new and edited rows are. To see any legacy formats:
--   SELECT id, name, aspect_ratio, is_active FROM formats WHERE aspect_ratio NOT IN ('1:1','2:3','3:2','2:1');
-- Once they're fixed or deactivated:  ALTER TABLE public.formats VALIDATE CONSTRAINT formats_aspect_ratio_allowed;

COMMIT;

-- ROLLBACK (manual)
-- ALTER TABLE public.formats DROP CONSTRAINT IF EXISTS formats_aspect_ratio_allowed;
-- ALTER TABLE public.order_items DROP COLUMN IF EXISTS self_print_file_url, DROP COLUMN IF EXISTS print_file_meta;
-- ALTER TABLE public.customer_custom_images DROP CONSTRAINT IF EXISTS customer_custom_images_print_master_status_check,
--   DROP COLUMN IF EXISTS print_master_cloudinary_id, DROP COLUMN IF EXISTS print_master_status, DROP COLUMN IF EXISTS print_master_started_at,
--   DROP COLUMN IF EXISTS print_master_at, DROP COLUMN IF EXISTS print_master_px, DROP COLUMN IF EXISTS print_master_error;
