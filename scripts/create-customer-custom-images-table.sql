-- ============================================================================
-- Customer Custom Images Table
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

  -- Customer's pet information
  pet_id UUID REFERENCES public.customer_pets(id) ON DELETE SET NULL,
  pet_name TEXT,
  pet_breed_id UUID REFERENCES public.breeds(id),
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
-- Indexes for Performance
-- ============================================================================

CREATE INDEX idx_customer_custom_images_customer_id
  ON customer_custom_images(customer_id);

CREATE INDEX idx_customer_custom_images_customer_email
  ON customer_custom_images(customer_email);

CREATE INDEX idx_customer_custom_images_catalog_image
  ON customer_custom_images(catalog_image_id);

CREATE INDEX idx_customer_custom_images_share_token
  ON customer_custom_images(share_token)
  WHERE share_token IS NOT NULL;

CREATE INDEX idx_customer_custom_images_status
  ON customer_custom_images(status);

CREATE INDEX idx_customer_custom_images_created
  ON customer_custom_images(created_at DESC);

CREATE INDEX idx_customer_custom_images_public
  ON customer_custom_images(is_public)
  WHERE is_public = true;

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
CREATE OR REPLACE FUNCTION generate_share_token()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate random 12-character alphanumeric token
  NEW.share_token := lower(substring(md5(random()::text || NEW.id::text) from 1 for 12));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to generate share token on insert
DROP TRIGGER IF EXISTS trigger_generate_share_token ON customer_custom_images;
CREATE TRIGGER trigger_generate_share_token
  BEFORE INSERT ON customer_custom_images
  FOR EACH ROW
  EXECUTE FUNCTION generate_share_token();

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
  'Customer-generated custom images where customers substitute their own pets into catalog image compositions. No AI analysis - just pet substitution into existing theme/style.';

COMMENT ON COLUMN public.customer_custom_images.catalog_image_id IS
  'Reference to the catalog image being customized. This defines the theme, style, and composition used for generation.';

COMMENT ON COLUMN public.customer_custom_images.pet_id IS
  'Reference to customer_pets table if using existing pet. NULL if customer uploaded a new pet photo.';

COMMENT ON COLUMN public.customer_custom_images.pet_image_url IS
  'URL of the pet photo used for generation. May be from customer_pets table or newly uploaded.';

COMMENT ON COLUMN public.customer_custom_images.share_token IS
  'Unique token for shareable URL: /share/custom/[shareToken]. Auto-generated on insert.';

COMMENT ON COLUMN public.customer_custom_images.status IS
  'Generation status: pending (initial), generating (in progress), complete (success), failed (error)';

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Verify table created successfully
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

-- Count indexes
SELECT COUNT(*) as index_count
FROM pg_indexes
WHERE tablename = 'customer_custom_images';

-- List RLS policies
SELECT policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'customer_custom_images';

-- ============================================================================
-- Sample Queries for Testing
-- ============================================================================

-- Insert test record (commented out - uncomment to test)
/*
INSERT INTO customer_custom_images (
  customer_email,
  catalog_image_id,
  pet_name,
  pet_image_url,
  pet_cloudinary_id,
  status
) VALUES (
  'test@example.com',
  (SELECT id FROM image_catalog LIMIT 1),
  'Test Pet',
  'https://res.cloudinary.com/test/test.jpg',
  'test_cloudinary_id',
  'pending'
);
*/

-- View recent custom images
/*
SELECT
  id,
  customer_email,
  pet_name,
  status,
  share_token,
  created_at
FROM customer_custom_images
ORDER BY created_at DESC
LIMIT 10;
*/

-- ============================================================================
-- End of Schema
-- ============================================================================
