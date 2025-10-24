-- Migration: Allow custom images in cart by removing FK constraint
-- Date: 2025-01-24
-- Issue: cart_items.image_id foreign key only references image_catalog,
--        preventing customer_generated_images from being added to cart

-- Background:
-- Cart items store denormalized image data (image_url, image_title) so the
-- foreign key is not required for data integrity. The image_id is used for
-- tracking/reference purposes only.

BEGIN;

-- Step 1: Drop the foreign key constraint
ALTER TABLE cart_items
DROP CONSTRAINT IF EXISTS cart_items_image_id_fkey;

-- Step 2: Make image_id nullable to support custom images
ALTER TABLE cart_items
ALTER COLUMN image_id DROP NOT NULL;

-- Step 3: Add comment explaining the change
COMMENT ON COLUMN cart_items.image_id IS
'Image ID - can reference either image_catalog or customer_generated_images. Nullable to support custom generated images. Image data is denormalized (image_url, image_title stored directly) so FK not required.';

-- Verification: This query should return 0 rows (no orphaned references)
-- SELECT id, image_id FROM cart_items
-- WHERE image_id IS NOT NULL
-- AND image_id NOT IN (SELECT id FROM image_catalog)
-- AND image_id NOT IN (SELECT id FROM customer_generated_images);

COMMIT;

-- Rollback procedure (if needed):
-- BEGIN;
-- ALTER TABLE cart_items ALTER COLUMN image_id SET NOT NULL;
-- ALTER TABLE cart_items ADD CONSTRAINT cart_items_image_id_fkey
--   FOREIGN KEY (image_id) REFERENCES image_catalog(id);
-- COMMIT;
