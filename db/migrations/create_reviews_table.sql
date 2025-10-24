-- =====================================================
-- REVIEWS TABLE MIGRATION
-- =====================================================
-- Purpose: Create a comprehensive review system for order items
-- Allows customers to leave reviews after delivery with star ratings and comments
-- Includes moderation workflow and admin response capability
-- =====================================================

-- Create the reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
  -- Primary key
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys to orders and customers
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,

  -- Review content
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text NOT NULL CHECK (length(trim(comment)) >= 10 AND length(comment) <= 1000),

  -- Auto-populated customer information (denormalized for display)
  customer_first_name text NOT NULL,
  customer_city text NOT NULL,
  customer_country text NOT NULL,

  -- Image information (denormalized from order_item for easy display)
  image_id text NOT NULL,
  image_url text NOT NULL,
  image_thumbnail_url text,
  breed_name text,

  -- Moderation workflow
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'hidden')),
  is_auto_approved boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT false,

  -- Early adopter badge for pre-launch reviews
  is_early_adopter boolean NOT NULL DEFAULT false,

  -- Admin response capability
  admin_response text CHECK (admin_response IS NULL OR length(trim(admin_response)) <= 500),
  admin_responder_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  admin_responded_at timestamp with time zone,

  -- Timestamps
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  published_at timestamp with time zone,

  -- Prevent duplicate reviews per order item per customer
  CONSTRAINT reviews_unique_order_item_customer UNIQUE(order_item_id, customer_id)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Index for finding reviews by customer (customer dashboard)
CREATE INDEX idx_reviews_customer_id ON public.reviews(customer_id);

-- Index for finding reviews by order (order details page)
CREATE INDEX idx_reviews_order_id ON public.reviews(order_id);

-- Index for admin moderation queue (filter by status)
CREATE INDEX idx_reviews_status ON public.reviews(status) WHERE status != 'hidden';

-- Index for public homepage carousel (published reviews, newest first)
CREATE INDEX idx_reviews_published ON public.reviews(is_published, created_at DESC) WHERE is_published = true;

-- Index for filtering by rating (analytics and filtering)
CREATE INDEX idx_reviews_rating ON public.reviews(rating);

-- Index for finding reviews by breed (analytics)
CREATE INDEX idx_reviews_breed ON public.reviews(breed_name) WHERE breed_name IS NOT NULL;

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on the reviews table
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Policy 1: Public read access for published reviews
-- Anyone can view published reviews (for homepage carousel)
CREATE POLICY "Public read access for published reviews"
  ON public.reviews
  FOR SELECT
  TO public
  USING (is_published = true);

-- Policy 2: Customers can read their own reviews (all statuses)
-- Customers can see their own reviews even if not published
CREATE POLICY "Customers can read own reviews"
  ON public.reviews
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.user_id = auth.uid()
        AND up.customer_id = reviews.customer_id
    )
  );

-- Policy 3: Customers can create reviews for their delivered orders
-- Only for orders they own and that have been delivered
CREATE POLICY "Customers can create reviews for delivered orders"
  ON public.reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.orders o
      INNER JOIN public.user_profiles up ON up.user_id = auth.uid()
      INNER JOIN public.customers c ON c.id = up.customer_id
      WHERE o.id = reviews.order_id
        AND o.customer_email = c.email
        AND o.status = 'delivered'
        AND reviews.customer_id = c.id
    )
  );

-- Policy 4: Customers can update their own pending reviews (before approval)
-- Allows editing before admin review
CREATE POLICY "Customers can update own pending reviews"
  ON public.reviews
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.user_id = auth.uid()
        AND up.customer_id = reviews.customer_id
    )
    AND status = 'pending'
  );

-- Policy 5: Admins have full access to all reviews
-- Admin users can read, create, update, delete any review
CREATE POLICY "Admins have full access to reviews"
  ON public.reviews
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.user_id = auth.uid()
        AND up.user_type = 'admin'
    )
  );

-- =====================================================
-- TRIGGER: Auto-update updated_at timestamp
-- =====================================================

CREATE OR REPLACE FUNCTION update_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_reviews_updated_at();

-- =====================================================
-- TRIGGER: Set published_at when status changes to approved
-- =====================================================

CREATE OR REPLACE FUNCTION set_review_published_at()
RETURNS TRIGGER AS $$
BEGIN
  -- If status changed to approved and is_published is true, set published_at
  IF NEW.status = 'approved' AND NEW.is_published = true AND OLD.published_at IS NULL THEN
    NEW.published_at = now();
  END IF;

  -- If unpublished, clear published_at
  IF NEW.is_published = false THEN
    NEW.published_at = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_review_published_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION set_review_published_at();

-- =====================================================
-- HELPER FUNCTION: Get reviewable order items for customer
-- =====================================================
-- Returns order items from delivered orders that don't have reviews yet

CREATE OR REPLACE FUNCTION get_reviewable_order_items(customer_email_param text)
RETURNS TABLE (
  order_item_id uuid,
  order_id uuid,
  order_number text,
  product_name text,
  image_id text,
  image_url text,
  image_thumbnail_url text,
  breed_name text,
  delivered_at timestamp with time zone,
  has_review boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    oi.id as order_item_id,
    o.id as order_id,
    o.order_number,
    COALESCE(
      (oi.product_data->>'name')::text,
      p.name,
      'Product'
    ) as product_name,
    oi.image_id,
    COALESCE(oi.image_url, oi.print_image_url, '') as image_url,
    COALESCE(
      (ic.image_variants->>'thumbnail')::text,
      ic.public_url
    ) as image_thumbnail_url,
    b.name as breed_name,
    o.updated_at as delivered_at,
    EXISTS (
      SELECT 1
      FROM public.reviews r
      WHERE r.order_item_id = oi.id
        AND r.customer_id = c.id
    ) as has_review
  FROM public.orders o
  INNER JOIN public.order_items oi ON oi.order_id = o.id
  INNER JOIN public.customers c ON c.email = o.customer_email
  LEFT JOIN public.products p ON p.sku = oi.product_id
  LEFT JOIN public.image_catalog ic ON ic.id::text = oi.image_id
  LEFT JOIN public.breeds b ON b.id = ic.breed_id
  WHERE o.customer_email = customer_email_param
    AND o.status = 'delivered'
  ORDER BY o.updated_at DESC, oi.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- HELPER FUNCTION: Get review statistics
-- =====================================================
-- Returns aggregate statistics for admin dashboard

CREATE OR REPLACE FUNCTION get_review_statistics()
RETURNS TABLE (
  total_reviews bigint,
  pending_reviews bigint,
  approved_reviews bigint,
  rejected_reviews bigint,
  published_reviews bigint,
  average_rating numeric,
  five_star_count bigint,
  four_star_count bigint,
  three_star_count bigint,
  two_star_count bigint,
  one_star_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint as total_reviews,
    COUNT(*) FILTER (WHERE status = 'pending')::bigint as pending_reviews,
    COUNT(*) FILTER (WHERE status = 'approved')::bigint as approved_reviews,
    COUNT(*) FILTER (WHERE status = 'rejected')::bigint as rejected_reviews,
    COUNT(*) FILTER (WHERE is_published = true)::bigint as published_reviews,
    ROUND(AVG(rating), 2) as average_rating,
    COUNT(*) FILTER (WHERE rating = 5)::bigint as five_star_count,
    COUNT(*) FILTER (WHERE rating = 4)::bigint as four_star_count,
    COUNT(*) FILTER (WHERE rating = 3)::bigint as three_star_count,
    COUNT(*) FILTER (WHERE rating = 2)::bigint as two_star_count,
    COUNT(*) FILTER (WHERE rating = 1)::bigint as one_star_count
  FROM public.reviews
  WHERE status != 'hidden';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE public.reviews IS 'Customer reviews for order items with moderation workflow';
COMMENT ON COLUMN public.reviews.status IS 'Review moderation status: pending (awaiting approval), approved (approved by admin), rejected (rejected by admin), hidden (soft deleted)';
COMMENT ON COLUMN public.reviews.is_auto_approved IS 'True if review was auto-approved (4-5 stars), false if manually approved';
COMMENT ON COLUMN public.reviews.is_published IS 'True if review is visible on public homepage, false otherwise';
COMMENT ON COLUMN public.reviews.is_early_adopter IS 'True for pre-generated launch reviews, false for real customer reviews';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Display success message
DO $$
BEGIN
  RAISE NOTICE '✅ Reviews table migration completed successfully!';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Created:';
  RAISE NOTICE '   - reviews table with full schema';
  RAISE NOTICE '   - 7 performance indexes';
  RAISE NOTICE '   - 5 RLS policies for security';
  RAISE NOTICE '   - 2 triggers for timestamps';
  RAISE NOTICE '   - 2 helper functions';
  RAISE NOTICE '';
  RAISE NOTICE '🔐 Security:';
  RAISE NOTICE '   - Row Level Security enabled';
  RAISE NOTICE '   - Public can read published reviews';
  RAISE NOTICE '   - Customers can review delivered orders';
  RAISE NOTICE '   - Admins have full access';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Next steps:';
  RAISE NOTICE '   1. Update schema file: tsx scripts/update-schema-file.ts';
  RAISE NOTICE '   2. Generate launch reviews: tsx scripts/generate-launch-reviews.ts';
  RAISE NOTICE '   3. Deploy API endpoints and UI components';
  RAISE NOTICE '';
END $$;
