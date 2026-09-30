-- =============================================================================
-- Self-print fulfilment (default) with optional routing to Gelato
-- Spec: docs/specs/self-print-fulfilment.md
-- Safe to re-run.
-- =============================================================================
BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Orders: who fulfils the posted items, and where they are in pick-pack-post
-- -----------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfillment_provider text,
  ADD COLUMN IF NOT EXISTS self_print_status text,
  ADD COLUMN IF NOT EXISTS printed_at timestamptz,
  ADD COLUMN IF NOT EXISTS packed_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS carrier text,
  ADD COLUMN IF NOT EXISTS tracking_code text,
  ADD COLUMN IF NOT EXISTS tracking_url text,
  ADD COLUMN IF NOT EXISTS shipped_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS fulfillment_notes text;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_fulfillment_provider_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_fulfillment_provider_check
  CHECK (fulfillment_provider IS NULL OR fulfillment_provider IN ('self_print', 'gelato'));

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_self_print_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_self_print_status_check
  CHECK (self_print_status IS NULL OR self_print_status IN ('to_print', 'printed', 'packed', 'posted'));

CREATE INDEX IF NOT EXISTS orders_fulfilment_queue_idx
  ON public.orders (fulfillment_provider, self_print_status, created_at);

-- Existing orders that already went to Gelato
UPDATE public.orders SET fulfillment_provider = 'gelato'
WHERE fulfillment_provider IS NULL AND gelato_order_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. Setting: where new paid orders go (changeable in /admin/orders)
-- -----------------------------------------------------------------------------
INSERT INTO public.app_settings (key, value, description) VALUES
  ('default_fulfillment_provider', '"self_print"'::jsonb,
   'Where new paid orders with posted prints go: "self_print" (queue in /admin/orders) or "gelato" (sent automatically)'),
  ('return_address', '""'::jsonb,
   'Return address printed under the address label on packing slips (one line)')
ON CONFLICT (key) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. "Your order has been posted" email (file template, sent from /admin/orders)
-- -----------------------------------------------------------------------------
INSERT INTO public.message_templates (
  template_key, name, description, category, channels, user_types,
  email_subject_template, email_body_template,
  inbox_title_template, inbox_body_template, inbox_icon, inbox_action_url, inbox_action_label,
  variables, is_active, can_be_disabled, default_enabled, priority
) VALUES (
  'order_shipped',
  'Order Shipped',
  'Sent when an order is posted (self-print) or shipped (Gelato)',
  'transactional',
  ARRAY['email', 'inbox'],
  ARRAY['customer'],
  'Your Pawtraits order {{order_number}} is on its way 📦',
  '<p>See lib/messaging/templates/customer-order-shipped.html</p>',
  'Order posted 📦',
  'Your order {{order_number}} is on its way.',
  'truck', '{{order_url}}', 'View order',
  '{"customer_name":"string","order_number":"string","shipped_date":"string","tracking_number":"string","tracking_url":"string","estimated_delivery_date":"string","carrier_name":"string","shipping_method":"string","item_count":"number","shipping_city":"string","shipping_postcode":"string","shipping_country":"string","order_url":"string","base_url":"string","has_tracking":"boolean"}'::jsonb,
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
-- DELETE FROM public.app_settings WHERE key IN ('default_fulfillment_provider', 'return_address');
-- DROP INDEX IF EXISTS public.orders_fulfilment_queue_idx;
-- ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_fulfillment_provider_check,
--   DROP CONSTRAINT IF EXISTS orders_self_print_status_check;
-- ALTER TABLE public.orders DROP COLUMN IF EXISTS fulfillment_provider, DROP COLUMN IF EXISTS self_print_status,
--   DROP COLUMN IF EXISTS printed_at, DROP COLUMN IF EXISTS packed_at, DROP COLUMN IF EXISTS carrier,
--   DROP COLUMN IF EXISTS shipped_email_sent_at, DROP COLUMN IF EXISTS fulfillment_notes;
--   -- (tracking_code, tracking_url, shipped_at are also written by the Gelato webhook — keep them)
-- COMMIT;
