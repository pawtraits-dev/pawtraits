-- Credit Pack Configuration System
-- Purpose: Allow admin to configure credit pack pricing, order credits, and per-feature costs
-- Date: 2025-10-23

-- =============================================
-- 1. Create customer_credit_pack_config table
-- =============================================

CREATE TABLE IF NOT EXISTS public.customer_credit_pack_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pack_id TEXT UNIQUE NOT NULL,  -- 'starter', 'popular', 'pro'
  pack_name TEXT NOT NULL,

  -- Customization credits
  credits_amount INTEGER NOT NULL CHECK (credits_amount > 0),
  price_pence INTEGER NOT NULL CHECK (price_pence > 0),
  price_currency TEXT NOT NULL DEFAULT 'GBP',

  -- Print order credits (bonus credit for product purchases)
  order_credit_pence INTEGER NOT NULL DEFAULT 0 CHECK (order_credit_pence >= 0),

  -- Per-feature credit costs (configurable generation costs)
  base_variation_cost INTEGER NOT NULL DEFAULT 1 CHECK (base_variation_cost > 0),
  multi_animal_cost INTEGER NOT NULL DEFAULT 2 CHECK (multi_animal_cost > 0),
  format_variation_cost INTEGER NOT NULL DEFAULT 1 CHECK (format_variation_cost > 0),
  outfit_variation_cost INTEGER NOT NULL DEFAULT 1 CHECK (outfit_variation_cost > 0),

  -- Free trial configuration
  free_trial_credits INTEGER NOT NULL DEFAULT 2 CHECK (free_trial_credits >= 0),

  -- Display settings
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_recommended BOOLEAN NOT NULL DEFAULT false,
  discount_percentage INTEGER NOT NULL DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  display_order INTEGER NOT NULL DEFAULT 0,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_credit_pack_config_pack_id
  ON public.customer_credit_pack_config(pack_id);
CREATE INDEX IF NOT EXISTS idx_credit_pack_config_is_active
  ON public.customer_credit_pack_config(is_active)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_credit_pack_config_display_order
  ON public.customer_credit_pack_config(display_order);

-- =============================================
-- 2. Seed initial credit pack data
-- =============================================

INSERT INTO public.customer_credit_pack_config (
  pack_id,
  pack_name,
  credits_amount,
  price_pence,
  price_currency,
  order_credit_pence,
  base_variation_cost,
  multi_animal_cost,
  format_variation_cost,
  outfit_variation_cost,
  free_trial_credits,
  is_active,
  is_recommended,
  discount_percentage,
  display_order
) VALUES
  (
    'starter',
    'Starter Pack',
    5,
    999,  -- £9.99
    'GBP',
    250,  -- £2.50 order credit
    1,
    2,
    1,
    1,
    2,
    true,
    false,
    0,
    1
  ),
  (
    'popular',
    'Popular Pack',
    15,
    2499,  -- £24.99
    'GBP',
    500,  -- £5.00 order credit
    1,
    2,
    1,
    1,
    2,
    true,
    true,  -- Recommended
    17,  -- 17% discount
    2
  ),
  (
    'pro',
    'Pro Pack',
    50,
    6999,  -- £69.99
    'GBP',
    1500,  -- £15.00 order credit
    1,
    2,
    1,
    1,
    2,
    true,
    false,
    30,  -- 30% discount
    3
  )
ON CONFLICT (pack_id) DO NOTHING;

-- =============================================
-- 3. Enable RLS and create policies
-- =============================================

ALTER TABLE public.customer_credit_pack_config ENABLE ROW LEVEL SECURITY;

-- Public can view active credit packs
CREATE POLICY "Anyone can view active credit packs"
  ON public.customer_credit_pack_config
  FOR SELECT
  USING (is_active = true);

-- Admins can manage all credit packs
CREATE POLICY "Admins can manage credit packs"
  ON public.customer_credit_pack_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE auth.uid() = user_id
      AND user_type = 'admin'
    )
  );

-- Service role has full access (bypasses RLS)

-- =============================================
-- 4. Create helper function to get active config
-- =============================================

CREATE OR REPLACE FUNCTION public.get_credit_pack_config(p_pack_id TEXT DEFAULT NULL)
RETURNS SETOF public.customer_credit_pack_config AS $$
BEGIN
  IF p_pack_id IS NULL THEN
    -- Return all active packs ordered by display_order
    RETURN QUERY
    SELECT * FROM public.customer_credit_pack_config
    WHERE is_active = true
    ORDER BY display_order ASC, price_pence ASC;
  ELSE
    -- Return specific pack
    RETURN QUERY
    SELECT * FROM public.customer_credit_pack_config
    WHERE pack_id = p_pack_id AND is_active = true;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 5. Create function to get feature costs
-- =============================================

CREATE OR REPLACE FUNCTION public.get_feature_credit_costs()
RETURNS TABLE (
  base_variation_cost INTEGER,
  multi_animal_cost INTEGER,
  format_variation_cost INTEGER,
  outfit_variation_cost INTEGER,
  free_trial_credits INTEGER
) AS $$
BEGIN
  -- Return feature costs from the most popular or first pack as default
  RETURN QUERY
  SELECT
    c.base_variation_cost,
    c.multi_animal_cost,
    c.format_variation_cost,
    c.outfit_variation_cost,
    c.free_trial_credits
  FROM public.customer_credit_pack_config c
  WHERE c.is_active = true
  ORDER BY c.is_recommended DESC, c.display_order ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 6. Update trigger for updated_at
-- =============================================

DROP TRIGGER IF EXISTS trigger_update_credit_pack_config_updated_at
  ON public.customer_credit_pack_config;

CREATE TRIGGER trigger_update_credit_pack_config_updated_at
  BEFORE UPDATE ON public.customer_credit_pack_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 7. Grant permissions
-- =============================================

GRANT SELECT ON public.customer_credit_pack_config TO authenticated;
GRANT SELECT ON public.customer_credit_pack_config TO anon;

-- =============================================
-- 8. Add comments for documentation
-- =============================================

COMMENT ON TABLE public.customer_credit_pack_config IS 'Configuration for customer credit pack pricing and feature costs';
COMMENT ON COLUMN public.customer_credit_pack_config.pack_id IS 'Unique identifier for the pack (starter, popular, pro)';
COMMENT ON COLUMN public.customer_credit_pack_config.credits_amount IS 'Number of customization credits in this pack';
COMMENT ON COLUMN public.customer_credit_pack_config.price_pence IS 'Price in pence (e.g., 999 = £9.99)';
COMMENT ON COLUMN public.customer_credit_pack_config.order_credit_pence IS 'Bonus credit amount in pence for print orders';
COMMENT ON COLUMN public.customer_credit_pack_config.base_variation_cost IS 'Credits required for basic breed+coat variation';
COMMENT ON COLUMN public.customer_credit_pack_config.multi_animal_cost IS 'Credits required for multi-animal generation';
COMMENT ON COLUMN public.customer_credit_pack_config.format_variation_cost IS 'Credits per format variation';
COMMENT ON COLUMN public.customer_credit_pack_config.outfit_variation_cost IS 'Credits per outfit variation';
COMMENT ON COLUMN public.customer_credit_pack_config.free_trial_credits IS 'Free credits granted to new customers';

-- =============================================
-- Migration Complete
-- =============================================

-- To apply this migration:
-- 1. Run via Supabase SQL editor
-- 2. Or run via psql: psql $DATABASE_URL -f scripts/credit-pack-config-schema.sql

-- To verify:
-- SELECT * FROM customer_credit_pack_config ORDER BY display_order;
-- SELECT * FROM get_credit_pack_config();
-- SELECT * FROM get_feature_credit_costs();
