-- =============================================================================
-- Migration: Guest (no-account) customise → checkout, stall "pay on your phone",
--            post-order account creation, free digital download on activation.
-- Date: 2026-09-28
-- Spec:  docs/specs/guest-checkout.md
-- Requires: 2026-09-28-qr-stickers-and-locations.sql (stock_locations) run first.
-- Safe to re-run. Rollback at bottom.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Admin-controlled settings (key/value)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.user_profiles(id)
);

INSERT INTO public.app_settings (key, value, description) VALUES
  ('guest_preview_daily_limit', '20'::jsonb,
   'Max free AI previews per device per 24 hours for customers without an account'),
  ('guest_preview_ip_daily_limit', '200'::jsonb,
   'Backstop: max guest previews per IP per 24 hours (high, because stall shoppers share mobile networks)'),
  ('stall_prices_pence', '{"S": 2500, "M": 3500, "L": 5000}'::jsonb,
   'Price of a ready-made stall print, by size, when paid online at the stall'),
  ('stall_online_discount_pct', '0'::jsonb,
   'Optional % discount for paying online at the stall instead of cash/card reader'),
  ('welcome_gift_enabled', 'true'::jsonb,
   'Give a free digital download of the ordered design when a guest activates their account')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS app_settings_admin_all ON public.app_settings;
CREATE POLICY app_settings_admin_all ON public.app_settings
  FOR ALL USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND user_type = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND user_type = 'admin'));

-- -----------------------------------------------------------------------------
-- 2. Guest previews: custom images without an account
-- -----------------------------------------------------------------------------
ALTER TABLE public.customer_custom_images
  ALTER COLUMN customer_email DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS guest_session_id uuid,        -- pt_vid cookie
  ADD COLUMN IF NOT EXISTS ip_hash text;

CREATE INDEX IF NOT EXISTS customer_custom_images_guest_idx
  ON public.customer_custom_images (guest_session_id, created_at)
  WHERE guest_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS customer_custom_images_iphash_idx
  ON public.customer_custom_images (ip_hash, created_at)
  WHERE ip_hash IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3. Orders: guest flag + collected-at-stall fulfilment
-- -----------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_guest_checkout boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guest_session_id uuid,
  ADD COLUMN IF NOT EXISTS sales_channel text NOT NULL DEFAULT 'online';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_sales_channel_check') THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_sales_channel_check
      CHECK (sales_channel IN ('online', 'stall_online_payment'));
  END IF;
END $$;

-- one order per Stripe payment (protects against webhook retries). Skipped with a notice
-- if historic duplicates exist — clean those up and re-run.
DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_intent_unique
    ON public.orders (payment_intent_id) WHERE payment_intent_id IS NOT NULL;
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'orders_payment_intent_unique not created: duplicate payment_intent_id rows exist';
END $$;

-- allow 'collected' (handed over at the stall — no shipping, no Gelato)
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_fulfillment_type_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_fulfillment_type_check
  CHECK (fulfillment_type = ANY (ARRAY['physical','digital','hybrid','collected']));

-- -----------------------------------------------------------------------------
-- 3b. Server-side basket snapshot per PaymentIntent. The webhook builds order_items
--     from this (Stripe metadata only holds 3 items and can't be trusted for prices).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pending_checkouts (
  payment_intent_id text PRIMARY KEY,
  customer_email text NOT NULL,
  cart jsonb NOT NULL,                 -- [{productId, imageId, imageTitle, quantity, unitPrice, originalPrice?}]
  fulfillment text NOT NULL DEFAULT 'ship' CHECK (fulfillment IN ('ship', 'collect', 'digital')),
  guest_session_id uuid,
  consent jsonb,                       -- {analytics, marketing} at time of checkout (for server-side ad events)
  client jsonb,                        -- {ip, ua, fbp, fbc, url} for Meta CAPI match quality
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz
);
ALTER TABLE public.pending_checkouts ENABLE ROW LEVEL SECURITY;   -- service role only

-- -----------------------------------------------------------------------------
-- 4. Account claim links (long-lived; exchanged for a fresh Supabase session on click)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_claim_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,               -- SHA-256 of the token; raw token only ever in the email
  user_id uuid NOT NULL,                          -- auth.users.id
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  email text NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  first_used_at timestamptz,
  last_used_at timestamptz,
  use_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS account_claim_tokens_user_idx ON public.account_claim_tokens (user_id);
ALTER TABLE public.account_claim_tokens ENABLE ROW LEVEL SECURITY;   -- service role only

-- -----------------------------------------------------------------------------
-- 5. Digital download entitlements (purchases + welcome gift)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.digital_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  email text NOT NULL,
  custom_image_id uuid REFERENCES public.customer_custom_images(id) ON DELETE SET NULL,
  catalog_image_id uuid REFERENCES public.image_catalog(id) ON DELETE SET NULL,
  source text NOT NULL CHECK (source IN ('purchase', 'welcome_gift')),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'available', 'revoked')),
  unlocked_at timestamptz,
  download_count integer NOT NULL DEFAULT 0,
  last_downloaded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (custom_image_id IS NOT NULL OR catalog_image_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS digital_entitlements_customer_idx ON public.digital_entitlements (customer_id);
CREATE INDEX IF NOT EXISTS digital_entitlements_email_idx ON public.digital_entitlements (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS digital_entitlements_gift_once
  ON public.digital_entitlements (order_id, custom_image_id, catalog_image_id, source) NULLS NOT DISTINCT;

ALTER TABLE public.digital_entitlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS digital_entitlements_own_select ON public.digital_entitlements;
CREATE POLICY digital_entitlements_own_select ON public.digital_entitlements
  FOR SELECT USING (customer_id IN (
    SELECT customer_id FROM public.user_profiles WHERE user_id = auth.uid() AND customer_id IS NOT NULL));

-- -----------------------------------------------------------------------------
-- 6. Email template: account ready + free download
-- -----------------------------------------------------------------------------
INSERT INTO public.message_templates (
  template_key, name, description, category, channels, user_types,
  email_subject_template, email_body_template,
  inbox_title_template, inbox_body_template, inbox_icon, inbox_action_url, inbox_action_label,
  variables, is_active, can_be_disabled, default_enabled, priority
) VALUES (
  'guest_account_ready',
  'Guest Account Ready + Free Download',
  'Sent after a guest order: account created automatically; sign-in link unlocks a free digital download',
  'transactional',
  ARRAY['email'],
  ARRAY['customer'],
  '{{customer_name}}, your free digital download is waiting 🎁',
  '<p>See lib/messaging/templates/customer-guest-account-ready.html</p>',
  NULL, NULL, 'gift', NULL, NULL,
  '{"customer_name":"string","claim_url":"string","gift_image_url":"string","has_gift":"boolean","order_number":"string","expires_days":"number","base_url":"string"}'::jsonb,
  true, false, true, 'high'
)
ON CONFLICT (template_key) DO UPDATE SET
  email_subject_template = EXCLUDED.email_subject_template,
  email_body_template = EXCLUDED.email_body_template,
  variables = EXCLUDED.variables,
  updated_at = now();

COMMIT;

-- =============================================================================
-- ROLLBACK (manual)
-- =============================================================================
-- BEGIN;
-- DELETE FROM public.message_templates WHERE template_key = 'guest_account_ready';
-- DROP TABLE IF EXISTS public.digital_entitlements;
-- DROP TABLE IF EXISTS public.account_claim_tokens;
-- DROP TABLE IF EXISTS public.pending_checkouts;
-- ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_fulfillment_type_check;
-- ALTER TABLE public.orders ADD CONSTRAINT orders_fulfillment_type_check
--   CHECK (fulfillment_type = ANY (ARRAY['physical','digital','hybrid']));
-- ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_sales_channel_check;
-- ALTER TABLE public.orders DROP COLUMN IF EXISTS sales_channel, DROP COLUMN IF EXISTS guest_session_id,
--   DROP COLUMN IF EXISTS is_guest_checkout;
-- ALTER TABLE public.customer_custom_images DROP COLUMN IF EXISTS ip_hash, DROP COLUMN IF EXISTS guest_session_id;
-- -- (customer_email NOT NULL can only be restored once guest rows are removed)
-- DROP TABLE IF EXISTS public.app_settings;
-- COMMIT;
