-- Migration: Customer Image Customization System
-- Description: Adds tables and fields to support customer-generated image variations
-- Date: 2025-10-14

-- =============================================
-- 1. Create customer_generated_images table
-- =============================================

CREATE TABLE IF NOT EXISTS public.customer_generated_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  original_image_id UUID REFERENCES public.image_catalog(id) ON DELETE SET NULL,

  -- Image storage
  cloudinary_public_id TEXT,
  public_url TEXT,
  image_variants JSONB DEFAULT '{}'::jsonb, -- watermarked, full_size, etc.

  -- Generation metadata
  prompt_text TEXT NOT NULL,
  breed_id UUID REFERENCES public.breeds(id),
  coat_id UUID REFERENCES public.coats(id),
  outfit_id UUID REFERENCES public.outfits(id),
  format_id UUID REFERENCES public.formats(id),
  theme_id UUID REFERENCES public.themes(id),
  style_id UUID REFERENCES public.styles(id),

  -- Multi-animal support
  is_multi_animal BOOLEAN DEFAULT false,
  multi_animal_config JSONB DEFAULT NULL, -- {primary: {...}, secondary: {...}}

  -- Generation details
  generation_metadata JSONB DEFAULT '{}'::jsonb, -- cost, duration, api_version, etc.
  generation_cost_credits INTEGER DEFAULT 1,
  gemini_prompt TEXT, -- The actual prompt sent to Gemini

  -- Purchase status
  is_purchased BOOLEAN DEFAULT false,
  purchased_at TIMESTAMPTZ,
  purchase_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,

  -- Catalog visibility (if customer wants to share)
  is_public BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_generated_images_customer_id
  ON public.customer_generated_images(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_generated_images_original_image_id
  ON public.customer_generated_images(original_image_id);
CREATE INDEX IF NOT EXISTS idx_customer_generated_images_is_purchased
  ON public.customer_generated_images(is_purchased);
CREATE INDEX IF NOT EXISTS idx_customer_generated_images_created_at
  ON public.customer_generated_images(created_at DESC);

-- RLS Policies
ALTER TABLE public.customer_generated_images ENABLE ROW LEVEL SECURITY;

-- Customers can view their own generated images
CREATE POLICY "Customers can view own generated images"
  ON public.customer_generated_images
  FOR SELECT
  USING (
    customer_id IN (
      SELECT id FROM public.user_profiles
      WHERE auth.uid() = user_id
    )
  );

-- Customers can insert their own generated images
CREATE POLICY "Customers can create generated images"
  ON public.customer_generated_images
  FOR INSERT
  WITH CHECK (
    customer_id IN (
      SELECT id FROM public.user_profiles
      WHERE auth.uid() = user_id
    )
  );

-- Customers can update their own unpurchased images
CREATE POLICY "Customers can update own unpurchased images"
  ON public.customer_generated_images
  FOR UPDATE
  USING (
    customer_id IN (
      SELECT id FROM public.user_profiles
      WHERE auth.uid() = user_id
    )
    AND is_purchased = false
  );

-- Admins can view all generated images
CREATE POLICY "Admins can view all generated images"
  ON public.customer_generated_images
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE auth.uid() = user_id
      AND user_type = 'admin'
    )
  );

-- Public can view public/featured images
CREATE POLICY "Public can view public generated images"
  ON public.customer_generated_images
  FOR SELECT
  USING (is_public = true);

-- =============================================
-- 2. Create customer_customization_credits table
-- =============================================

CREATE TABLE IF NOT EXISTS public.customer_customization_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,

  -- Credit tracking
  credits_remaining INTEGER DEFAULT 0 CHECK (credits_remaining >= 0),
  credits_purchased INTEGER DEFAULT 0,
  credits_used INTEGER DEFAULT 0,
  free_trial_credits_granted INTEGER DEFAULT 2, -- New customers get 2 free

  -- Purchase tracking
  last_purchase_date TIMESTAMPTZ,
  total_spent_amount INTEGER DEFAULT 0, -- in cents

  -- Usage tracking
  total_generations INTEGER DEFAULT 0,
  last_generation_date TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customer_customization_credits_customer_id
  ON public.customer_customization_credits(customer_id);

-- RLS Policies
ALTER TABLE public.customer_customization_credits ENABLE ROW LEVEL SECURITY;

-- Customers can view their own credits
CREATE POLICY "Customers can view own credits"
  ON public.customer_customization_credits
  FOR SELECT
  USING (
    customer_id IN (
      SELECT id FROM public.user_profiles
      WHERE auth.uid() = user_id
    )
  );

-- Service role can insert/update credits (via API)
-- (Service role bypasses RLS, so no explicit policy needed)

-- Admins can view all credits
CREATE POLICY "Admins can view all credits"
  ON public.customer_customization_credits
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE auth.uid() = user_id
      AND user_type = 'admin'
    )
  );

-- =============================================
-- 3. Add customer-specific fields to image_catalog
-- =============================================

ALTER TABLE public.image_catalog
  ADD COLUMN IF NOT EXISTS created_by_customer_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_customer_generated BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_image_catalog_created_by_customer
  ON public.image_catalog(created_by_customer_id)
  WHERE created_by_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_image_catalog_is_customer_generated
  ON public.image_catalog(is_customer_generated)
  WHERE is_customer_generated = true;

-- =============================================
-- 4. Create helper functions
-- =============================================

-- Drop existing functions if they exist (to avoid type conflicts)
DROP FUNCTION IF EXISTS public.initialize_customer_credits() CASCADE;
DROP FUNCTION IF EXISTS public.deduct_customization_credit(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.add_customization_credits(UUID, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_customer_credit_balance(UUID) CASCADE;

-- Function to initialize credits for new customers
CREATE OR REPLACE FUNCTION public.initialize_customer_credits()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_type = 'customer' THEN
    INSERT INTO public.customer_customization_credits (
      customer_id,
      credits_remaining,
      free_trial_credits_granted
    ) VALUES (
      NEW.id,
      2, -- 2 free trial credits
      2
    )
    ON CONFLICT (customer_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-initialize credits when new customer created
DROP TRIGGER IF EXISTS trigger_initialize_customer_credits ON public.user_profiles;
CREATE TRIGGER trigger_initialize_customer_credits
  AFTER INSERT ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_customer_credits();

-- Function to deduct credits
CREATE OR REPLACE FUNCTION public.deduct_customization_credit(
  p_customer_id UUID,
  p_credits_to_deduct INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_credits INTEGER;
BEGIN
  -- Get current credits
  SELECT credits_remaining INTO v_current_credits
  FROM public.customer_customization_credits
  WHERE customer_id = p_customer_id
  FOR UPDATE;

  -- Check if enough credits
  IF v_current_credits IS NULL OR v_current_credits < p_credits_to_deduct THEN
    RETURN FALSE;
  END IF;

  -- Deduct credits
  UPDATE public.customer_customization_credits
  SET
    credits_remaining = credits_remaining - p_credits_to_deduct,
    credits_used = credits_used + p_credits_to_deduct,
    total_generations = total_generations + 1,
    last_generation_date = NOW(),
    updated_at = NOW()
  WHERE customer_id = p_customer_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add credits (after purchase)
CREATE OR REPLACE FUNCTION public.add_customization_credits(
  p_customer_id UUID,
  p_credits_to_add INTEGER,
  p_purchase_amount INTEGER DEFAULT 0
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.customer_customization_credits
  SET
    credits_remaining = credits_remaining + p_credits_to_add,
    credits_purchased = credits_purchased + p_credits_to_add,
    last_purchase_date = NOW(),
    total_spent_amount = total_spent_amount + p_purchase_amount,
    updated_at = NOW()
  WHERE customer_id = p_customer_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get customer credit balance
CREATE OR REPLACE FUNCTION public.get_customer_credit_balance(
  p_customer_id UUID
)
RETURNS TABLE (
  credits_remaining INTEGER,
  credits_purchased INTEGER,
  credits_used INTEGER,
  total_generations INTEGER,
  total_spent_amount INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.credits_remaining,
    c.credits_purchased,
    c.credits_used,
    c.total_generations,
    c.total_spent_amount
  FROM public.customer_customization_credits c
  WHERE c.customer_id = p_customer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 5. Create credit pack products in Stripe
-- =============================================

-- Note: The following Stripe products should be created via Stripe Dashboard or API:
--
-- Product: "Starter Pack" - 5 Credits
--   Price: £9.99 (999 pence)
--   Product ID: prod_starter_credits
--   Price ID: price_starter_credits
--   Metadata: { credits: 5, pack_type: "starter" }
--
-- Product: "Popular Pack" - 15 Credits (17% discount)
--   Price: £24.99 (2499 pence)
--   Product ID: prod_popular_credits
--   Price ID: price_popular_credits
--   Metadata: { credits: 15, pack_type: "popular" }
--
-- Product: "Pro Pack" - 50 Credits (30% discount)
--   Price: £69.99 (6999 pence)
--   Product ID: prod_pro_credits
--   Price ID: price_pro_credits
--   Metadata: { credits: 50, pack_type: "pro" }

-- =============================================
-- 6. Update timestamp trigger
-- =============================================

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_customer_generated_images_updated_at
  ON public.customer_generated_images;
CREATE TRIGGER trigger_update_customer_generated_images_updated_at
  BEFORE UPDATE ON public.customer_generated_images
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_customer_credits_updated_at
  ON public.customer_customization_credits;
CREATE TRIGGER trigger_update_customer_credits_updated_at
  BEFORE UPDATE ON public.customer_customization_credits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 7. Grant permissions
-- =============================================

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT ON public.customer_generated_images TO authenticated;
GRANT UPDATE ON public.customer_generated_images TO authenticated;

GRANT SELECT ON public.customer_customization_credits TO authenticated;

-- Service role has full access (bypasses RLS)

-- =============================================
-- Migration Complete
-- =============================================

-- To apply this migration:
-- 1. Run via Supabase SQL editor
-- 2. Or run via psql: psql $DATABASE_URL -f scripts/customer-image-customization-migration.sql

-- To verify:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'customer_%';
-- SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name LIKE '%customization%';
