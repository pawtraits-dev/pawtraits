-- Simple carousel tables creation script
-- Run this in the Supabase SQL editor

-- Create carousels table
CREATE TABLE IF NOT EXISTS carousels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    page_type VARCHAR(50) NOT NULL CHECK (page_type IN ('home', 'dogs', 'cats', 'themes')),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    auto_play_interval INTEGER DEFAULT 6000,
    show_thumbnails BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_carousels_page_type ON carousels(page_type);
CREATE INDEX IF NOT EXISTS idx_carousels_is_active ON carousels(is_active);
CREATE INDEX IF NOT EXISTS idx_carousel_slides_carousel_id ON carousel_slides(carousel_id);
CREATE INDEX IF NOT EXISTS idx_carousel_slides_sort_order ON carousel_slides(sort_order);
CREATE INDEX IF NOT EXISTS idx_carousel_slides_is_active ON carousel_slides(is_active);

-- Enable Row Level Security
ALTER TABLE carousels ENABLE ROW LEVEL SECURITY;
ALTER TABLE carousel_slides ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Public can view active carousels" ON carousels FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "Public can view active slides" ON carousel_slides FOR SELECT TO anon, authenticated USING (is_active = true);

-- Insert default carousels
INSERT INTO carousels (name, page_type, description, is_active) VALUES
('Home Page Carousel', 'home', 'Main carousel for the homepage', true),
('Dogs Page Carousel', 'dogs', 'Carousel for the dogs gallery page', true),
('Cats Page Carousel', 'cats', 'Carousel for the cats gallery page', true),
('Themes Page Carousel', 'themes', 'Carousel for the themes gallery page', true)
ON CONFLICT DO NOTHING;