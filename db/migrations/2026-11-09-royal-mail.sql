-- =============================================================================
-- Migration: Royal Mail labels (Click & Drop API) and parcel tracking (Tracking API v2)
-- Date: 2026-11-09 · Safe to re-run. Code: lib/shipping/royal-mail/
--
-- Labels: packed orders are sent to Click & Drop from /admin/orders; the label PDF and tracking
-- number come straight back (Online Business Account). Tracking: a cron checks each posted
-- parcel and tells the customer (email + account inbox) when it's out for delivery, delivered,
-- missed or waiting to be collected. Customers see the timeline on /orders/[id].
-- =============================================================================
BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS rm_order_identifier bigint,            -- Click & Drop order id
  ADD COLUMN IF NOT EXISTS rm_label_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS rm_package jsonb,                        -- { format, grams, serviceCode }
  ADD COLUMN IF NOT EXISTS tracking_status text,                    -- lib/shipping/royal-mail/status.ts
  ADD COLUMN IF NOT EXISTS tracking_status_text text,               -- Royal Mail's latest wording
  ADD COLUMN IF NOT EXISTS tracking_events jsonb NOT NULL DEFAULT '[]'::jsonb,   -- newest first
  ADD COLUMN IF NOT EXISTS tracking_last_event_at timestamptz,
  ADD COLUMN IF NOT EXISTS tracking_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS tracking_error text,
  ADD COLUMN IF NOT EXISTS tracking_notified jsonb NOT NULL DEFAULT '{}'::jsonb,  -- { stage: sent at }
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

CREATE INDEX IF NOT EXISTS orders_tracking_due_idx ON public.orders (tracking_checked_at)
  WHERE tracking_number IS NOT NULL AND delivered_at IS NULL;

INSERT INTO public.app_settings (key, value, description) VALUES
  ('royal_mail', '{"service_uk":"","service_europe":"","service_world":"","packaging_grams":120,"print_grams_per_100cm2":25,"large_letter_max_prints":2}'::jsonb,
   'Royal Mail labels: Click & Drop service codes per destination (blank = Click & Drop''s own rules) and parcel weight estimate')
ON CONFLICT (key) DO NOTHING;

-- Tracking updates to the customer (email + account inbox): out for delivery, delivered, missed,
-- waiting to collect, coming back. Body: lib/messaging/templates/customer-order-tracking.html
INSERT INTO public.message_templates (
  template_key, name, description, category, channels, user_types,
  email_subject_template, email_body_template,
  inbox_title_template, inbox_body_template, inbox_icon, inbox_action_url, inbox_action_label,
  variables, is_active, can_be_disabled, default_enabled, priority
) VALUES (
  'order_tracking_update',
  'Order tracking update',
  'Royal Mail tracking milestones for a posted order (lib/shipping/royal-mail/tracking-server.ts)',
  'transactional',
  ARRAY['email', 'inbox'],
  ARRAY['customer'],
  '{{{subject}}}',
  '<p>See lib/messaging/templates/customer-order-tracking.html</p>',
  '{{{inbox_title}}}',
  '{{{inbox_body}}}',
  'truck', '{{order_url}}', 'Track your order',
  '{"customer_name":"string","order_number":"string","stage":"string","subject":"string","headline":"string","message":"string","inbox_title":"string","inbox_body":"string","event_time":"string","event_location":"string","tracking_number":"string","tracking_url":"string","order_url":"string","hero_image_url":"string","base_url":"string"}'::jsonb,
  true, true, true, 'high'
)
ON CONFLICT (template_key) DO UPDATE SET
  email_subject_template = EXCLUDED.email_subject_template,
  email_body_template = EXCLUDED.email_body_template,
  inbox_title_template = EXCLUDED.inbox_title_template,
  inbox_body_template = EXCLUDED.inbox_body_template,
  variables = EXCLUDED.variables,
  updated_at = now();

COMMIT;

-- Rollback (manual):
-- ALTER TABLE public.orders DROP COLUMN IF EXISTS rm_order_identifier, DROP COLUMN IF EXISTS rm_label_created_at,
--   DROP COLUMN IF EXISTS rm_package, DROP COLUMN IF EXISTS tracking_status, DROP COLUMN IF EXISTS tracking_status_text,
--   DROP COLUMN IF EXISTS tracking_events, DROP COLUMN IF EXISTS tracking_last_event_at, DROP COLUMN IF EXISTS tracking_checked_at,
--   DROP COLUMN IF EXISTS tracking_error, DROP COLUMN IF EXISTS tracking_notified, DROP COLUMN IF EXISTS delivered_at;
-- DELETE FROM public.app_settings WHERE key = 'royal_mail';
-- DELETE FROM public.message_templates WHERE template_key = 'order_tracking_update';
