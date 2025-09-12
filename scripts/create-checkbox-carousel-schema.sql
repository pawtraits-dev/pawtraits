-- New Checkbox-based Carousel System
-- This replaces the manual slide system with theme/breed selection

-- Create new table for carousel content selections
CREATE TABLE IF NOT EXISTS carousel_content_selections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    carousel_id UUID NOT NULL REFERENCES carousels(id) ON DELETE CASCADE,
    
    -- Content type and reference
    content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('theme', 'dog_breed', 'cat_breed')),
    content_id UUID NOT NULL, -- References themes.id or breeds.id
    
    -- Display settings
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    
    -- Custom overrides (optional - use content defaults if null)
    custom_title VARCHAR(255),
    custom_subtitle VARCHAR(255), 
    custom_description TEXT,
    custom_cta_text VARCHAR(100),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    
    -- Ensure unique selections per carousel
    UNIQUE(carousel_id, content_type, content_id)
);

-- Add indexes for performance
CREATE INDEX idx_carousel_content_selections_carousel_id ON carousel_content_selections(carousel_id);
CREATE INDEX idx_carousel_content_selections_content ON carousel_content_selections(content_type, content_id);
CREATE INDEX idx_carousel_content_selections_active ON carousel_content_selections(is_active);
CREATE INDEX idx_carousel_content_selections_sort ON carousel_content_selections(carousel_id, sort_order);

-- Add RLS policies
ALTER TABLE carousel_content_selections ENABLE ROW LEVEL SECURITY;

-- Admin can manage all carousel selections
CREATE POLICY "Admin can manage carousel content selections" ON carousel_content_selections
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.id = auth.uid() 
            AND user_profiles.user_type = 'admin'
        )
    );

-- Public can view active carousel selections (for display)
CREATE POLICY "Public can view active carousel content selections" ON carousel_content_selections
    FOR SELECT USING (is_active = true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_carousel_content_selections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_carousel_content_selections_updated_at
    BEFORE UPDATE ON carousel_content_selections
    FOR EACH ROW
    EXECUTE FUNCTION update_carousel_content_selections_updated_at();

-- Add comment explaining the new system
COMMENT ON TABLE carousel_content_selections IS 'Stores which themes/breeds are selected for display in carousels. Replaces manual slide creation with checkbox-based content selection.';
COMMENT ON COLUMN carousel_content_selections.content_type IS 'Type of content: theme, dog_breed, or cat_breed';
COMMENT ON COLUMN carousel_content_selections.content_id IS 'ID of the theme or breed record';
COMMENT ON COLUMN carousel_content_selections.custom_title IS 'Optional override for the theme/breed name';
COMMENT ON COLUMN carousel_content_selections.custom_cta_text IS 'Optional override for CTA button text (defaults to "View [Type]")';

-- Create view for easy carousel content retrieval with all data
CREATE OR REPLACE VIEW carousel_content_with_details AS
SELECT 
    ccs.id,
    ccs.carousel_id,
    ccs.content_type,
    ccs.content_id,
    ccs.sort_order,
    ccs.is_active,
    ccs.created_at,
    ccs.updated_at,
    
    -- Title: custom override or content name
    COALESCE(ccs.custom_title, 
        CASE ccs.content_type 
            WHEN 'theme' THEN t.name
            WHEN 'dog_breed' THEN b.name
            WHEN 'cat_breed' THEN b.name
            ELSE 'Unknown'
        END
    ) as title,
    
    -- Subtitle: custom override or content description (first 100 chars)
    COALESCE(ccs.custom_subtitle,
        CASE ccs.content_type 
            WHEN 'theme' THEN LEFT(t.description, 100)
            WHEN 'dog_breed' THEN CONCAT('Dog Breed • ', LEFT(b.description, 80))
            WHEN 'cat_breed' THEN CONCAT('Cat Breed • ', LEFT(b.description, 80))
            ELSE ''
        END
    ) as subtitle,
    
    -- Description: custom override or full content description
    COALESCE(ccs.custom_description,
        CASE ccs.content_type 
            WHEN 'theme' THEN t.description
            WHEN 'dog_breed' THEN b.description
            WHEN 'cat_breed' THEN b.description
            ELSE ''
        END
    ) as description,
    
    -- Hero image URL
    CASE ccs.content_type 
        WHEN 'theme' THEN t.hero_image_url
        WHEN 'dog_breed' THEN b.hero_image_url
        WHEN 'cat_breed' THEN b.hero_image_url
        ELSE NULL
    END as hero_image_url,
    
    -- Hero image alt text
    CASE ccs.content_type 
        WHEN 'theme' THEN t.hero_image_alt
        WHEN 'dog_breed' THEN b.hero_image_alt
        WHEN 'cat_breed' THEN b.hero_image_alt
        ELSE NULL
    END as hero_image_alt,
    
    -- CTA text and URL
    COALESCE(ccs.custom_cta_text,
        CASE ccs.content_type 
            WHEN 'theme' THEN 'Explore Theme'
            WHEN 'dog_breed' THEN 'View Breed'
            WHEN 'cat_breed' THEN 'View Breed'
            ELSE 'View More'
        END
    ) as cta_text,
    
    -- Generate CTA URL for filtered shop view
    CASE ccs.content_type 
        WHEN 'theme' THEN CONCAT('/customer/shop?theme=', REPLACE(LOWER(t.name), ' ', '+'))
        WHEN 'dog_breed' THEN CONCAT('/customer/shop?breed=', REPLACE(LOWER(b.name), ' ', '+'), '&animal=dog')
        WHEN 'cat_breed' THEN CONCAT('/customer/shop?breed=', REPLACE(LOWER(b.name), ' ', '+'), '&animal=cat')
        ELSE '/customer/shop'
    END as cta_url,
    
    -- Additional metadata
    CASE ccs.content_type 
        WHEN 'theme' THEN t.color_palette
        ELSE NULL
    END as theme_color_palette,
    
    CASE ccs.content_type 
        WHEN 'dog_breed' THEN b.animal_type
        WHEN 'cat_breed' THEN b.animal_type
        ELSE NULL
    END as breed_animal_type

FROM carousel_content_selections ccs
LEFT JOIN themes t ON ccs.content_type = 'theme' AND ccs.content_id = t.id
LEFT JOIN breeds b ON ccs.content_type IN ('dog_breed', 'cat_breed') AND ccs.content_id = b.id
WHERE (
    (ccs.content_type = 'theme' AND t.id IS NOT NULL) OR
    (ccs.content_type IN ('dog_breed', 'cat_breed') AND b.id IS NOT NULL)
)
ORDER BY ccs.carousel_id, ccs.sort_order;

-- Grant permissions on the view
GRANT SELECT ON carousel_content_with_details TO authenticated;
GRANT SELECT ON carousel_content_with_details TO anon;