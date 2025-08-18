-- Carousel Management System Schema
-- This schema allows admin users to create and manage carousels for different pages

-- Create carousels table
CREATE TABLE IF NOT EXISTS carousels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    page_type VARCHAR(50) NOT NULL CHECK (page_type IN ('home', 'dogs', 'cats', 'themes')),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    auto_play_interval INTEGER DEFAULT 6000, -- milliseconds
    show_thumbnails BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES user_profiles(id),
    
    -- Ensure only one active carousel per page type
    UNIQUE(page_type, is_active) WHERE is_active = true
);

-- Create carousel_slides table
CREATE TABLE IF NOT EXISTS carousel_slides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    carousel_id UUID NOT NULL REFERENCES carousels(id) ON DELETE CASCADE,
    
    -- Image information
    image_url VARCHAR(500) NOT NULL,
    image_alt TEXT,
    cloudinary_public_id VARCHAR(255),
    
    -- Content overlay information
    title VARCHAR(255),
    subtitle VARCHAR(255),
    description TEXT,
    
    -- Call-to-action button
    cta_text VARCHAR(100),
    cta_url VARCHAR(500),
    cta_style VARCHAR(50) DEFAULT 'primary' CHECK (cta_style IN ('primary', 'secondary', 'outline')),
    
    -- Display settings
    text_position VARCHAR(50) DEFAULT 'center' CHECK (text_position IN ('center', 'left', 'right', 'bottom-left', 'bottom-right', 'top-left', 'top-right')),
    text_color VARCHAR(50) DEFAULT 'white' CHECK (text_color IN ('white', 'black', 'purple', 'blue')),
    show_overlay BOOLEAN DEFAULT true,
    overlay_opacity INTEGER DEFAULT 40 CHECK (overlay_opacity >= 0 AND overlay_opacity <= 100),
    
    -- Ordering and status
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES user_profiles(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_carousels_page_type ON carousels(page_type);
CREATE INDEX IF NOT EXISTS idx_carousels_is_active ON carousels(is_active);
CREATE INDEX IF NOT EXISTS idx_carousel_slides_carousel_id ON carousel_slides(carousel_id);
CREATE INDEX IF NOT EXISTS idx_carousel_slides_sort_order ON carousel_slides(sort_order);
CREATE INDEX IF NOT EXISTS idx_carousel_slides_is_active ON carousel_slides(is_active);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_carousels_updated_at ON carousels;
CREATE TRIGGER update_carousels_updated_at
    BEFORE UPDATE ON carousels
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_carousel_slides_updated_at ON carousel_slides;
CREATE TRIGGER update_carousel_slides_updated_at
    BEFORE UPDATE ON carousel_slides
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE carousels ENABLE ROW LEVEL SECURITY;
ALTER TABLE carousel_slides ENABLE ROW LEVEL SECURITY;

-- RLS Policies for carousels table
CREATE POLICY "Admin users can manage all carousels"
ON carousels FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() 
        AND user_type = 'admin'
    )
);

CREATE POLICY "Public users can view active carousels"
ON carousels FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- RLS Policies for carousel_slides table
CREATE POLICY "Admin users can manage all carousel slides"
ON carousel_slides FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() 
        AND user_type = 'admin'
    )
);

CREATE POLICY "Public users can view active carousel slides"
ON carousel_slides FOR SELECT
TO anon, authenticated
USING (
    is_active = true 
    AND EXISTS (
        SELECT 1 FROM carousels 
        WHERE id = carousel_slides.carousel_id 
        AND is_active = true
    )
);

-- Insert default carousels for each page type
INSERT INTO carousels (name, page_type, description) VALUES
('Home Page Carousel', 'home', 'Main carousel for the homepage'),
('Dogs Page Carousel', 'dogs', 'Carousel for the dogs gallery page'),
('Cats Page Carousel', 'cats', 'Carousel for the cats gallery page'),
('Themes Page Carousel', 'themes', 'Carousel for the themes gallery page')
ON CONFLICT (page_type, is_active) DO NOTHING;

-- Create view for easy carousel management
CREATE OR REPLACE VIEW carousel_management_view AS
SELECT 
    c.id,
    c.name,
    c.page_type,
    c.description,
    c.is_active,
    c.auto_play_interval,
    c.show_thumbnails,
    c.created_at,
    c.updated_at,
    COUNT(cs.id) as slide_count,
    COUNT(CASE WHEN cs.is_active THEN 1 END) as active_slide_count
FROM carousels c
LEFT JOIN carousel_slides cs ON c.id = cs.carousel_id
GROUP BY c.id, c.name, c.page_type, c.description, c.is_active, 
         c.auto_play_interval, c.show_thumbnails, c.created_at, c.updated_at
ORDER BY c.page_type, c.created_at;

COMMENT ON TABLE carousels IS 'Stores carousel configurations for different pages';
COMMENT ON TABLE carousel_slides IS 'Stores individual slides for each carousel with content and CTA information';
COMMENT ON VIEW carousel_management_view IS 'Administrative view showing carousel summary with slide counts';