-- =====================================================
-- PAWTRAITS MESSAGING SYSTEM DATABASE SCHEMA
-- =====================================================
-- Multi-channel messaging infrastructure supporting:
-- - Email (via Resend)
-- - SMS (via Twilio)
-- - In-app message inbox
--
-- User types: customer, partner, influencer, admin
-- =====================================================

-- =====================================================
-- 1. MESSAGE TEMPLATES
-- =====================================================
-- Defines reusable message templates for different events
-- Templates support multiple channels and user types

CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT UNIQUE NOT NULL,  -- e.g., 'order_confirmation', 'referral_purchase'
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('transactional', 'operational', 'marketing')),
  channels TEXT[] NOT NULL DEFAULT '{}',  -- ['email', 'sms', 'inbox']
  user_types TEXT[] NOT NULL DEFAULT '{}',  -- ['customer', 'partner', 'influencer', 'admin']

  -- Email template (HTML with Handlebars variables)
  email_subject_template TEXT,
  email_body_template TEXT,

  -- SMS template (plain text, max 160 chars)
  sms_body_template TEXT,

  -- Inbox message template
  inbox_title_template TEXT,
  inbox_body_template TEXT,
  inbox_action_url TEXT,  -- Optional deep link (e.g., /orders/{{order_id}})
  inbox_action_label TEXT,  -- e.g., "View Order"
  inbox_icon TEXT,  -- Icon identifier (e.g., 'package', 'user', 'dollar-sign')

  -- Template metadata
  variables JSONB DEFAULT '{}'::jsonb,  -- Required/optional variables with descriptions
  is_active BOOLEAN DEFAULT true,
  can_be_disabled BOOLEAN DEFAULT true,  -- Some templates are mandatory (transactional)
  default_enabled BOOLEAN DEFAULT true,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_message_templates_key ON message_templates(template_key);
CREATE INDEX idx_message_templates_active ON message_templates(is_active) WHERE is_active = true;
CREATE INDEX idx_message_templates_category ON message_templates(category);

COMMENT ON TABLE message_templates IS 'Reusable message templates for multi-channel messaging';
COMMENT ON COLUMN message_templates.template_key IS 'Unique identifier for programmatic access';
COMMENT ON COLUMN message_templates.channels IS 'Which channels this template supports';
COMMENT ON COLUMN message_templates.can_be_disabled IS 'Whether users can disable this notification type';

-- =====================================================
-- 2. MESSAGE QUEUE
-- =====================================================
-- Queue of messages waiting to be sent
-- Supports retry logic and scheduled sending

CREATE TABLE IF NOT EXISTS message_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL,  -- References message_templates.template_key
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('customer', 'partner', 'influencer', 'admin')),
  recipient_id UUID,  -- Link to user in respective table
  recipient_email TEXT,
  recipient_phone TEXT,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'inbox')),

  -- Rendered content (after template processing)
  subject TEXT,  -- For email
  body TEXT NOT NULL,

  -- Inbox-specific fields
  inbox_title TEXT,
  inbox_action_url TEXT,
  inbox_action_label TEXT,
  inbox_icon TEXT,

  -- Template variables used for rendering
  variables JSONB DEFAULT '{}'::jsonb,

  -- Queue management
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  provider_message_id TEXT,  -- External provider's message ID (for tracking)

  -- Additional context
  metadata JSONB DEFAULT '{}'::jsonb,  -- order_id, referral_id, etc.

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_message_queue_status ON message_queue(status);
CREATE INDEX idx_message_queue_scheduled ON message_queue(scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_message_queue_recipient ON message_queue(recipient_type, recipient_id);
CREATE INDEX idx_message_queue_channel ON message_queue(channel);
CREATE INDEX idx_message_queue_priority ON message_queue(priority, status) WHERE status = 'pending';
CREATE INDEX idx_message_queue_created ON message_queue(created_at DESC);

COMMENT ON TABLE message_queue IS 'Queue of messages awaiting delivery';
COMMENT ON COLUMN message_queue.scheduled_for IS 'When to send this message (for delayed sending)';
COMMENT ON COLUMN message_queue.retry_count IS 'Number of delivery attempts made';

-- =====================================================
-- 3. MESSAGE DELIVERY LOG
-- =====================================================
-- Archive of sent messages for audit and analytics
-- Auto-deleted after 90 days

CREATE TABLE IF NOT EXISTS message_delivery_log (
  id UUID PRIMARY KEY,  -- Copy of message_queue.id
  template_key TEXT NOT NULL,
  recipient_type TEXT NOT NULL,
  recipient_id UUID,
  recipient_email TEXT,
  recipient_phone TEXT,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  provider_message_id TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_delivery_log_recipient ON message_delivery_log(recipient_type, recipient_id);
CREATE INDEX idx_delivery_log_created ON message_delivery_log(created_at DESC);
-- Removed NOW() from index predicate as it's not IMMUTABLE
CREATE INDEX idx_delivery_log_archived ON message_delivery_log(archived_at);
CREATE INDEX idx_delivery_log_template ON message_delivery_log(template_key);
CREATE INDEX idx_delivery_log_status ON message_delivery_log(status);

COMMENT ON TABLE message_delivery_log IS 'Archive of sent messages for audit trail (90 day retention)';

-- =====================================================
-- 4. USER MESSAGE INBOX
-- =====================================================
-- In-app messages visible to users
-- Appears in message inbox with unread count

CREATE TABLE IF NOT EXISTS user_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_type TEXT NOT NULL CHECK (user_type IN ('customer', 'partner', 'influencer', 'admin')),
  user_id UUID NOT NULL,
  message_type TEXT NOT NULL,  -- Maps to template_key
  title TEXT NOT NULL,
  body TEXT NOT NULL,  -- Plain text or markdown
  action_url TEXT,  -- Optional deep link
  action_label TEXT,  -- Button text
  icon TEXT,  -- Icon identifier
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  is_archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ,  -- Optional expiration
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_messages_user ON user_messages(user_type, user_id, is_read, is_archived);
CREATE INDEX idx_user_messages_created ON user_messages(created_at DESC);
-- Removed partial index on unread messages to avoid RLS function issues
CREATE INDEX idx_user_messages_read_archived ON user_messages(is_read, is_archived);
CREATE INDEX idx_user_messages_type ON user_messages(message_type);

COMMENT ON TABLE user_messages IS 'In-app message inbox for users';
COMMENT ON COLUMN user_messages.action_url IS 'Deep link for action button (e.g., /orders/123)';

-- =====================================================
-- 5. ADMIN MESSAGE CONFIGURATION
-- =====================================================
-- Admin-level configuration for message templates
-- Controls throttling, scheduling, and global enable/disable

CREATE TABLE IF NOT EXISTS admin_message_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT UNIQUE NOT NULL,  -- References message_templates.template_key
  is_globally_enabled BOOLEAN DEFAULT true,

  -- Rate limiting settings
  throttle_settings JSONB DEFAULT '{}'::jsonb,  -- { "max_per_user_per_hour": 10, "max_global_per_hour": 1000 }

  -- Schedule settings (quiet hours, business hours only, etc.)
  schedule_settings JSONB DEFAULT '{}'::jsonb,  -- { "quiet_hours": { "start": "22:00", "end": "08:00" } }

  -- Admin metadata
  updated_by UUID,  -- Admin who made the changes
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_admin_message_config_template ON admin_message_config(template_key);

COMMENT ON TABLE admin_message_config IS 'Admin configuration for message templates';
COMMENT ON COLUMN admin_message_config.throttle_settings IS 'Rate limiting configuration per template';

-- =====================================================
-- 6. MESSAGE EVENTS
-- =====================================================
-- Event tracking for analytics and monitoring
-- Tracks delivery, opens, clicks, bounces, etc.

CREATE TABLE IF NOT EXISTS message_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_queue_id UUID,  -- References message_queue.id (nullable for inbox events)
  user_message_id UUID,  -- References user_messages.id (for inbox read events)
  event_type TEXT NOT NULL CHECK (event_type IN ('queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'read', 'archived')),
  event_data JSONB DEFAULT '{}'::jsonb,
  event_timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_message_events_queue ON message_events(message_queue_id) WHERE message_queue_id IS NOT NULL;
CREATE INDEX idx_message_events_user_message ON message_events(user_message_id) WHERE user_message_id IS NOT NULL;
CREATE INDEX idx_message_events_type ON message_events(event_type, event_timestamp DESC);
CREATE INDEX idx_message_events_timestamp ON message_events(event_timestamp DESC);

COMMENT ON TABLE message_events IS 'Event tracking for message analytics';
COMMENT ON COLUMN message_events.event_type IS 'Type of event that occurred';

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on user-facing tables
ALTER TABLE user_messages ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's message access
-- This function is SECURITY DEFINER to bypass RLS checks within it
CREATE OR REPLACE FUNCTION user_can_access_message(
  p_user_type TEXT,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Customers match by auth.uid()
  IF p_user_type = 'customer' THEN
    RETURN p_user_id = auth.uid();
  END IF;

  -- For partners, check if user_id matches a partner record
  IF p_user_type = 'partner' THEN
    RETURN EXISTS (
      SELECT 1 FROM partners
      WHERE id = p_user_id
      AND email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );
  END IF;

  -- For influencers, check if user_id matches an influencer record
  IF p_user_type = 'influencer' THEN
    RETURN EXISTS (
      SELECT 1 FROM influencers
      WHERE id = p_user_id
      AND email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );
  END IF;

  -- For admins, check user_profiles
  IF p_user_type = 'admin' THEN
    RETURN EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND user_type = 'admin'
    );
  END IF;

  RETURN false;
END;
$$;

-- Users can only view their own messages
CREATE POLICY "Users can view own messages" ON user_messages
  FOR SELECT
  USING (user_can_access_message(user_type, user_id));

-- Users can update their own messages (mark as read/archived)
CREATE POLICY "Users can update own messages" ON user_messages
  FOR UPDATE
  USING (user_can_access_message(user_type, user_id));

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to archive old message queue entries to delivery log
CREATE OR REPLACE FUNCTION archive_sent_messages()
RETURNS INTEGER AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  -- Move messages sent more than 7 days ago to delivery log
  WITH archived AS (
    INSERT INTO message_delivery_log (
      id, template_key, recipient_type, recipient_id, recipient_email,
      recipient_phone, channel, status, sent_at, failed_at,
      provider_message_id, error_message, metadata, created_at
    )
    SELECT
      id, template_key, recipient_type, recipient_id, recipient_email,
      recipient_phone, channel, status, sent_at, failed_at,
      provider_message_id, error_message, metadata, created_at
    FROM message_queue
    WHERE status IN ('sent', 'failed', 'cancelled')
      AND (sent_at < NOW() - INTERVAL '7 days' OR failed_at < NOW() - INTERVAL '7 days')
    RETURNING id
  ),
  deleted AS (
    DELETE FROM message_queue
    WHERE id IN (SELECT id FROM archived)
    RETURNING id
  )
  SELECT COUNT(*) INTO archived_count FROM deleted;

  RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION archive_sent_messages IS 'Archives processed messages older than 7 days to delivery log';

-- Function to delete old delivery log entries
CREATE OR REPLACE FUNCTION cleanup_old_delivery_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete delivery logs older than 90 days
  WITH deleted AS (
    DELETE FROM message_delivery_log
    WHERE archived_at < NOW() - INTERVAL '90 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_delivery_logs IS 'Deletes delivery logs older than 90 days (GDPR compliance)';

-- Function to get unread message count for a user
CREATE OR REPLACE FUNCTION get_unread_message_count(
  p_user_type TEXT,
  p_user_id UUID
)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM user_messages
    WHERE user_type = p_user_type
      AND user_id = p_user_id
      AND is_read = false
      AND is_archived = false
      AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_unread_message_count IS 'Returns unread message count for a user';

-- =====================================================
-- SEED INITIAL TEMPLATES
-- =====================================================
-- Common templates to get started
-- More can be added via admin UI

INSERT INTO message_templates (template_key, name, description, category, channels, user_types, email_subject_template, email_body_template, inbox_title_template, inbox_body_template, inbox_icon, can_be_disabled, default_enabled)
VALUES
-- Customer transactional templates
('order_confirmation', 'Order Confirmation', 'Sent when order is confirmed', 'transactional', ARRAY['email', 'inbox'], ARRAY['customer'],
  'Order Confirmation - {{order_number}}',
  '<h1>Thank you for your order!</h1><p>Hi {{customer_name}},</p><p>Your order {{order_number}} has been confirmed.</p>',
  'Order Confirmed',
  'Your order {{order_number}} has been confirmed and is being prepared.',
  'package',
  false, true),

('order_shipped', 'Order Shipped', 'Sent when order ships', 'transactional', ARRAY['email', 'sms', 'inbox'], ARRAY['customer'],
  'Your order has shipped - {{order_number}}',
  '<h1>Your order is on its way!</h1><p>Hi {{customer_name}},</p><p>Order {{order_number}} has shipped. Track it here: {{tracking_url}}</p>',
  'Order Shipped',
  'Your order {{order_number}} has shipped! Track your delivery.',
  'truck',
  false, true),

-- Partner transactional templates
('partner_approval', 'Partner Application Approved', 'Sent when partner is approved', 'transactional', ARRAY['email', 'inbox'], ARRAY['partner'],
  'Welcome to Pawtraits Partner Program!',
  '<h1>Congratulations!</h1><p>Hi {{partner_name}},</p><p>Your partner application has been approved. Welcome aboard!</p>',
  'Application Approved',
  'Congratulations! Your partner application has been approved.',
  'check-circle',
  false, true),

('referral_purchase', 'Referral Made Purchase', 'Sent when a referral makes a purchase', 'operational', ARRAY['email', 'sms', 'inbox'], ARRAY['partner'],
  'Great news! {{customer_name}} made a purchase',
  '<h1>You earned a commission!</h1><p>{{customer_name}} just made a purchase using your referral. You earned {{currency}}{{commission_amount}}!</p>',
  'Commission Earned',
  '{{customer_name}} made a purchase! You earned {{currency}}{{commission_amount}}.',
  'dollar-sign',
  true, true)

ON CONFLICT (template_key) DO NOTHING;

-- =====================================================
-- GRANTS
-- =====================================================
-- Grant necessary permissions for authenticated users

GRANT SELECT ON message_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_messages TO authenticated;
GRANT SELECT ON message_delivery_log TO authenticated;

-- =====================================================
-- END OF SCHEMA
-- =====================================================
