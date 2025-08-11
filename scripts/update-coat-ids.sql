-- Update coat_id in image_catalog table based on tags[2] (second tag)
-- This script matches the coat color name in tags[1] with the coat name in the coats table

UPDATE image_catalog 
SET coat_id = coats.id
FROM coats 
WHERE image_catalog.coat_id IS NULL 
  AND array_length(image_catalog.tags, 1) >= 2 
  AND LOWER(TRIM(image_catalog.tags[2])) = LOWER(TRIM(coats.name));

-- Optional: Show results of the update
SELECT 
  ic.id,
  ic.tags[2] as coat_tag,
  c.name as matched_coat_name,
  ic.coat_id
FROM image_catalog ic
JOIN coats c ON ic.coat_id = c.id
WHERE ic.tags[2] IS NOT NULL
ORDER BY ic.created_at DESC
LIMIT 10;