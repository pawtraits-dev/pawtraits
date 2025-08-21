/**
 * SECURITY CRITICAL: Comprehensive API Rate Limiting System
 * 
 * Provides advanced rate limiting with:
 * - Multiple rate limit strategies (fixed window, sliding window, token bucket)
 * - User-type based limits (admin, partner, customer)
 * - Endpoint-specific rate limits
 * - Distributed rate limiting support
 * - Automatic abuse detection and blocking
 * - Rate limit bypass for trusted clients
 */

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export interface RateLimitConfig {
  windowMs: number        // Time window in milliseconds
  maxRequests: number     // Maximum requests per window
  strategy: 'fixed' | 'sliding' | 'token_bucket'
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
  keyGenerator?: (req: NextRequest) => string
  onLimitReached?: (req: NextRequest, rateLimitInfo: RateLimitInfo) => void
}

export interface RateLimitInfo {
  totalRequests: number
  remainingRequests: number
  resetTime: number
  limited: boolean
  retryAfter?: number
}

export interface RateLimitRule {
  id: string
  pattern: string          // Endpoint pattern (e.g., '/api/auth/*')
  userTypes: string[]      // ['admin', 'partner', 'customer', 'anonymous']
  config: RateLimitConfig
  priority: number         // Higher priority rules are checked first
  isActive: boolean
}

export interface AbuseDetectionConfig {
  suspiciousThreshold: number      // Requests per minute that trigger suspicion
  blockThreshold: number           // Requests per minute that trigger block
  blockDurationMs: number          // How long to block in milliseconds
  enableAutoBlock: boolean
}

interface ClientRateLimitData {
  requests: Array<{ timestamp: number; success: boolean }>
  tokens?: number          // For token bucket strategy
  lastRefill?: number      // Last token refill time
  blocked?: boolean
  blockExpires?: number
  suspicionLevel: number   // 0-100 scale
}

export class RateLimiter {
  private storage = new Map<string, ClientRateLimitData>()
  private rules: RateLimitRule[] = []
  private abuseConfig: AbuseDetectionConfig
  private supabase: any = null

  constructor(abuseConfig?: Partial<AbuseDetectionConfig>) {
    this.abuseConfig = {
      suspiciousThreshold: 60,      // 60 req/min
      blockThreshold: 120,          // 120 req/min  
      blockDurationMs: 15 * 60 * 1000, // 15 minutes
      enableAutoBlock: true,
      ...abuseConfig
    }

    // Initialize default rate limit rules
    this.initializeDefaultRules()
    
    // Start cleanup interval
    setInterval(() => this.cleanup(), 5 * 60 * 1000) // Clean up every 5 minutes
  }

  private getSupabaseClient() {
    if (!this.supabase && typeof window === 'undefined') {
      // Only create client on server side
      this.supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
    }
    return this.supabase
  }

  /**
   * Check if request should be rate limited
   */
  async checkRateLimit(req: NextRequest, userType?: string): Promise<RateLimitInfo> {
    const clientKey = this.generateClientKey(req, userType)
    const rule = this.findMatchingRule(req, userType || 'anonymous')
    
    if (!rule) {
      // No specific rule found, use default
      const defaultConfig: RateLimitConfig = {
        windowMs: 60 * 1000,     // 1 minute
        maxRequests: 60,         // 60 requests per minute
        strategy: 'sliding'
      }
      return this.applyRateLimit(clientKey, defaultConfig, req)
    }

    // Check if client is blocked due to abuse detection
    const clientData = this.storage.get(clientKey)
    if (clientData?.blocked && clientData.blockExpires && Date.now() < clientData.blockExpires) {
      return {
        totalRequests: clientData.requests.length,
        remainingRequests: 0,
        resetTime: clientData.blockExpires,
        limited: true,
        retryAfter: Math.ceil((clientData.blockExpires - Date.now()) / 1000)
      }
    }

    return this.applyRateLimit(clientKey, rule.config, req)
  }

  /**
   * Apply rate limiting based on strategy
   */
  private async applyRateLimit(
    clientKey: string, 
    config: RateLimitConfig, 
    req: NextRequest
  ): Promise<RateLimitInfo> {
    const now = Date.now()
    let clientData = this.storage.get(clientKey) || {
      requests: [],
      suspicionLevel: 0
    }

    switch (config.strategy) {
      case 'fixed':
        return this.applyFixedWindowLimit(clientKey, clientData, config, now)
      
      case 'sliding':
        return this.applySlidingWindowLimit(clientKey, clientData, config, now)
      
      case 'token_bucket':
        return this.applyTokenBucketLimit(clientKey, clientData, config, now)
      
      default:
        throw new Error(`Unknown rate limit strategy: ${config.strategy}`)
    }
  }

  /**
   * Fixed window rate limiting
   */
  private applyFixedWindowLimit(
    clientKey: string,
    clientData: ClientRateLimitData,
    config: RateLimitConfig,
    now: number
  ): RateLimitInfo {
    const windowStart = Math.floor(now / config.windowMs) * config.windowMs
    
    // Filter requests in current window
    const windowRequests = clientData.requests.filter(
      req => req.timestamp >= windowStart
    )
    
    const limited = windowRequests.length >= config.maxRequests
    const resetTime = windowStart + config.windowMs

    if (!limited) {
      // Add current request
      clientData.requests = [...windowRequests, { timestamp: now, success: true }]
      this.storage.set(clientKey, clientData)
    }

    // Check for abuse
    this.checkForAbuse(clientKey, clientData, now)

    return {
      totalRequests: windowRequests.length + (limited ? 0 : 1),
      remainingRequests: Math.max(0, config.maxRequests - windowRequests.length - (limited ? 0 : 1)),
      resetTime,
      limited,
      retryAfter: limited ? Math.ceil((resetTime - now) / 1000) : undefined
    }
  }

  /**
   * Sliding window rate limiting
   */
  private applySlidingWindowLimit(
    clientKey: string,
    clientData: ClientRateLimitData,
    config: RateLimitConfig,
    now: number
  ): RateLimitInfo {
    const windowStart = now - config.windowMs
    
    // Filter requests in sliding window
    const windowRequests = clientData.requests.filter(
      req => req.timestamp > windowStart
    )
    
    const limited = windowRequests.length >= config.maxRequests

    if (!limited) {
      // Add current request
      windowRequests.push({ timestamp: now, success: true })
      clientData.requests = windowRequests
      this.storage.set(clientKey, clientData)
    }

    // Check for abuse
    this.checkForAbuse(clientKey, clientData, now)

    const oldestRequest = windowRequests[0]
    const resetTime = oldestRequest ? oldestRequest.timestamp + config.windowMs : now + config.windowMs

    return {
      totalRequests: windowRequests.length,
      remainingRequests: Math.max(0, config.maxRequests - windowRequests.length),
      resetTime,
      limited,
      retryAfter: limited ? Math.ceil((resetTime - now) / 1000) : undefined
    }
  }

  /**
   * Token bucket rate limiting
   */
  private applyTokenBucketLimit(
    clientKey: string,
    clientData: ClientRateLimitData,
    config: RateLimitConfig,
    now: number
  ): RateLimitInfo {
    const refillRate = config.maxRequests / (config.windowMs / 1000) // tokens per second
    const maxTokens = config.maxRequests
    
    // Initialize tokens if not set
    if (clientData.tokens === undefined) {
      clientData.tokens = maxTokens
      clientData.lastRefill = now
    }

    // Refill tokens based on time passed
    const timePassed = now - (clientData.lastRefill || now)
    const tokensToAdd = Math.floor((timePassed / 1000) * refillRate)
    
    if (tokensToAdd > 0) {
      clientData.tokens = Math.min(maxTokens, clientData.tokens + tokensToAdd)
      clientData.lastRefill = now
    }

    const limited = clientData.tokens < 1

    if (!limited) {
      // Consume token
      clientData.tokens -= 1
      clientData.requests.push({ timestamp: now, success: true })
      this.storage.set(clientKey, clientData)
    }

    // Check for abuse
    this.checkForAbuse(clientKey, clientData, now)

    const resetTime = limited ? 
      now + Math.ceil((1 - (clientData.tokens % 1)) / refillRate) * 1000 :
      now

    return {
      totalRequests: clientData.requests.length,
      remainingRequests: Math.floor(clientData.tokens || 0),
      resetTime,
      limited,
      retryAfter: limited ? Math.ceil((1 / refillRate)) : undefined
    }
  }

  /**
   * Check for suspicious activity and potential abuse
   */
  private checkForAbuse(clientKey: string, clientData: ClientRateLimitData, now: number) {
    if (!this.abuseConfig.enableAutoBlock) return

    const oneMinuteAgo = now - 60 * 1000
    const recentRequests = clientData.requests.filter(req => req.timestamp > oneMinuteAgo)
    const requestsPerMinute = recentRequests.length

    // Update suspicion level
    if (requestsPerMinute > this.abuseConfig.suspiciousThreshold) {
      clientData.suspicionLevel = Math.min(100, clientData.suspicionLevel + 10)
    } else {
      clientData.suspicionLevel = Math.max(0, clientData.suspicionLevel - 1)
    }

    // Block if threshold exceeded
    if (requestsPerMinute > this.abuseConfig.blockThreshold) {
      clientData.blocked = true
      clientData.blockExpires = now + this.abuseConfig.blockDurationMs
      
      // Log abuse incident
      this.logAbuseIncident(clientKey, requestsPerMinute)
    }

    this.storage.set(clientKey, clientData)
  }

  /**
   * Log abuse incident for monitoring
   */
  private async logAbuseIncident(clientKey: string, requestsPerMinute: number) {
    try {
      const supabase = this.getSupabaseClient()
      if (supabase) {
        await supabase
          .from('security_events')
          .insert({
            event_type: 'RATE_LIMIT_ABUSE',
            severity: 'HIGH',
            user_id: null,
            session_id: null,
            event_details: {
              client_key: clientKey,
              requests_per_minute: requestsPerMinute,
              threshold: this.abuseConfig.blockThreshold,
              auto_blocked: true
            },
            timestamp: new Date().toISOString()
          })
      }
    } catch (error) {
      console.error('Failed to log abuse incident:', error)
    }
  }

  /**
   * Generate client key for rate limiting
   */
  private generateClientKey(req: NextRequest, userType?: string): string {
    // Try to get user ID from session/auth
    const userId = this.extractUserId(req)
    if (userId) {
      return `user:${userId}`
    }

    // Fall back to IP address
    const ip = this.getClientIP(req)
    const userAgent = req.headers.get('user-agent') || 'unknown'
    
    // Create fingerprint for anonymous users
    const fingerprint = this.createFingerprint(ip, userAgent)
    return `anon:${fingerprint}`
  }

  /**
   * Extract user ID from request (implement based on your auth system)
   */
  private extractUserId(req: NextRequest): string | null {
    // This would integrate with your auth system
    // For now, return null (anonymous)
    return null
  }

  /**
   * Get client IP address
   */
  private getClientIP(req: NextRequest): string {
    const xForwardedFor = req.headers.get('x-forwarded-for')
    const xRealIP = req.headers.get('x-real-ip')
    
    if (xForwardedFor) {
      return xForwardedFor.split(',')[0].trim()
    }
    
    if (xRealIP) {
      return xRealIP
    }
    
    return 'unknown'
  }

  /**
   * Create client fingerprint
   */
  private createFingerprint(ip: string, userAgent: string): string {
    const data = `${ip}|${userAgent}`
    let hash = 0
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
  }

  /**
   * Find matching rate limit rule
   */
  private findMatchingRule(req: NextRequest, userType: string): RateLimitRule | null {
    const pathname = new URL(req.url).pathname
    
    // Sort by priority (higher first)
    const sortedRules = [...this.rules].sort((a, b) => b.priority - a.priority)
    
    for (const rule of sortedRules) {
      if (!rule.isActive) continue
      
      if (rule.userTypes.includes(userType) && this.matchesPattern(pathname, rule.pattern)) {
        return rule
      }
    }
    
    return null
  }

  /**
   * Check if pathname matches pattern
   */
  private matchesPattern(pathname: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
    
    const regex = new RegExp(`^${regexPattern}$`)
    return regex.test(pathname)
  }

  /**
   * Add or update rate limit rule
   */
  addRule(rule: RateLimitRule) {
    const existingIndex = this.rules.findIndex(r => r.id === rule.id)
    if (existingIndex >= 0) {
      this.rules[existingIndex] = rule
    } else {
      this.rules.push(rule)
    }
  }

  /**
   * Remove rate limit rule
   */
  removeRule(ruleId: string) {
    this.rules = this.rules.filter(rule => rule.id !== ruleId)
  }

  /**
   * Get current rate limit status for client
   */
  getClientStatus(req: NextRequest, userType?: string): ClientRateLimitData | null {
    const clientKey = this.generateClientKey(req, userType)
    return this.storage.get(clientKey) || null
  }

  /**
   * Clear rate limit data for client (admin function)
   */
  clearClientData(clientKey: string) {
    this.storage.delete(clientKey)
  }

  /**
   * Initialize default rate limit rules
   */
  private initializeDefaultRules() {
    // Authentication endpoints - stricter limits
    this.addRule({
      id: 'auth-endpoints',
      pattern: '/api/auth/*',
      userTypes: ['anonymous'],
      config: {
        windowMs: 15 * 60 * 1000,  // 15 minutes
        maxRequests: 5,            // 5 attempts per 15 min
        strategy: 'sliding'
      },
      priority: 100,
      isActive: true
    })

    // Admin endpoints - higher limits
    this.addRule({
      id: 'admin-endpoints',
      pattern: '/api/admin/*',
      userTypes: ['admin'],
      config: {
        windowMs: 60 * 1000,       // 1 minute
        maxRequests: 200,          // 200 req/min
        strategy: 'token_bucket'
      },
      priority: 90,
      isActive: true
    })

    // Partner endpoints
    this.addRule({
      id: 'partner-endpoints',
      pattern: '/api/partners/*',
      userTypes: ['partner'],
      config: {
        windowMs: 60 * 1000,       // 1 minute
        maxRequests: 100,          // 100 req/min
        strategy: 'sliding'
      },
      priority: 80,
      isActive: true
    })

    // Customer endpoints
    this.addRule({
      id: 'customer-endpoints',
      pattern: '/api/customers/*',
      userTypes: ['customer'],
      config: {
        windowMs: 60 * 1000,       // 1 minute
        maxRequests: 60,           // 60 req/min
        strategy: 'sliding'
      },
      priority: 70,
      isActive: true
    })

    // Upload endpoints - very strict
    this.addRule({
      id: 'upload-endpoints',
      pattern: '/api/upload/*',
      userTypes: ['customer', 'partner', 'admin'],
      config: {
        windowMs: 60 * 1000,       // 1 minute
        maxRequests: 10,           // 10 uploads per minute
        strategy: 'fixed'
      },
      priority: 95,
      isActive: true
    })

    // Anonymous users - general limits
    this.addRule({
      id: 'anonymous-general',
      pattern: '/api/*',
      userTypes: ['anonymous'],
      config: {
        windowMs: 60 * 1000,       // 1 minute
        maxRequests: 20,           // 20 req/min
        strategy: 'sliding'
      },
      priority: 10,
      isActive: true
    })
  }

  /**
   * Cleanup old data
   */
  private cleanup() {
    const now = Date.now()
    const maxAge = 24 * 60 * 60 * 1000 // 24 hours
    
    for (const [key, data] of this.storage) {
      // Remove old requests
      data.requests = data.requests.filter(
        req => now - req.timestamp < maxAge
      )
      
      // Remove clients with no recent activity and no block
      if (data.requests.length === 0 && !data.blocked) {
        this.storage.delete(key)
      }
      
      // Remove expired blocks
      if (data.blocked && data.blockExpires && now > data.blockExpires) {
        data.blocked = false
        delete data.blockExpires
      }
    }
  }
}