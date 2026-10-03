-- =============================================================================
-- Migration: Customer email refresh — subjects, credit email body, "on Instagram" email
-- Date: 2026-10-06
-- Spec:  docs/specs/email-refresh.md
-- Safe to re-run.
--
-- Email bodies now live in lib/messaging/templates/*.html (shared layout in partials/).
-- This updates the subject lines stored with each template and points the referral-credit
-- email at its new file. Subjects use {{{triple}}} braces so names aren't HTML-escaped.
-- =============================================================================

BEGIN;

UPDATE public.message_templates SET
  email_subject_template = '{{#if is_collected}}Your Pawtraits receipt 🐾{{else}}{{#if is_digital_only}}Your Pawtrait download is ready 🎨{{else}}Order confirmed: {{#if pet_possessive}}{{{pet_possessive}}}{{else}}your{{/if}} Pawtrait is being printed 🎨{{/if}}{{/if}}',
  email_body_template = '<p>See lib/messaging/templates/customer-order-confirmation.html</p>',
  updated_at = now()
WHERE template_key = 'order_confirmation';

UPDATE public.message_templates SET
  email_subject_template = 'Your Pawtrait is on its way 📦',
  email_body_template = '<p>See lib/messaging/templates/customer-order-shipped.html</p>',
  updated_at = now()
WHERE template_key = 'order_shipped';

UPDATE public.message_templates SET
  email_subject_template = '{{{customer_name}}}, {{#if has_gift}}your free digital copy is waiting 🎁{{else}}your Pawtraits account is ready{{/if}}',
  updated_at = now()
WHERE template_key = 'guest_account_ready';

UPDATE public.message_templates SET
  email_subject_template = 'You’ve earned {{{credit_amount}}} credit 🎉',
  email_body_template = '<p>See lib/messaging/templates/customer-credit-earned.html</p>',
  updated_at = now()
WHERE template_key = 'customer_credit_earned';

-- Social loop phase 4: "your pet is on Instagram" (sent after a carousel is posted)
INSERT INTO public.message_templates (
  template_key, name, description, category, channels, user_types,
  email_subject_template, email_body_template, variables, is_active, can_be_disabled, default_enabled, priority
) VALUES (
  'customer_on_instagram', 'Your pet is on Instagram', 'Sent to the customers whose pets are in a posted Instagram carousel',
  'operational', ARRAY['email'], ARRAY['customer'],
  '{{{pet_name}}}’s on Instagram! 📸',
  '<p>See lib/messaging/templates/customer-on-instagram.html</p>',
  '{"pet_name":"string","picture_url":"string","post_url":"string","opt_out_url":"string","base_url":"string"}'::jsonb,
  true, true, true, 'normal'
)
ON CONFLICT (template_key) DO UPDATE SET
  email_subject_template = EXCLUDED.email_subject_template,
  email_body_template = EXCLUDED.email_body_template,
  variables = EXCLUDED.variables,
  updated_at = now();

COMMIT;
