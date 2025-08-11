    -- Create pet_photos table for storing individual pet photo records
    -- Run this in your Supabase SQL Editor

    CREATE TABLE IF NOT EXISTS pet_photos (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
        photo_url TEXT NOT NULL,
        is_primary BOOLEAN DEFAULT false,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Create index for faster queries by pet_id
    CREATE INDEX IF NOT EXISTS idx_pet_photos_pet_id ON pet_photos(pet_id);

    -- Create index for finding primary photos quickly
    CREATE INDEX IF NOT EXISTS idx_pet_photos_primary ON pet_photos(pet_id, is_primary) WHERE is_primary = true;

    -- Add RLS policy if needed (optional)
    ALTER TABLE pet_photos ENABLE ROW LEVEL SECURITY;

    -- Policy to allow authenticated users to view photos for their own pets
    CREATE POLICY "Users can view photos of their own pets" ON pet_photos
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM pets 
            WHERE pets.id = pet_photos.pet_id 
            AND pets.user_id = auth.uid()
        )
    );

    -- Policy to allow authenticated users to insert photos for their own pets
    CREATE POLICY "Users can upload photos for their own pets" ON pet_photos
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM pets 
            WHERE pets.id = pet_photos.pet_id 
            AND pets.user_id = auth.uid()
        )
    );

    -- Policy to allow authenticated users to update photos for their own pets
    CREATE POLICY "Users can update photos of their own pets" ON pet_photos
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM pets 
            WHERE pets.id = pet_photos.pet_id 
            AND pets.user_id = auth.uid()
        )
    );

    -- Policy to allow authenticated users to delete photos for their own pets
    CREATE POLICY "Users can delete photos of their own pets" ON pet_photos
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM pets 
            WHERE pets.id = pet_photos.pet_id 
            AND pets.user_id = auth.uid()
        )
    );

    -- Verify table was created
    SELECT 'pet_photos table created successfully' as status;