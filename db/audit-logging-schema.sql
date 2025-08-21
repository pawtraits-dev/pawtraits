-- Audit Logging Database Schema
-- SECURITY CRITICAL: Comprehensive audit trail for compliance and security monitoring

-- Main audit events table
CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN (
    'AUTHENTICATION',
    'AUTHORIZATION', 
    'DATA_ACCESS',
    'DATA_MODIFICATION',
    'DATA_DELETION',
    'SYSTEM_ACCESS',
    'SECURITY_INCIDENT',
    'PRIVACY_EVENT',
    'COMPLIANCE_EVENT',
    'ADMIN_ACTION',
    'API_ACCESS',
    'FILE_OPERATION',
    'PAYMENT_EVENT'
  )),
  severity text NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,
  ip_address inet,
  user_agent text,
  resource text,
  action text NOT NULL,
  resource_id text,
  event_details jsonb DEFAULT '{}',
  outcome text NOT NULL CHECK (outcome IN ('SUCCESS', 'FAILURE', 'PARTIAL', 'BLOCKED')),
  risk_score integer CHECK (risk_score >= 0 AND risk_score <= 100),
  compliance_flags text[] DEFAULT '{}',
  timestamp timestamptz NOT NULL,
  created_at timestamptz DEFAULT NOW(),
  
  -- Constraints
  CHECK (char_length(action) >= 1 AND char_length(action) <= 255),
  CHECK (event_details IS NOT NULL)
);

-- Audit rules configuration table
CREATE TABLE IF NOT EXISTS audit_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name text NOT NULL UNIQUE,
  event_type text NOT NULL,
  conditions jsonb NOT NULL DEFAULT '[]',
  actions jsonb NOT NULL DEFAULT '[]',
  is_active boolean DEFAULT true,
  priority integer DEFAULT 0,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Constraints
  CHECK (char_length(rule_name) >= 1 AND char_length(rule_name) <= 255),
  CHECK (priority >= 0 AND priority <= 1000)
);

-- API keys table for API key authentication
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_name text NOT NULL,
  key_hash text NOT NULL UNIQUE, -- Hashed version of the API key
  permissions text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  expires_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT NOW(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Constraints
  CHECK (char_length(key_name) >= 1 AND char_length(key_name) <= 255),
  CHECK (char_length(key_hash) >= 10),
  CHECK (expires_at IS NULL OR expires_at > created_at)
);

-- Rate limiting storage table (for persistent rate limiting)
CREATE TABLE IF NOT EXISTS rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_key text NOT NULL,
  endpoint_pattern text NOT NULL,
  request_count integer DEFAULT 0,
  window_start timestamptz NOT NULL,
  blocked_until timestamptz,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  
  UNIQUE(client_key, endpoint_pattern)
);

-- Data protection events table (GDPR/CCPA compliance)
CREATE TABLE IF NOT EXISTS data_protection_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'CONSENT_GIVEN',
    'CONSENT_WITHDRAWN',
    'DATA_EXPORT_REQUEST',
    'DATA_DELETION_REQUEST',
    'DATA_ANONYMIZATION',
    'DATA_BREACH_NOTIFICATION',
    'RIGHT_TO_RECTIFICATION',
    'RIGHT_TO_PORTABILITY'
  )),
  data_categories text[] NOT NULL, -- Types of data affected
  legal_basis text,
  processed_at timestamptz DEFAULT NOW(),
  expires_at timestamptz, -- For time-limited processing
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT NOW(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_events_timestamp ON audit_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_user_id ON audit_events(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_type ON audit_events(event_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_severity ON audit_events(severity, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_outcome ON audit_events(outcome, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_resource ON audit_events(resource, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_ip ON audit_events(ip_address, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_risk_score ON audit_events(risk_score DESC) WHERE risk_score >= 70;
CREATE INDEX IF NOT EXISTS idx_audit_events_compliance ON audit_events USING GIN(compliance_flags) WHERE array_length(compliance_flags, 1) > 0;

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(user_id, is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_rate_limits_client ON rate_limits(client_key, endpoint_pattern);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);

CREATE INDEX IF NOT EXISTS idx_data_protection_user_id ON data_protection_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_protection_type ON data_protection_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_protection_status ON data_protection_events(status, created_at DESC);

-- Row Level Security (RLS) Policies
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_protection_events ENABLE ROW LEVEL SECURITY;

-- Audit events policies (read-only for users, full access for service role and admins)
DROP POLICY IF EXISTS "Users can read their own audit events" ON audit_events;
CREATE POLICY "Users can read their own audit events"
  ON audit_events
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access to audit events" ON audit_events;
CREATE POLICY "Service role full access to audit events"
  ON audit_events
  FOR ALL
  TO service_role
  USING (true);

DROP POLICY IF EXISTS "Admins can read all audit events" ON audit_events;
CREATE POLICY "Admins can read all audit events"
  ON audit_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND user_type = 'admin'
    )
  );

-- Audit rules policies (admin only)
DROP POLICY IF EXISTS "Admin full access to audit rules" ON audit_rules;
CREATE POLICY "Admin full access to audit rules"
  ON audit_rules
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND user_type = 'admin'
    )
  );

DROP POLICY IF EXISTS "Service role full access to audit rules" ON audit_rules;
CREATE POLICY "Service role full access to audit rules"
  ON audit_rules
  FOR ALL
  TO service_role
  USING (true);

-- API keys policies (users can manage their own keys)
DROP POLICY IF EXISTS "Users can manage their own API keys" ON api_keys;
CREATE POLICY "Users can manage their own API keys"
  ON api_keys
  FOR ALL
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access to API keys" ON api_keys;
CREATE POLICY "Service role full access to API keys"
  ON api_keys
  FOR ALL
  TO service_role
  USING (true);

-- Data protection events policies
DROP POLICY IF EXISTS "Users can access their own data protection events" ON data_protection_events;
CREATE POLICY "Users can access their own data protection events"
  ON data_protection_events
  FOR ALL
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access to data protection events" ON data_protection_events;
CREATE POLICY "Service role full access to data protection events"
  ON data_protection_events
  FOR ALL
  TO service_role
  USING (true);

-- Functions for audit operations

-- Function to get audit summary for user
CREATE OR REPLACE FUNCTION get_audit_summary(
  user_uuid uuid DEFAULT NULL,
  days_back integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
  result jsonb;
BEGIN
  -- Use provided user_uuid or current user
  target_user_id := COALESCE(user_uuid, auth.uid());
  
  -- Check if current user can access this data
  IF target_user_id != auth.uid() THEN
    -- Only admins can access other users' audit data
    IF NOT EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND user_type = 'admin'
    ) THEN
      RAISE EXCEPTION 'Access denied: Cannot view other users audit data';
    END IF;
  END IF;
  
  SELECT jsonb_build_object(
    'total_events', COUNT(*),
    'events_by_type', jsonb_object_agg(
      event_type, 
      event_count
    ),
    'events_by_severity', jsonb_object_agg(
      severity,
      severity_count
    ),
    'high_risk_events', COUNT(*) FILTER (WHERE risk_score >= 80),
    'recent_failures', COUNT(*) FILTER (WHERE outcome = 'FAILURE' AND timestamp >= NOW() - INTERVAL '24 hours'),
    'date_range', jsonb_build_object(
      'from', MIN(timestamp),
      'to', MAX(timestamp)
    )
  )
  INTO result
  FROM (
    SELECT 
      event_type,
      severity,
      risk_score,
      outcome,
      timestamp,
      COUNT(*) OVER (PARTITION BY event_type) as event_count,
      COUNT(*) OVER (PARTITION BY severity) as severity_count
    FROM audit_events
    WHERE user_id = target_user_id
    AND timestamp >= NOW() - (days_back || ' days')::INTERVAL
  ) audit_data;
  
  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

-- Function to clean up old audit events
CREATE OR REPLACE FUNCTION cleanup_old_audit_events(retention_days integer DEFAULT 2555)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM audit_events
  WHERE timestamp < (NOW() - (retention_days || ' days')::INTERVAL);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Log the cleanup operation
  INSERT INTO audit_events (
    event_type,
    severity,
    action,
    event_details,
    outcome,
    timestamp
  ) VALUES (
    'SYSTEM_ACCESS',
    'LOW',
    'AUDIT_CLEANUP',
    jsonb_build_object(
      'deleted_count', deleted_count,
      'retention_days', retention_days
    ),
    'SUCCESS',
    NOW()
  );
  
  RETURN deleted_count;
END;
$$;

-- Function to generate compliance report
CREATE OR REPLACE FUNCTION generate_compliance_report(
  start_date timestamptz,
  end_date timestamptz,
  compliance_type text DEFAULT 'GDPR'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Only admins can generate compliance reports
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() 
    AND user_type = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required for compliance reports';
  END IF;
  
  SELECT jsonb_build_object(
    'report_type', compliance_type,
    'date_range', jsonb_build_object(
      'start', start_date,
      'end', end_date
    ),
    'total_events', COUNT(*),
    'events_by_type', jsonb_object_agg(event_type, type_count),
    'high_risk_events', jsonb_agg(
      jsonb_build_object(
        'id', id,
        'timestamp', timestamp,
        'event_type', event_type,
        'risk_score', risk_score,
        'details', event_details
      )
    ) FILTER (WHERE risk_score >= 80),
    'privacy_events', COUNT(*) FILTER (WHERE event_type = 'PRIVACY_EVENT'),
    'data_breaches', COUNT(*) FILTER (WHERE event_type = 'SECURITY_INCIDENT' AND severity = 'CRITICAL')
  )
  INTO result
  FROM (
    SELECT 
      id,
      event_type,
      timestamp,
      risk_score,
      event_details,
      severity,
      COUNT(*) OVER (PARTITION BY event_type) as type_count
    FROM audit_events
    WHERE timestamp BETWEEN start_date AND end_date
    AND compliance_type = ANY(compliance_flags)
  ) compliance_data;
  
  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

-- Function to check for suspicious patterns
CREATE OR REPLACE FUNCTION detect_suspicious_activity(
  lookback_hours integer DEFAULT 24
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Only admins and service role can run this function
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() 
    AND user_type = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  
  SELECT jsonb_build_object(
    'analysis_period_hours', lookback_hours,
    'suspicious_ips', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'ip_address', ip_address,
          'event_count', event_count,
          'failure_rate', failure_rate,
          'risk_score', avg_risk_score
        )
      )
      FROM (
        SELECT 
          ip_address,
          COUNT(*) as event_count,
          COUNT(*) FILTER (WHERE outcome = 'FAILURE')::float / COUNT(*)::float as failure_rate,
          AVG(risk_score) as avg_risk_score
        FROM audit_events
        WHERE timestamp >= NOW() - (lookback_hours || ' hours')::INTERVAL
        AND ip_address IS NOT NULL
        GROUP BY ip_address
        HAVING COUNT(*) > 50 OR 
               COUNT(*) FILTER (WHERE outcome = 'FAILURE') > 10 OR
               AVG(risk_score) > 60
        ORDER BY event_count DESC
        LIMIT 20
      ) suspicious_ip_data
    ),
    'failed_auth_attempts', (
      SELECT COUNT(*)
      FROM audit_events
      WHERE timestamp >= NOW() - (lookback_hours || ' hours')::INTERVAL
      AND event_type = 'AUTHENTICATION'
      AND outcome = 'FAILURE'
    ),
    'high_risk_events', (
      SELECT COUNT(*)
      FROM audit_events
      WHERE timestamp >= NOW() - (lookback_hours || ' hours')::INTERVAL
      AND risk_score >= 80
    )
  )
  INTO result;
  
  RETURN result;
END;
$$;

-- Grant appropriate permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON audit_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON api_keys TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON data_protection_events TO authenticated;

GRANT ALL ON audit_events TO service_role;
GRANT ALL ON audit_rules TO service_role;
GRANT ALL ON api_keys TO service_role;
GRANT ALL ON rate_limits TO service_role;
GRANT ALL ON data_protection_events TO service_role;

GRANT EXECUTE ON FUNCTION get_audit_summary(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_audit_events(integer) TO service_role;
GRANT EXECUTE ON FUNCTION generate_compliance_report(timestamptz, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION detect_suspicious_activity(integer) TO authenticated;

-- Comments for documentation
COMMENT ON TABLE audit_events IS 'Comprehensive audit trail for all security-relevant events';
COMMENT ON TABLE audit_rules IS 'Configuration for automated audit rule processing';
COMMENT ON TABLE api_keys IS 'API key management for programmatic access';
COMMENT ON TABLE rate_limits IS 'Persistent storage for rate limiting data';
COMMENT ON TABLE data_protection_events IS 'GDPR/CCPA compliance tracking for data protection events';

COMMENT ON COLUMN audit_events.event_type IS 'Category of the audited event';
COMMENT ON COLUMN audit_events.risk_score IS 'Calculated risk score (0-100) based on event characteristics';
COMMENT ON COLUMN audit_events.compliance_flags IS 'Compliance frameworks this event relates to (GDPR, CCPA, SOX, etc.)';
COMMENT ON COLUMN api_keys.key_hash IS 'Hashed version of API key for secure lookup';

COMMENT ON FUNCTION get_audit_summary(uuid, integer) IS 'Generate audit summary for user or admin view';
COMMENT ON FUNCTION cleanup_old_audit_events(integer) IS 'Clean up audit events older than retention period';
COMMENT ON FUNCTION generate_compliance_report(timestamptz, timestamptz, text) IS 'Generate compliance reports for regulatory requirements';
COMMENT ON FUNCTION detect_suspicious_activity(integer) IS 'Analyze recent audit events for suspicious patterns';