-- =====================================================
-- USER NOTIFICATION PREFERENCES
-- =====================================================
-- Allows users to opt-out of non-transactional notifications
-- Respects user preferences across all messaging channels
-- =====================================================

CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,  -- References user_profiles.id
  user_type TEXT NOT NULL CHECK (user_type IN ('customer', 'partner', 'influencer', 'admin')),

  -- Global opt-outs
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT true,
  inbox_enabled BOOLEAN DEFAULT true,

  -- Category-level preferences
  operational_emails_enabled BOOLEAN DEFAULT true,  -- Non-critical updates
  marketing_emails_enabled BOOLEAN DEFAULT true,   -- Promotional content

  -- Specific template overrides (JSONB for flexibility)
  -- Format: { "template_key": false } to disable specific templates
  disabled_templates TEXT[] DEFAULT '{}',

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one preference record per user
  UNIQUE(user_id)
);

-- Indexes
CREATE INDEX idx_user_notification_prefs_user ON user_notification_preferences(user_id);
CREATE INDEX idx_user_notification_prefs_type ON user_notification_preferences(user_type);

-- Comments
COMMENT ON TABLE user_notification_preferences IS 'User notification preferences and opt-out settings';
COMMENT ON COLUMN user_notification_preferences.email_enabled IS 'Master email opt-in (transactional emails always sent)';
COMMENT ON COLUMN user_notification_preferences.operational_emails_enabled IS 'Opt-out of operational emails (order updates, commissions)';
COMMENT ON COLUMN user_notification_preferences.marketing_emails_enabled IS 'Opt-out of marketing emails';
COMMENT ON COLUMN user_notification_preferences.disabled_templates IS 'Array of template keys user has disabled';

-- =====================================================
-- RLS POLICIES
-- =====================================================
-- Users can only view/update their own preferences

ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own preferences
CREATE POLICY user_notification_prefs_select_own ON user_notification_preferences
  FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM user_profiles WHERE auth.uid() = user_profiles.auth_user_id
    )
  );

-- Users can update their own preferences
CREATE POLICY user_notification_prefs_update_own ON user_notification_preferences
  FOR UPDATE
  USING (
    user_id IN (
      SELECT id FROM user_profiles WHERE auth.uid() = user_profiles.auth_user_id
    )
  );

-- Users can insert their own preferences
CREATE POLICY user_notification_prefs_insert_own ON user_notification_preferences
  FOR INSERT
  WITH CHECK (
    user_id IN (
      SELECT id FROM user_profiles WHERE auth.uid() = user_profiles.auth_user_id
    )
  );

-- Admins can view all preferences
CREATE POLICY user_notification_prefs_admin_all ON user_notification_preferences
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE auth.uid() = user_profiles.auth_user_id
      AND user_profiles.user_type = 'admin'
    )
  );

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Get or create user notification preferences
CREATE OR REPLACE FUNCTION get_user_notification_preferences(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_type TEXT,
  email_enabled BOOLEAN,
  sms_enabled BOOLEAN,
  inbox_enabled BOOLEAN,
  operational_emails_enabled BOOLEAN,
  marketing_emails_enabled BOOLEAN,
  disabled_templates TEXT[],
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Try to get existing preferences
  RETURN QUERY
  SELECT
    unp.id,
    unp.user_id,
    unp.user_type,
    unp.email_enabled,
    unp.sms_enabled,
    unp.inbox_enabled,
    unp.operational_emails_enabled,
    unp.marketing_emails_enabled,
    unp.disabled_templates,
    unp.created_at,
    unp.updated_at
  FROM user_notification_preferences unp
  WHERE unp.user_id = p_user_id;

  -- If no preferences exist, create default preferences
  IF NOT FOUND THEN
    INSERT INTO user_notification_preferences (user_id, user_type)
    SELECT p_user_id, up.user_type
    FROM user_profiles up
    WHERE up.id = p_user_id
    RETURNING
      user_notification_preferences.id,
      user_notification_preferences.user_id,
      user_notification_preferences.user_type,
      user_notification_preferences.email_enabled,
      user_notification_preferences.sms_enabled,
      user_notification_preferences.inbox_enabled,
      user_notification_preferences.operational_emails_enabled,
      user_notification_preferences.marketing_emails_enabled,
      user_notification_preferences.disabled_templates,
      user_notification_preferences.created_at,
      user_notification_preferences.updated_at
    INTO
      id,
      user_id,
      user_type,
      email_enabled,
      sms_enabled,
      inbox_enabled,
      operational_emails_enabled,
      marketing_emails_enabled,
      disabled_templates,
      created_at,
      updated_at;

    RETURN NEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_notification_preferences IS 'Get user notification preferences, creating defaults if none exist';

-- Check if user should receive a specific notification
CREATE OR REPLACE FUNCTION should_send_notification(
  p_user_id UUID,
  p_template_key TEXT,
  p_channel TEXT,
  p_category TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_prefs RECORD;
  v_can_disable BOOLEAN;
BEGIN
  -- Get user preferences
  SELECT * INTO v_prefs
  FROM user_notification_preferences
  WHERE user_id = p_user_id;

  -- If no preferences, send by default (create preferences on first opt-out)
  IF NOT FOUND THEN
    RETURN true;
  END IF;

  -- Check if template can be disabled
  SELECT can_be_disabled INTO v_can_disable
  FROM message_templates
  WHERE template_key = p_template_key;

  -- Transactional messages always sent (can't be disabled)
  IF p_category = 'transactional' OR NOT v_can_disable THEN
    RETURN true;
  END IF;

  -- Check channel-level opt-outs
  IF p_channel = 'email' AND NOT v_prefs.email_enabled THEN
    RETURN false;
  END IF;

  IF p_channel = 'sms' AND NOT v_prefs.sms_enabled THEN
    RETURN false;
  END IF;

  IF p_channel = 'inbox' AND NOT v_prefs.inbox_enabled THEN
    RETURN false;
  END IF;

  -- Check category-level opt-outs
  IF p_category = 'operational' AND NOT v_prefs.operational_emails_enabled THEN
    RETURN false;
  END IF;

  IF p_category = 'marketing' AND NOT v_prefs.marketing_emails_enabled THEN
    RETURN false;
  END IF;

  -- Check template-specific opt-outs
  IF p_template_key = ANY(v_prefs.disabled_templates) THEN
    RETURN false;
  END IF;

  -- Default: send notification
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION should_send_notification IS 'Check if user should receive a notification based on their preferences';

-- =====================================================
-- UPDATE TIMESTAMP TRIGGER
-- =====================================================

CREATE TRIGGER update_user_notification_prefs_updated_at
  BEFORE UPDATE ON user_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- INITIAL DATA
-- =====================================================

-- Create default preferences for existing users who don't have them yet
-- This is idempotent and can be run multiple times safely
DO $$
BEGIN
  INSERT INTO user_notification_preferences (user_id, user_type)
  SELECT
    up.id,
    up.user_type
  FROM user_profiles up
  LEFT JOIN user_notification_preferences unp ON up.id = unp.user_id
  WHERE unp.id IS NULL  -- Only create for users without preferences
  ON CONFLICT (user_id) DO NOTHING;

  RAISE NOTICE 'Created default notification preferences for existing users';
END $$;
