-- Cloudinary Migration Schema Updates (CORRECTED)
-- Run this in Supabase SQL Editor

-- 1. Add Cloudinary-specific fields to image_catalog table
ALTER TABLE image_catalog ADD COLUMN IF NOT EXISTS cloudinary_public_id TEXT;
ALTER TABLE image_catalog ADD COLUMN IF NOT EXISTS cloudinary_version VARCHAR(20);
ALTER TABLE image_catalog ADD COLUMN IF NOT EXISTS cloudinary_signature TEXT;

-- Add image variant tracking
ALTER TABLE image_catalog ADD COLUMN IF NOT EXISTS image_variants JSONB DEFAULT '{}';

-- Add access control
ALTER TABLE image_catalog ADD COLUMN IF NOT EXISTS access_level TEXT DEFAULT 'public'; 

-- Add migration status tracking
ALTER TABLE image_catalog ADD COLUMN IF NOT EXISTS migration_status TEXT DEFAULT 'pending';
ALTER TABLE image_catalog ADD COLUMN IF NOT EXISTS migrated_at TIMESTAMP WITH TIME ZONE;

-- 2. Create QR tracking table
CREATE TABLE IF NOT EXISTS qr_code_tracking (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  image_id UUID REFERENCES image_catalog(id) ON DELETE CASCADE,
  partner_id UUID,
  qr_code_data JSONB NOT NULL,
  scan_count INTEGER DEFAULT 0,
  last_scanned_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Create indexes for QR tracking
CREATE INDEX IF NOT EXISTS idx_qr_tracking_image ON qr_code_tracking(image_id);
CREATE INDEX IF NOT EXISTS idx_qr_tracking_partner ON qr_code_tracking(partner_id);
CREATE INDEX IF NOT EXISTS idx_qr_tracking_scans ON qr_code_tracking(scan_count DESC);

-- 3. Update the image_catalog_with_details view to include new fields (CORRECTED)
DROP VIEW IF EXISTS image_catalog_with_details;
CREATE VIEW image_catalog_with_details AS
SELECT 
  ic.*,
  b.name as breed_name,
  t.name as theme_name, 
  s.name as style_name,
  f.name as format_name,
  c.name as coat_name,
  c.hex_color as coat_hex_color
FROM image_catalog ic
LEFT JOIN breeds b ON ic.breed_id = b.id
LEFT JOIN themes t ON ic.theme_id = t.id  
LEFT JOIN styles s ON ic.style_id = s.id
LEFT JOIN formats f ON ic.format_id = f.id
LEFT JOIN coats c ON ic.coat_id = c.id;  -- FIXED: coats not coat_colors

-- 4. Create function to increment QR scan count
CREATE OR REPLACE FUNCTION increment_qr_scan(
  p_image_id UUID,
  p_partner_id UUID DEFAULT NULL
) 
RETURNS VOID AS $$
BEGIN
  -- Insert or update QR tracking record
  INSERT INTO qr_code_tracking (image_id, partner_id, qr_code_data, scan_count, last_scanned_at)
  VALUES (
    p_image_id,
    p_partner_id,
    jsonb_build_object(
      'landing_url', CONCAT('/shop/', p_image_id::text),
      'partner_id', COALESCE(p_partner_id::text, ''),
      'discount_code', 'PARTNER10'
    ),
    1,
    NOW()
  )
  ON CONFLICT (image_id, COALESCE(partner_id, '00000000-0000-0000-0000-000000000000'::UUID))
  DO UPDATE SET 
    scan_count = qr_code_tracking.scan_count + 1,
    last_scanned_at = NOW(),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- 5. Create function to get image variants by access level
CREATE OR REPLACE FUNCTION get_image_variant(
  p_image_id UUID,
  p_variant_type TEXT DEFAULT 'catalog_watermarked',
  p_user_id UUID DEFAULT NULL,
  p_order_id UUID DEFAULT NULL
)
RETURNS TABLE(
  url TEXT,
  access_granted BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  image_record RECORD;
  variant_data JSONB;
BEGIN
  -- Get image record
  SELECT * INTO image_record
  FROM image_catalog 
  WHERE id = p_image_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::TEXT, FALSE, 'Image not found';
    RETURN;
  END IF;

  -- Check if image has been migrated to Cloudinary
  IF image_record.cloudinary_public_id IS NULL THEN
    RETURN QUERY SELECT image_record.image_url, TRUE, 'Legacy image - not migrated yet';
    RETURN;
  END IF;

  -- Get variant data from JSONB
  variant_data := image_record.image_variants -> p_variant_type;

  IF variant_data IS NULL THEN
    RETURN QUERY SELECT NULL::TEXT, FALSE, 'Variant not available';
    RETURN;
  END IF;

  -- Handle different variant types
  CASE p_variant_type
    WHEN 'print_quality' THEN
      IF p_user_id IS NULL THEN
        RETURN QUERY SELECT NULL::TEXT, FALSE, 'Authentication required for print quality';
        RETURN;
      END IF;
      RETURN QUERY SELECT (variant_data ->> 'secure_url')::TEXT, TRUE, NULL::TEXT;
      
    WHEN 'social' THEN
      IF p_user_id IS NULL OR p_order_id IS NULL THEN
        RETURN QUERY SELECT NULL::TEXT, FALSE, 'Purchase verification required for social media pack';
        RETURN;
      END IF;
      RETURN QUERY SELECT (variant_data -> 'social_optimized' ->> 'instagram_post')::TEXT, TRUE, NULL::TEXT;
      
    ELSE
      -- Public variants (catalog_watermarked, qr_overlay)
      RETURN QUERY SELECT (variant_data ->> 'url')::TEXT, TRUE, NULL::TEXT;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- 6. Add RLS policies for QR tracking
ALTER TABLE qr_code_tracking ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated users
CREATE POLICY "qr_tracking_read" ON qr_code_tracking
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow insert/update for service role (for API calls)
CREATE POLICY "qr_tracking_write" ON qr_code_tracking
  FOR ALL
  TO service_role
  USING (true);

-- 7. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_image_catalog_cloudinary ON image_catalog(cloudinary_public_id) WHERE cloudinary_public_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_image_catalog_migration_status ON image_catalog(migration_status);
CREATE INDEX IF NOT EXISTS idx_image_catalog_access_level ON image_catalog(access_level);

-- Add comments for documentation
COMMENT ON COLUMN image_catalog.cloudinary_public_id IS 'Cloudinary public ID for the uploaded image';
COMMENT ON COLUMN image_catalog.cloudinary_version IS 'Cloudinary version number for cache busting';
COMMENT ON COLUMN image_catalog.image_variants IS 'JSON object containing URLs for different image variants (print, social, watermarked, etc.)';
COMMENT ON COLUMN image_catalog.access_level IS 'Access control level: public, watermarked, premium, print_quality';
COMMENT ON COLUMN image_catalog.migration_status IS 'Status of migration to Cloudinary: pending, migrating, completed, failed';

COMMENT ON TABLE qr_code_tracking IS 'Tracks QR code scans for partner referrals and analytics';
COMMENT ON FUNCTION increment_qr_scan(UUID, UUID) IS 'Increments QR code scan count and updates tracking data';
COMMENT ON FUNCTION get_image_variant(UUID, TEXT, UUID, UUID) IS 'Returns appropriate image variant URL based on access level and permissions';