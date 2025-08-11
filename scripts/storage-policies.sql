-- Storage policies for pet-photos bucket
-- Run these in your Supabase SQL Editor

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow authenticated users to upload pet photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to pet photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own pet photos" ON storage.objects;

-- Policy 1: Allow authenticated users to upload pet photos
CREATE POLICY "Allow authenticated users to upload pet photos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'pet-photos');

-- Policy 2: Allow public read access to pet photos
CREATE POLICY "Allow public read access to pet photos" ON storage.objects
FOR SELECT TO public, authenticated
USING (bucket_id = 'pet-photos');

-- Policy 3: Allow users to delete their own pet photos (optional)
-- This policy allows users to delete photos in folders that match their user ID
CREATE POLICY "Allow users to delete their own pet photos" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'pet-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy 4: Allow users to update/replace their own pet photos
CREATE POLICY "Allow users to update their own pet photos" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'pet-photos' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'pet-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Verify policies were created
SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';