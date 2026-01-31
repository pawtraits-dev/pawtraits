// lib/public-rate-limiter.ts
/**
 * Database-backed rate limiter for public endpoints
 * Uses the rate_limits table for persistent, serverless-compatible rate limiting
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Use service role client to bypass RLS for rate limiting
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export interface PublicRateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number; // seconds until next allowed request
  resetAt?: Date;
}

/**
 * Database-backed rate limiter for public endpoints
 * Designed for serverless environments where in-memory storage doesn't persist
 *
 * Configurable via environment variables:
 * - PUBLIC_RATE_LIMIT_MAX_REQUESTS (default: 3)
 * - PUBLIC_RATE_LIMIT_WINDOW_MINUTES (default: 60)
 */
export class PublicRateLimiter {
  private maxRequests: number;
  private windowMinutes: number;

  constructor(maxRequests?: number, windowMinutes?: number) {
    // Read from environment variables with fallback defaults
    this.maxRequests = maxRequests ??
      parseInt(process.env.PUBLIC_RATE_LIMIT_MAX_REQUESTS || '3', 10);
    this.windowMinutes = windowMinutes ??
      parseInt(process.env.PUBLIC_RATE_LIMIT_WINDOW_MINUTES || '60', 10);
  }

  /**
   * Check if a request is allowed based on rate limit
   */
  async checkLimit(clientIp: string, endpoint: string): Promise<PublicRateLimitResult> {
    try {
      const windowStart = new Date(Date.now() - this.windowMinutes * 60 * 1000);

      // Find existing rate limit record for this IP and endpoint in current window
      const { data: existing, error: fetchError } = await supabaseAdmin
        .from('rate_limits')
        .select('*')
        .eq('client_key', clientIp)
        .eq('endpoint_pattern', endpoint)
        .gte('window_start', windowStart.toISOString())
        .order('window_start', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        console.error('Rate limit check error:', fetchError);
        // Fail open - allow request if database error
        return { allowed: true, remaining: this.maxRequests };
      }

      // No existing record in current window - allowed
      if (!existing) {
        return { allowed: true, remaining: this.maxRequests - 1 };
      }

      // Check if blocked
      if (existing.blocked_until && new Date(existing.blocked_until) > new Date()) {
        const retryAfter = Math.ceil(
          (new Date(existing.blocked_until).getTime() - Date.now()) / 1000
        );
        return {
          allowed: false,
          remaining: 0,
          retryAfter,
          resetAt: new Date(existing.blocked_until)
        };
      }

      // Check request count
      if (existing.request_count >= this.maxRequests) {
        // Block for remainder of window
        const windowEnd = new Date(
          new Date(existing.window_start).getTime() + this.windowMinutes * 60 * 1000
        );
        const retryAfter = Math.ceil((windowEnd.getTime() - Date.now()) / 1000);

        // Update blocked_until
        await supabaseAdmin
          .from('rate_limits')
          .update({ blocked_until: windowEnd.toISOString() })
          .eq('id', existing.id);

        return {
          allowed: false,
          remaining: 0,
          retryAfter,
          resetAt: windowEnd
        };
      }

      // Still within limit
      return {
        allowed: true,
        remaining: this.maxRequests - existing.request_count - 1
      };
    } catch (error) {
      console.error('Rate limiter error:', error);
      // Fail open - allow request on error
      return { allowed: true, remaining: this.maxRequests };
    }
  }

  /**
   * Record a successful request
   */
  async recordRequest(clientIp: string, endpoint: string): Promise<void> {
    try {
      const windowStart = new Date(Date.now() - this.windowMinutes * 60 * 1000);

      // Find existing record in current window
      const { data: existing, error: fetchError } = await supabaseAdmin
        .from('rate_limits')
        .select('*')
        .eq('client_key', clientIp)
        .eq('endpoint_pattern', endpoint)
        .gte('window_start', windowStart.toISOString())
        .order('window_start', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching rate limit record:', fetchError);
        return;
      }

      if (existing) {
        // Increment existing record
        const { error: updateError } = await supabaseAdmin
          .from('rate_limits')
          .update({
            request_count: existing.request_count + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (updateError) {
          console.error('Error updating rate limit:', updateError);
        }
      } else {
        // Create new record for this window
        const { error: insertError } = await supabaseAdmin
          .from('rate_limits')
          .insert({
            client_key: clientIp,
            endpoint_pattern: endpoint,
            request_count: 1,
            window_start: new Date().toISOString()
          });

        if (insertError) {
          console.error('Error creating rate limit record:', insertError);
        }
      }
    } catch (error) {
      console.error('Error recording request:', error);
    }
  }

  /**
   * Get remaining requests for an IP/endpoint combination
   */
  async getRemainingRequests(clientIp: string, endpoint: string): Promise<number> {
    try {
      const windowStart = new Date(Date.now() - this.windowMinutes * 60 * 1000);

      const { data: existing, error } = await supabaseAdmin
        .from('rate_limits')
        .select('request_count')
        .eq('client_key', clientIp)
        .eq('endpoint_pattern', endpoint)
        .gte('window_start', windowStart.toISOString())
        .order('window_start', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !existing) {
        return this.maxRequests;
      }

      return Math.max(0, this.maxRequests - existing.request_count);
    } catch (error) {
      console.error('Error getting remaining requests:', error);
      return this.maxRequests;
    }
  }

  /**
   * Clean up old rate limit records (optional maintenance function)
   * Should be called periodically or via cron job
   */
  async cleanup(): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

      const { error } = await supabaseAdmin
        .from('rate_limits')
        .delete()
        .lt('window_start', cutoff.toISOString());

      if (error) {
        console.error('Error cleaning up rate limits:', error);
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }
}

/**
 * Helper function to extract client IP from request headers
 * Works with Vercel's x-forwarded-for header
 */
export function getClientIp(headers: Headers): string {
  // Vercel provides x-forwarded-for header
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, get the first one (client IP)
    return forwardedFor.split(',')[0].trim();
  }

  // Fallback to other headers
  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Last resort - use a placeholder (should not happen on Vercel)
  return 'unknown';
}
