-- Database Schema Updates for Pawtraits Prompt System - Clean Installation
-- This version handles existing objects gracefully

-- 1. Update styles table to add new optional fields (only if columns don't exist)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='styles' AND column_name='midjourney_sref') THEN
        ALTER TABLE styles ADD COLUMN midjourney_sref TEXT;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='styles' AND column_name='reference_image_url') THEN
        ALTER TABLE styles ADD COLUMN reference_image_url TEXT;
    END IF;
END $$;

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
    coat_id UUID REFERENCES coats(id) ON DELETE SET NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    is_featured BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT true,
    upload_session_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create indexes for better query performance (only if not exists)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_image_catalog_breed_id') THEN
        CREATE INDEX idx_image_catalog_breed_id ON image_catalog(breed_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_image_catalog_theme_id') THEN
        CREATE INDEX idx_image_catalog_theme_id ON image_catalog(theme_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_image_catalog_style_id') THEN
        CREATE INDEX idx_image_catalog_style_id ON image_catalog(style_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_image_catalog_format_id') THEN
        CREATE INDEX idx_image_catalog_format_id ON image_catalog(format_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_image_catalog_coat_id') THEN
        CREATE INDEX idx_image_catalog_coat_id ON image_catalog(coat_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_image_catalog_is_featured') THEN
        CREATE INDEX idx_image_catalog_is_featured ON image_catalog(is_featured);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_image_catalog_is_public') THEN
        CREATE INDEX idx_image_catalog_is_public ON image_catalog(is_public);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_image_catalog_created_at') THEN
        CREATE INDEX idx_image_catalog_created_at ON image_catalog(created_at DESC);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_image_catalog_rating') THEN
        CREATE INDEX idx_image_catalog_rating ON image_catalog(rating);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_image_catalog_tags') THEN
        CREATE INDEX idx_image_catalog_tags ON image_catalog USING GIN(tags);
    END IF;
END $$;

-- 4. Create full-text search index for descriptions and prompt text
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_image_catalog_search') THEN
        CREATE INDEX idx_image_catalog_search ON image_catalog USING GIN(
            to_tsvector('english', COALESCE(description, '') || ' ' || COALESCE(prompt_text, ''))
        );
    END IF;
END $$;

-- 5. Create or replace updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 6. Create updated_at trigger for image_catalog (drop and recreate to handle conflicts)
DROP TRIGGER IF EXISTS update_image_catalog_updated_at ON image_catalog;
CREATE TRIGGER update_image_catalog_updated_at 
    BEFORE UPDATE ON image_catalog 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 7. Enable Row Level Security on image_catalog
ALTER TABLE image_catalog ENABLE ROW LEVEL SECURITY;

-- 8. Drop and recreate RLS policies for image_catalog
DROP POLICY IF EXISTS "Public images are viewable by everyone" ON image_catalog;
CREATE POLICY "Public images are viewable by everyone" ON image_catalog
    FOR SELECT USING (is_public = true);

DROP POLICY IF EXISTS "Users can insert images" ON image_catalog;
CREATE POLICY "Users can insert images" ON image_catalog
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their own images" ON image_catalog;
CREATE POLICY "Users can update their own images" ON image_catalog
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Users can delete their own images" ON image_catalog;
CREATE POLICY "Users can delete their own images" ON image_catalog
    FOR DELETE USING (true);

-- 9. Grant necessary permissions
GRANT ALL ON image_catalog TO authenticated;
GRANT SELECT ON image_catalog TO anon;

-- 10. Create or replace view for image catalog with joined details
DROP VIEW IF EXISTS image_catalog_with_details;
CREATE VIEW image_catalog_with_details AS
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
LEFT JOIN coats cc ON ic.coat_id = cc.id;

-- Grant permissions on the view
GRANT SELECT ON image_catalog_with_details TO authenticated;
GRANT SELECT ON image_catalog_with_details TO anon;

-- Success message
SELECT 'Schema updates installed successfully! Image catalog and style enhancements are ready.' as status;