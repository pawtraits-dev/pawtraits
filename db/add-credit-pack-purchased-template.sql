-- =====================================================
-- CREDIT PACK PURCHASE EMAIL TEMPLATE
-- =====================================================
-- Template for confirmation email when customer purchases credits
-- Integrates with existing messaging infrastructure
-- =====================================================

-- Remove template if it exists
DELETE FROM message_templates WHERE template_key = 'credit_pack_purchased';

-- Create the credit pack purchase confirmation template
INSERT INTO message_templates (
  template_key,
  name,
  description,
  category,
  channels,
  user_types,
  email_subject_template,
  email_body_template,
  inbox_title_template,
  inbox_body_template,
  inbox_icon,
  inbox_action_url,
  inbox_action_label,
  variables,
  is_active,
  can_be_disabled,
  default_enabled,
  priority
) VALUES (
  'credit_pack_purchased',
  'Credit Pack Purchase Confirmation',
  'Sent when customer purchases customization credits including order credit bonus',
  'transactional',
  ARRAY['email', 'inbox'],
  ARRAY['customer'],
  'Your {{pack_name}} credits are ready! 🎨',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    h1 { color: #8B5CF6; font-size: 28px; margin-bottom: 20px; }
    h2 { color: #6B46C1; font-size: 20px; margin-top: 24px; margin-bottom: 12px; }
    ul { padding-left: 20px; }
    li { margin-bottom: 8px; }
    .button { background: linear-gradient(135deg, #8B5CF6 0%, #6B46C1 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; margin-top: 20px; font-weight: 600; }
    .stats { background: #F3F4F6; padding: 16px; border-radius: 8px; margin: 20px 0; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #E5E7EB; font-size: 14px; color: #6B7280; }
  </style>
</head>
<body>
  <h1>🎨 Your Credits Are Ready!</h1>

  <p>Hi {{customer_name}},</p>

  <p>Thank you for purchasing the <strong>{{pack_name}}</strong>! Your credits have been added to your account and are ready to use.</p>

  <div class="stats">
    <h2>✅ Purchase Summary</h2>
    <ul>
      <li><strong>Pack Purchased:</strong> {{pack_name}}</li>
      <li><strong>Customization Credits Added:</strong> {{credits_added}} credits</li>
      <li><strong>Order Credit Bonus:</strong> {{order_credit}} <span style="color: #10B981; font-size: 14px;">(use on physical prints!)</span></li>
      <li><strong>Amount Paid:</strong> {{amount_paid}}</li>
    </ul>
  </div>

  <div class="stats">
    <h2>💰 Your Updated Balances</h2>
    <ul>
      <li>
        <strong>Customization Credits:</strong><br>
        <span style="color: #6B7280;">Previous: {{previous_customization_credits}} → New: {{total_customization_credits}} credits</span>
      </li>
      <li>
        <strong>Order Credit:</strong><br>
        <span style="color: #6B7280;">Previous: {{previous_order_credit}} → New: {{total_order_credit}}</span>
      </li>
    </ul>
  </div>

  <div class="stats" style="background: #ECFDF5; border: 1px solid #10B981;">
    <h2 style="color: #059669;">🎁 About Your Order Credit Bonus</h2>
    <ul style="color: #047857;">
      <li>Your {{order_credit}} bonus has been added to your account</li>
      <li>Use it on any physical print order (canvas, paper, acrylic, etc.)</li>
      <li>View and track your rewards in your <a href="{{referrals_url}}" style="color: #059669; text-decoration: underline;">Rewards Dashboard</a></li>
      <li>Bonus never expires and can be combined with other discounts</li>
    </ul>
  </div>

  <p><strong>What can you do with customization credits?</strong></p>
  <ul>
    <li>Generate custom variations of any portrait in our gallery</li>
    <li>Adjust breeds, themes, and styles to match your vision</li>
    <li>Create unlimited variations until you find the perfect portrait</li>
  </ul>

  <a href="{{customize_url}}" class="button">Start Customizing Now</a>

  <p style="margin-top: 24px;">
    <a href="{{browse_url}}" style="color: #8B5CF6;">Browse Gallery</a> •
    <a href="{{base_url}}/account" style="color: #8B5CF6;">View Account</a>
  </p>

  <div class="footer">
    <p>Questions? Reply to this email or visit our <a href="{{base_url}}/help">Help Center</a>.</p>
    <p><a href="{{unsubscribe_url}}">Unsubscribe from marketing emails</a></p>
    <p>© Pawtraits - Personalized AI Pet Portraits</p>
  </div>
</body>
</html>',
  'Credits Added! 🎨',
  'Your {{pack_name}} purchase is complete. {{credits_added}} customization credits added! Start creating now.',
  'gift',
  '/customize',
  'Start Customizing',
  '{
    "customer_name": "string",
    "pack_name": "string",
    "credits_added": "number",
    "order_credit": "string",
    "amount_paid": "string",
    "previous_customization_credits": "number",
    "previous_order_credit": "string",
    "total_customization_credits": "number",
    "total_order_credit": "string",
    "customize_url": "string",
    "browse_url": "string",
    "referrals_url": "string",
    "base_url": "string",
    "unsubscribe_url": "string"
  }'::jsonb,
  true,
  false,
  true,
  'high'
);

-- Verify the template was created
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM message_templates WHERE template_key = 'credit_pack_purchased') THEN
    RAISE NOTICE '✅ Credit pack purchase template created successfully';
  ELSE
    RAISE EXCEPTION '❌ Failed to create credit pack purchase template';
  END IF;
END $$;
