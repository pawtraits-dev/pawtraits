-- =====================================================
-- LIFECYCLE EMAIL TEMPLATES SEEDER
-- =====================================================
-- Professional branded templates for key customer and partner lifecycle events
-- Uses Handlebars syntax for variable interpolation
-- =====================================================

-- Delete existing test templates to avoid conflicts
DELETE FROM message_templates WHERE template_key IN (
  'order_confirmation', 'order_shipped', 'order_delivered',
  'customer_welcome', 'customer_credit_earned', 'customer_credit_redeemed',
  'partner_approval', 'partner_approved', 'partner_application_received',
  'partner_commission_earned', 'partner_payout_processed', 'referral_purchase'
);

-- =====================================================
-- CUSTOMER LIFECYCLE TEMPLATES
-- =====================================================

-- 1. ORDER CONFIRMATION (Transactional)
INSERT INTO message_templates (
  template_key, name, description, category, channels, user_types,
  email_subject_template, email_body_template,
  inbox_title_template, inbox_body_template, inbox_icon, inbox_action_url, inbox_action_label,
  variables, is_active, can_be_disabled, default_enabled, priority
) VALUES (
  'order_confirmation',
  'Order Confirmation',
  'Sent immediately after order is confirmed and payment successful',
  'transactional',
  ARRAY['email', 'inbox'],
  ARRAY['customer'],
  'Order Confirmation #{{order_number}} - Pawtraits',
  -- Email body uses external HTML file
  '<p>See lib/messaging/templates/customer-order-confirmation.html</p>',
  'Order Confirmed! 🎉',
  'Your order {{order_number}} has been confirmed and is being prepared. Total: {{total_amount}}',
  'package',
  '/orders/{{order_id}}',
  'View Order',
  '{
    "customer_name": "string",
    "order_number": "string",
    "order_id": "string",
    "items": "array",
    "subtotal": "string",
    "discount_amount": "string",
    "referral_code": "string",
    "credit_applied": "string",
    "shipping_amount": "string",
    "total_amount": "string",
    "shipping_name": "string",
    "shipping_address_line_1": "string",
    "shipping_address_line_2": "string",
    "shipping_city": "string",
    "shipping_postcode": "string",
    "shipping_country": "string",
    "estimated_delivery": "string",
    "order_url": "string",
    "payment_intent_id": "string",
    "unsubscribe_url": "string"
  }'::jsonb,
  true, false, true, 'high'
);

-- 2. ORDER SHIPPED (Transactional)
INSERT INTO message_templates (
  template_key, name, description, category, channels, user_types,
  email_subject_template, email_body_template,
  inbox_title_template, inbox_body_template, inbox_icon, inbox_action_url, inbox_action_label,
  sms_body_template,
  variables, is_active, can_be_disabled, default_enabled, priority
) VALUES (
  'order_shipped',
  'Order Shipped',
  'Sent when order ships with tracking information',
  'transactional',
  ARRAY['email', 'sms', 'inbox'],
  ARRAY['customer'],
  'Your order has shipped! Track #{{tracking_number}}',
  '<p>See lib/messaging/templates/customer-order-shipped.html</p>',
  'Order Shipped! 📦',
  'Your order {{order_number}} has shipped! Track your package: {{tracking_number}}',
  'truck',
  '{{tracking_url}}',
  'Track Package',
  'Your Pawtraits order {{order_number}} has shipped! Track it here: {{tracking_url}}',
  '{
    "customer_name": "string",
    "order_number": "string",
    "shipped_date": "string",
    "tracking_number": "string",
    "tracking_url": "string",
    "estimated_delivery_date": "string",
    "carrier_name": "string",
    "shipping_method": "string",
    "item_count": "number",
    "shipping_city": "string",
    "shipping_postcode": "string",
    "shipping_country": "string",
    "order_url": "string"
  }'::jsonb,
  true, false, true, 'high'
);

-- 3. ORDER DELIVERED (Transactional)
INSERT INTO message_templates (
  template_key, name, description, category, channels, user_types,
  email_subject_template, email_body_template,
  inbox_title_template, inbox_body_template, inbox_icon, inbox_action_url, inbox_action_label,
  variables, is_active, can_be_disabled, default_enabled, priority
) VALUES (
  'order_delivered',
  'Order Delivered',
  'Sent when order is marked as delivered',
  'transactional',
  ARRAY['email', 'inbox'],
  ARRAY['customer'],
  'Your order has been delivered! 🎉',
  '<h1>Your order has arrived!</h1><p>Hi {{customer_name}},</p><p>Your order {{order_number}} was delivered on {{delivery_date}}. We hope you love your custom pet portrait!</p><p>Share your beautiful artwork on social media and tag us @pawtraits</p><p><a href="{{review_url}}">Leave a review</a> • <a href="{{referral_url}}">Refer a friend and earn £{{referral_reward}}</a></p>',
  'Order Delivered! 🎉',
  'Your order {{order_number}} was delivered on {{delivery_date}}. Enjoy your custom pet portrait!',
  'check-circle',
  '/orders/{{order_id}}',
  'View Order',
  '{
    "customer_name": "string",
    "order_number": "string",
    "order_id": "string",
    "delivery_date": "string",
    "review_url": "string",
    "referral_url": "string",
    "referral_reward": "string"
  }'::jsonb,
  true, false, true, 'normal'
);

-- 4. CUSTOMER WELCOME EMAIL (Operational)
INSERT INTO message_templates (
  template_key, name, description, category, channels, user_types,
  email_subject_template, email_body_template,
  inbox_title_template, inbox_body_template, inbox_icon, inbox_action_url, inbox_action_label,
  variables, is_active, can_be_disabled, default_enabled, priority
) VALUES (
  'customer_welcome',
  'Welcome Email',
  'Sent after customer signup confirmation',
  'operational',
  ARRAY['email', 'inbox'],
  ARRAY['customer'],
  'Welcome to Pawtraits! Transform your pet into art 🐾',
  '<h1>Welcome to Pawtraits!</h1><p>Hi {{customer_name}},</p><p>Thank you for joining Pawtraits! We''re excited to help you transform your beloved pet into a beautiful custom portrait.</p><h2>Getting Started</h2><ul><li>Browse our gallery of AI-generated pet portraits</li><li>Choose your favorite style and format</li><li>Order your custom print in minutes</li></ul><p><a href="{{gallery_url}}">Browse Gallery</a></p><p>Questions? Contact us at support@pawtraits.pics</p>',
  'Welcome to Pawtraits! 🐾',
  'Welcome! Browse our gallery of beautiful pet portraits and order your custom print today.',
  'check-circle',
  '/customer/gallery',
  'Browse Gallery',
  '{
    "customer_name": "string",
    "gallery_url": "string",
    "unsubscribe_url": "string"
  }'::jsonb,
  true, true, true, 'normal'
);

-- 5. CUSTOMER CREDIT EARNED (Operational)
INSERT INTO message_templates (
  template_key, name, description, category, channels, user_types,
  email_subject_template, email_body_template,
  inbox_title_template, inbox_body_template, inbox_icon, inbox_action_url, inbox_action_label,
  variables, is_active, can_be_disabled, default_enabled, priority
) VALUES (
  'customer_credit_earned',
  'Customer Credit Earned',
  'Sent when friend makes purchase using their referral code',
  'operational',
  ARRAY['email', 'inbox'],
  ARRAY['customer'],
  'You earned {{credit_amount}} credit! 💰',
  '<h1>You earned credit!</h1><p>Hi {{customer_name}},</p><p>Great news! {{referred_customer_name}} just made a purchase using your referral code, and you''ve earned {{credit_amount}} in store credit!</p><p><strong>Your credit balance:</strong> {{total_credit_balance}}</p><p>Use your credit on your next order to get a discount.</p><p><a href="{{shop_url}}">Shop Now</a> • <a href="{{referrals_url}}">Share & Earn More</a></p>',
  'You Earned {{credit_amount}}! 💰',
  '{{referred_customer_name}} made a purchase! You earned {{credit_amount}} credit. Balance: {{total_credit_balance}}',
  'dollar-sign',
  '/customer/referrals',
  'View Credits',
  '{
    "customer_name": "string",
    "referred_customer_name": "string",
    "credit_amount": "string",
    "total_credit_balance": "string",
    "shop_url": "string",
    "referrals_url": "string"
  }'::jsonb,
  true, true, true, 'normal'
);

-- =====================================================
-- PARTNER LIFECYCLE TEMPLATES
-- =====================================================

-- 6. PARTNER APPLICATION RECEIVED (Operational)
INSERT INTO message_templates (
  template_key, name, description, category, channels, user_types,
  email_subject_template, email_body_template,
  inbox_title_template, inbox_body_template, inbox_icon,
  variables, is_active, can_be_disabled, default_enabled, priority
) VALUES (
  'partner_application_received',
  'Partner Application Received',
  'Sent immediately after partner submits application',
  'operational',
  ARRAY['email', 'inbox'],
  ARRAY['partner'],
  'Application Received - Pawtraits Partner Program',
  '<h1>Application Received</h1><p>Hi {{partner_name}},</p><p>Thank you for applying to the Pawtraits Partner Program! We''ve received your application and our team is reviewing it.</p><h2>What Happens Next</h2><ul><li>Our team will review your application within 2-3 business days</li><li>You''ll receive an email notification with our decision</li><li>If approved, you''ll gain immediate access to your partner dashboard</li></ul><p>Questions? Contact us at partners@pawtraits.pics</p>',
  'Application Received',
  'Thank you for applying! We''ll review your application and get back to you within 2-3 business days.',
  'clock',
  '{
    "partner_name": "string",
    "application_date": "string"
  }'::jsonb,
  true, false, true, 'normal'
);

-- 7. PARTNER APPROVED (Transactional)
INSERT INTO message_templates (
  template_key, name, description, category, channels, user_types,
  email_subject_template, email_body_template,
  inbox_title_template, inbox_body_template, inbox_icon, inbox_action_url, inbox_action_label,
  variables, is_active, can_be_disabled, default_enabled, priority
) VALUES (
  'partner_approved',
  'Partner Application Approved',
  'Sent when partner application is approved by admin',
  'transactional',
  ARRAY['email', 'inbox'],
  ARRAY['partner'],
  'Welcome to Pawtraits Partner Program! 🎉',
  '<p>See lib/messaging/templates/partner-approved.html</p>',
  'Welcome Partner! 🎉',
  'Congratulations! Your application has been approved. Start earning {{commission_rate}}% commission on referrals.',
  'check-circle',
  '/partners/dashboard',
  'Access Dashboard',
  '{
    "partner_name": "string",
    "partner_id": "string",
    "commission_rate": "string",
    "lifetime_commission_rate": "string",
    "dashboard_url": "string",
    "guide_url": "string",
    "terms_url": "string",
    "unsubscribe_url": "string"
  }'::jsonb,
  true, false, true, 'high'
);

-- 8. PARTNER COMMISSION EARNED (Operational)
INSERT INTO message_templates (
  template_key, name, description, category, channels, user_types,
  email_subject_template, email_body_template,
  inbox_title_template, inbox_body_template, inbox_icon, inbox_action_url, inbox_action_label,
  sms_body_template,
  variables, is_active, can_be_disabled, default_enabled, priority
) VALUES (
  'partner_commission_earned',
  'Commission Earned',
  'Sent when partner earns commission from referred customer purchase',
  'operational',
  ARRAY['email', 'sms', 'inbox'],
  ARRAY['partner'],
  'You earned {{commission_amount}}! 💰',
  '<p>See lib/messaging/templates/partner-commission-earned.html</p>',
  'Commission Earned! 💰',
  'You earned {{commission_amount}}! {{customer_name}} made a purchase using your referral.',
  'dollar-sign',
  '/partners/commissions',
  'View Commission',
  'You earned {{commission_amount}}! A customer purchased using your referral code. View details: {{dashboard_url}}',
  '{
    "partner_name": "string",
    "partner_id": "string",
    "commission_id": "string",
    "commission_amount": "string",
    "commission_rate": "string",
    "order_number": "string",
    "order_amount": "string",
    "order_date": "string",
    "customer_name": "string",
    "total_commissions": "string",
    "total_referrals": "string",
    "payout_date": "string",
    "payment_method": "string",
    "dashboard_url": "string",
    "unsubscribe_url": "string"
  }'::jsonb,
  true, true, true, 'normal'
);

-- 9. PARTNER PAYOUT PROCESSED (Transactional)
INSERT INTO message_templates (
  template_key, name, description, category, channels, user_types,
  email_subject_template, email_body_template,
  inbox_title_template, inbox_body_template, inbox_icon, inbox_action_url, inbox_action_label,
  variables, is_active, can_be_disabled, default_enabled, priority
) VALUES (
  'partner_payout_processed',
  'Payout Processed',
  'Sent when partner commission payout is processed',
  'transactional',
  ARRAY['email', 'inbox'],
  ARRAY['partner'],
  'Your payout of {{payout_amount}} has been processed',
  '<h1>Payout Processed</h1><p>Hi {{partner_name}},</p><p>Your commission payout has been processed and is on its way!</p><h2>Payout Details</h2><ul><li><strong>Amount:</strong> {{payout_amount}}</li><li><strong>Payment Method:</strong> {{payment_method}}</li><li><strong>Processed Date:</strong> {{processed_date}}</li><li><strong>Expected Arrival:</strong> {{expected_arrival}}</li><li><strong>Commissions Included:</strong> {{commission_count}} orders</li></ul><p><a href="{{statement_url}}">View Payment Statement</a></p>',
  'Payout Processed! 💳',
  'Your payout of {{payout_amount}} has been processed. Expected arrival: {{expected_arrival}}',
  'dollar-sign',
  '/partners/payouts',
  'View Payout',
  '{
    "partner_name": "string",
    "payout_amount": "string",
    "payment_method": "string",
    "processed_date": "string",
    "expected_arrival": "string",
    "commission_count": "string",
    "statement_url": "string"
  }'::jsonb,
  true, false, true, 'high'
);

-- =====================================================
-- TEMPLATE METADATA COMMENTS
-- =====================================================

COMMENT ON TABLE message_templates IS 'Professional branded email templates for customer and partner lifecycle events';

-- Log template creation
DO $$
BEGIN
  RAISE NOTICE 'Successfully created lifecycle email templates';
  RAISE NOTICE 'Customer templates: order_confirmation, order_shipped, order_delivered, customer_welcome, customer_credit_earned';
  RAISE NOTICE 'Partner templates: partner_application_received, partner_approved, partner_commission_earned, partner_payout_processed';
END $$;
