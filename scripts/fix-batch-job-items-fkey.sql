-- Fix foreign key constraint for batch_job_items.generated_image_id
-- This allows deletion of images from image_catalog while setting the reference to NULL

-- First, drop the existing constraint
ALTER TABLE batch_job_items DROP CONSTRAINT IF EXISTS batch_job_items_generated_image_id_fkey;

-- Add the new constraint with ON DELETE SET NULL
ALTER TABLE batch_job_items 
ADD CONSTRAINT batch_job_items_generated_image_id_fkey 
FOREIGN KEY (generated_image_id) 
REFERENCES image_catalog(id) 
ON DELETE SET NULL;

COMMENT ON CONSTRAINT batch_job_items_generated_image_id_fkey ON batch_job_items 
IS 'Foreign key to image_catalog with SET NULL on delete to allow image cleanup';