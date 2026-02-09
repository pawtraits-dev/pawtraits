-- ============================================================================
-- Customer Custom Images Table (Updated to use existing pets table)
-- ============================================================================
-- Purpose: Store customer-generated custom images where they substitute their
-- own pet into catalog image compositions with existing theme/style
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.customer_custom_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Customer information
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  customer_email TEXT NOT NULL,

  -- Source catalog image (defines theme/style/composition)
  catalog_image_id UUID REFERENCES public.image_catalog(id) ON DELETE SET NULL,

  -- Customer's pet information (from existing pets table)
  pet_id UUID REFERENCES public.pets(id) ON DELETE SET NULL,
  pet_name TEXT,
  pet_breed_id UUID REFERENCES public.breeds(id),
  pet_coat_id UUID REFERENCES public.coats(id),
  pet_image_url TEXT NOT NULL, -- Pet photo used for generation
  pet_cloudinary_id TEXT NOT NULL,

  -- Generated custom image
  generated_image_url TEXT,
  generated_cloudinary_id TEXT,
  generation_prompt TEXT,
  generation_metadata JSONB,

  -- Sharing
  is_public BOOLEAN DEFAULT false,
  share_token TEXT UNIQUE, -- For shareable URLs /share/custom/[shareToken]
  share_count INTEGER DEFAULT 0,
  last_shared_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  generated_at TIMESTAMP WITH TIME ZONE,

  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'complete', 'failed')),
  error_message TEXT,

  -- Additional metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- Add AI Analysis Fields to Existing pet_photos Table
-- ============================================================================
-- This allows us to analyze pet photos once and reuse the analysis
-- for all customizations

ALTER TABLE public.pet_photos ADD COLUMN IF NOT EXISTS ai_analysis JSONB DEFAULT NULL;
ALTER TABLE public.pet_photos ADD COLUMN IF NOT EXISTS ai_analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE public.pet_photos ADD COLUMN IF NOT EXISTS detected_breed_id UUID REFERENCES public.breeds(id);
ALTER TABLE public.pet_photos ADD COLUMN IF NOT EXISTS detected_coat_id UUID REFERENCES public.coats(id);
ALTER TABLE public.pet_photos ADD COLUMN IF NOT EXISTS ai_confidence_score DECIMAL(5,2);

COMMENT ON COLUMN public.pet_photos.ai_analysis IS 'Claude AI analysis of pet photo including composition, pose, gaze, expression, lighting';
COMMENT ON COLUMN public.pet_photos.detected_breed_id IS 'AI-detected breed (may differ from user-entered breed in pets table)';
COMMENT ON COLUMN public.pet_photos.detected_coat_id IS 'AI-detected coat color/pattern';
COMMENT ON COLUMN public.pet_photos.ai_confidence_score IS 'Overall confidence score of AI analysis (0-100)';

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_customer_custom_images_customer_id
  ON customer_custom_images(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_custom_images_customer_email
  ON customer_custom_images(customer_email);

CREATE INDEX IF NOT EXISTS idx_customer_custom_images_catalog_image
  ON customer_custom_images(catalog_image_id);

CREATE INDEX IF NOT EXISTS idx_customer_custom_images_pet_id
  ON customer_custom_images(pet_id);

CREATE INDEX IF NOT EXISTS idx_customer_custom_images_share_token
  ON customer_custom_images(share_token)
  WHERE share_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_custom_images_status
  ON customer_custom_images(status);

CREATE INDEX IF NOT EXISTS idx_customer_custom_images_created
  ON customer_custom_images(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_custom_images_public
  ON customer_custom_images(is_public)
  WHERE is_public = true;

-- Index for pet_photos AI analysis
CREATE INDEX IF NOT EXISTS idx_pet_photos_ai_analyzed
  ON pet_photos(ai_analyzed_at)
  WHERE ai_analyzed_at IS NOT NULL;

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

ALTER TABLE public.customer_custom_images ENABLE ROW LEVEL SECURITY;

-- Customers can view their own custom images
CREATE POLICY "Customers can view own custom images"
  ON public.customer_custom_images FOR SELECT
  TO authenticated
  USING (
    customer_email = auth.jwt() ->> 'email'
    OR is_public = true
  );

-- Customers can insert their own custom images
CREATE POLICY "Customers can create custom images"
  ON public.customer_custom_images FOR INSERT
  TO authenticated
  WITH CHECK (customer_email = auth.jwt() ->> 'email');

-- Customers can update their own custom images
CREATE POLICY "Customers can update own custom images"
  ON public.customer_custom_images FOR UPDATE
  TO authenticated
  USING (customer_email = auth.jwt() ->> 'email');

-- Customers can delete their own custom images
CREATE POLICY "Customers can delete own custom images"
  ON public.customer_custom_images FOR DELETE
  TO authenticated
  USING (customer_email = auth.jwt() ->> 'email');

-- Public (anonymous) can view shared custom images via share token
CREATE POLICY "Public can view shared custom images"
  ON public.customer_custom_images FOR SELECT
  TO public
  USING (is_public = true);

-- Admin can view all custom images
CREATE POLICY "Admin can view all custom images"
  ON public.customer_custom_images FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.user_type = 'admin'
    )
  );

-- ============================================================================
-- Functions & Triggers
-- ============================================================================

-- Function to auto-generate share token on insert
CREATE OR REPLACE FUNCTION generate_custom_image_share_token()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate random 12-character alphanumeric token
  NEW.share_token := lower(substring(md5(random()::text || NEW.id::text) from 1 for 12));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to generate share token on insert
DROP TRIGGER IF EXISTS trigger_generate_custom_image_share_token ON customer_custom_images;
CREATE TRIGGER trigger_generate_custom_image_share_token
  BEFORE INSERT ON customer_custom_images
  FOR EACH ROW
  EXECUTE FUNCTION generate_custom_image_share_token();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_customer_custom_images_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_customer_custom_images_updated_at ON customer_custom_images;
CREATE TRIGGER trigger_update_customer_custom_images_updated_at
  BEFORE UPDATE ON customer_custom_images
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_custom_images_updated_at();

-- ============================================================================
-- Comments & Documentation
-- ============================================================================

COMMENT ON TABLE public.customer_custom_images IS
  'Customer-generated custom images where customers substitute their own pets into catalog image compositions. Pet photos are analyzed with AI to capture characteristics for better generation quality.';

COMMENT ON COLUMN public.customer_custom_images.catalog_image_id IS
  'Reference to the catalog image being customized. This defines the theme, style, and composition used for generation.';

COMMENT ON COLUMN public.customer_custom_images.pet_id IS
  'Reference to pets table. Links to customer''s registered pet with AI-analyzed photo.';

COMMENT ON COLUMN public.customer_custom_images.pet_image_url IS
  'URL of the pet photo used for generation. From pets.primary_photo_url or pet_photos table.';

COMMENT ON COLUMN public.customer_custom_images.share_token IS
  'Unique token for shareable URL: /share/custom/[shareToken]. Auto-generated on insert.';

COMMENT ON COLUMN public.customer_custom_images.status IS
  'Generation status: pending (initial), generating (in progress), complete (success), failed (error)';

-- ============================================================================
-- Verification Queries
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'customer_custom_images'
  ) THEN
    RAISE NOTICE '✅ customer_custom_images table created successfully';
  ELSE
    RAISE EXCEPTION '❌ Failed to create customer_custom_images table';
  END IF;
END $$;

-- Check AI analysis columns added
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'pet_photos'
    AND column_name = 'ai_analysis'
  ) THEN
    RAISE NOTICE '✅ AI analysis fields added to pet_photos table';
  ELSE
    RAISE NOTICE 'ℹ️  AI analysis fields may already exist or failed to add';
  END IF;
END $$;

-- ============================================================================
-- Sample Queries for Reference
-- ============================================================================

-- View pets with their photos and AI analysis
/*
SELECT
  p.id,
  p.name,
  p.breed_id,
  p.coat_id,
  pp.photo_url,
  pp.ai_analysis,
  pp.detected_breed_id,
  pp.ai_confidence_score
FROM pets p
LEFT JOIN pet_photos pp ON pp.pet_id = p.id
WHERE p.customer_id = 'customer-uuid-here'
ORDER BY pp.is_primary DESC;
*/

-- View recent custom images
/*
SELECT
  cci.id,
  cci.customer_email,
  p.name as pet_name,
  ic.description as catalog_image_theme,
  cci.status,
  cci.share_token,
  cci.created_at
FROM customer_custom_images cci
LEFT JOIN pets p ON p.id = cci.pet_id
LEFT JOIN image_catalog ic ON ic.id = cci.catalog_image_id
ORDER BY cci.created_at DESC
LIMIT 10;
*/

-- ============================================================================
-- End of Schema
-- ============================================================================

SELECT '✅ Customer custom images table and pet AI analysis fields created successfully!' as status;
