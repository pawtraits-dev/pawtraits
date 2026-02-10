-- Add rating column to customer_custom_images table
-- This allows customers to rate their generated portraits to help gauge AI model performance

ALTER TABLE customer_custom_images
ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (rating >= 1 AND rating <= 5);

-- Add comment to explain the column
COMMENT ON COLUMN customer_custom_images.rating IS 'Customer rating (1-5 stars) to gauge AI model performance';

-- Create index for analytics queries
CREATE INDEX IF NOT EXISTS idx_customer_custom_images_rating
ON customer_custom_images(rating)
WHERE rating IS NOT NULL;
