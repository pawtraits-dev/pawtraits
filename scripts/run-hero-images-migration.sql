    -- Migration: Add hero image support to breeds, themes, and coats tables
    -- Run this script in your Supabase SQL editor or database client

    -- Add hero image support to breeds table
    ALTER TABLE public.breeds 
    ADD COLUMN IF NOT EXISTS hero_image_url TEXT,
    ADD COLUMN IF NOT EXISTS hero_image_alt TEXT;

    -- Add hero image support to themes table  
    ALTER TABLE public.themes 
    ADD COLUMN IF NOT EXISTS hero_image_url TEXT,
    ADD COLUMN IF NOT EXISTS hero_image_alt TEXT;

    -- Add hero image support to coats table
    ALTER TABLE public.coats 
    ADD COLUMN IF NOT EXISTS hero_image_url TEXT,
    ADD COLUMN IF NOT EXISTS hero_image_alt TEXT;

    -- Add comments for documentation
    COMMENT ON COLUMN public.breeds.hero_image_url IS 'URL to the hero image displayed in breed description cards';
    COMMENT ON COLUMN public.breeds.hero_image_alt IS 'Alt text for the breed hero image for accessibility';

    COMMENT ON COLUMN public.themes.hero_image_url IS 'URL to the hero image displayed in theme description cards';
    COMMENT ON COLUMN public.themes.hero_image_alt IS 'Alt text for the theme hero image for accessibility';

    COMMENT ON COLUMN public.coats.hero_image_url IS 'URL to the hero image displayed in coat description cards';
    COMMENT ON COLUMN public.coats.hero_image_alt IS 'Alt text for the coat hero image for accessibility';

    -- Verify the changes
    SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name IN ('breeds', 'themes', 'coats')
    AND column_name LIKE '%hero_image%'
    ORDER BY table_name, column_name;