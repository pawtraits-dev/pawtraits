-- Database Schema Updates for Pawtraits Prompt System
-- Run these commands in your Supabase SQL editor

-- 1. Update styles table to add new optional fields
ALTER TABLE styles 
ADD COLUMN IF NOT EXISTS midjourney_sref TEXT,
ADD COLUMN IF NOT EXISTS reference_image_url TEXT;

-- 2. Create image_catalog table with all required fields and relationships
CREATE TABLE IF NOT EXISTS image_catalog (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    original_filename TEXT NOT NULL,
    public_url TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    description TEXT,
    tags TEXT[],
    prompt_text TEXT,
    ai_model TEXT,
    breed_id UUID REFERENCES breeds(id) ON DELETE SET NULL,
    theme_id UUID REFERENCES themes(id) ON DELETE SET NULL,
    style_id UUID REFERENCES styles(id) ON DELETE SET NULL,
    format_id UUID REFERENCES formats(id) ON DELETE SET NULL,
    coat_id UUID REFERENCES coat_colors(id) ON DELETE SET NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    is_featured BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT true,
    upload_session_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_image_catalog_breed_id ON image_catalog(breed_id);
CREATE INDEX IF NOT EXISTS idx_image_catalog_theme_id ON image_catalog(theme_id);
CREATE INDEX IF NOT EXISTS idx_image_catalog_style_id ON image_catalog(style_id);
CREATE INDEX IF NOT EXISTS idx_image_catalog_format_id ON image_catalog(format_id);
CREATE INDEX IF NOT EXISTS idx_image_catalog_coat_id ON image_catalog(coat_id);
CREATE INDEX IF NOT EXISTS idx_image_catalog_is_featured ON image_catalog(is_featured);
CREATE INDEX IF NOT EXISTS idx_image_catalog_is_public ON image_catalog(is_public);
CREATE INDEX IF NOT EXISTS idx_image_catalog_created_at ON image_catalog(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_image_catalog_rating ON image_catalog(rating);
CREATE INDEX IF NOT EXISTS idx_image_catalog_tags ON image_catalog USING GIN(tags);

-- 4. Create full-text search index for descriptions and prompt text
CREATE INDEX IF NOT EXISTS idx_image_catalog_search ON image_catalog USING GIN(
    to_tsvector('english', COALESCE(description, '') || ' ' || COALESCE(prompt_text, ''))
);

-- 5. Create updated_at trigger for image_catalog
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_image_catalog_updated_at 
    BEFORE UPDATE ON image_catalog 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 6. Create Supabase Storage bucket for pet images (if not exists)
-- Note: This needs to be run in the Supabase dashboard Storage section or via API
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES ('pet-images', 'pet-images', true, 10485760, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
-- ON CONFLICT (id) DO NOTHING;

-- 7. Enable Row Level Security on image_catalog
ALTER TABLE image_catalog ENABLE ROW LEVEL SECURITY;

-- 8. Create RLS policies for image_catalog
CREATE POLICY "Public images are viewable by everyone" ON image_catalog
    FOR SELECT USING (is_public = true);

CREATE POLICY "Users can insert images" ON image_catalog
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own images" ON image_catalog
    FOR UPDATE USING (true);

CREATE POLICY "Users can delete their own images" ON image_catalog
    FOR DELETE USING (true);

-- 9. Grant necessary permissions
GRANT ALL ON image_catalog TO authenticated;
GRANT SELECT ON image_catalog TO anon;

-- 10. Create a view for image catalog with joined details (optional, for better performance)
CREATE OR REPLACE VIEW image_catalog_with_details AS
SELECT 
    ic.*,
    b.name as breed_name,
    t.name as theme_name,
    s.name as style_name,
    f.name as format_name,
    cc.name as coat_name,
    cc.hex_color as coat_hex_color
FROM image_catalog ic
LEFT JOIN breeds b ON ic.breed_id = b.id
LEFT JOIN themes t ON ic.theme_id = t.id  
LEFT JOIN styles s ON ic.style_id = s.id
LEFT JOIN formats f ON ic.format_id = f.id
LEFT JOIN coat_colors cc ON ic.coat_id = cc.id;

-- Grant permissions on the view
GRANT SELECT ON image_catalog_with_details TO authenticated;
GRANT SELECT ON image_catalog_with_details TO anon;