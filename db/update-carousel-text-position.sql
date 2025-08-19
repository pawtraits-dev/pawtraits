-- Update carousel_slides table to include 'bottom-center' text position option
-- This adds the new positioning option to the existing CHECK constraint

-- Drop the old constraint
ALTER TABLE carousel_slides 
DROP CONSTRAINT IF EXISTS carousel_slides_text_position_check;

-- Add the updated constraint with 'bottom-center' included
ALTER TABLE carousel_slides 
ADD CONSTRAINT carousel_slides_text_position_check 
CHECK (text_position IN ('center', 'left', 'right', 'bottom-left', 'bottom-center', 'bottom-right', 'top-left', 'top-right'));

-- Verify the constraint was applied correctly
SELECT conname, consrc 
FROM pg_constraint 
WHERE conname = 'carousel_slides_text_position_check';