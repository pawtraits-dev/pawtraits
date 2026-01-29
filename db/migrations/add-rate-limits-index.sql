-- Add performance index for rate_limits table
-- This index improves lookup performance for IP-based rate limiting queries

CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
ON rate_limits(client_key, endpoint_pattern, window_start DESC);

-- Add comment explaining the index
COMMENT ON INDEX idx_rate_limits_lookup IS 'Performance index for rate limiting queries by IP and endpoint';
