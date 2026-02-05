-- Migration: Create image_catalog_subjects junction table for multi-breed filtering
-- This allows images with multiple subjects to appear when filtering by any breed

CREATE TABLE IF NOT EXISTS public.image_catalog_subjects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  image_catalog_id uuid NOT NULL,
  subject_order integer NOT NULL,
  is_primary boolean DEFAULT false,
  breed_id uuid NOT NULL,
  coat_id uuid,
  outfit_id uuid,
  position text,
  size_prominence text,
  pose_description text,
  gaze_direction text,
  expression text,
  created_at timestamp with time zone DEFAULT now(),

  CONSTRAINT image_catalog_subjects_pkey PRIMARY KEY (id),
  CONSTRAINT image_catalog_subjects_image_catalog_id_fkey FOREIGN KEY (image_catalog_id) REFERENCES public.image_catalog(id) ON DELETE CASCADE,
  CONSTRAINT image_catalog_subjects_breed_id_fkey FOREIGN KEY (breed_id) REFERENCES public.breeds(id),
  CONSTRAINT image_catalog_subjects_coat_id_fkey FOREIGN KEY (coat_id) REFERENCES public.coats(id),
  CONSTRAINT image_catalog_subjects_outfit_id_fkey FOREIGN KEY (outfit_id) REFERENCES public.outfits(id)
);

-- Create index for efficient breed-based filtering
CREATE INDEX IF NOT EXISTS image_catalog_subjects_breed_id_idx ON public.image_catalog_subjects(breed_id);
CREATE INDEX IF NOT EXISTS image_catalog_subjects_image_catalog_id_idx ON public.image_catalog_subjects(image_catalog_id);
CREATE INDEX IF NOT EXISTS image_catalog_subjects_is_primary_idx ON public.image_catalog_subjects(is_primary);

-- Add RLS policies
ALTER TABLE public.image_catalog_subjects ENABLE ROW LEVEL SECURITY;

-- Public read access (for browsing catalog)
CREATE POLICY "Public read access" ON public.image_catalog_subjects
  FOR SELECT
  USING (true);

-- Only admins can insert/update/delete
CREATE POLICY "Admin full access" ON public.image_catalog_subjects
  FOR ALL
  USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.user_profiles WHERE user_type = 'admin'
    )
  );

COMMENT ON TABLE public.image_catalog_subjects IS 'Junction table linking catalog images to their subjects (breeds). Enables multi-breed filtering where an image with multiple subjects appears when filtering by any of those breeds.';
