import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { RateLimiter } from './lib/rate-limiter'
import { createDLPMiddleware } from './lib/dlp-integration'

// Initialize global rate limiter
const rateLimiter = new RateLimiter({
  suspiciousThreshold: 60,
  blockThreshold: 120,
  blockDurationMs: 5 * 60 * 1000, // 5 minutes
  enableAutoBlock: true
})

// Initialize DLP middleware - DISABLED to prevent false positives
const dlpMiddleware = createDLPMiddleware({
  enableAPIProtection: false, // Temporarily disable DLP protection due to false positives
  enableFileUploadScanning: false,
  blockOnViolation: false,
  redactSensitiveData: false,
  exemptPaths: [
    '/api/health', 
    '/api/status', 
    '/api/monitoring',
    '/api/admin/',     // Exempt admin API routes
    '/api/partners/',  // Exempt partner API routes  
    '/api/customers/', // Exempt customer API routes
    '/api/security/',  // Exempt security API routes to prevent feedback loops
    '/admin/',         // Exempt all admin pages
    '/partners/',      // Exempt all partner pages  
    '/customer/',      // Exempt all customer pages
  ]
})

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  
  // Create a Supabase client configured to use cookies
  const supabase = createMiddlewareClient({ req, res })

  // Add comprehensive security headers
  addSecurityHeaders(res, req)

  // Apply DLP scanning for API routes and sensitive paths
  const dlpResult = await dlpMiddleware(req)
  if (dlpResult) {
    return dlpResult
  }

  // Apply rate limiting for API routes
  if (req.nextUrl.pathname.startsWith('/api/')) {
    const rateLimitResult = await applyRateLimit(req, supabase)
    if (rateLimitResult) {
      return rateLimitResult
    }
  }

  // Refresh session if expired - required for Server Components
  const { data: { session } } = await supabase.auth.getSession()

  return res
}

/**
 * Add comprehensive security headers to response
 */
function addSecurityHeaders(response: NextResponse, request: NextRequest): void {
  // Generate nonce for CSP
  const nonce = crypto.randomUUID()
  
  // Content Security Policy - More permissive for Next.js while maintaining security
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://maps.googleapis.com https://vercel.live`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://res.cloudinary.com https://lh3.googleusercontent.com https://images.unsplash.com https://*.supabase.co",
    "connect-src 'self' https://api.stripe.com https://upload.stripe.com https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://api.cloudinary.com https://res.cloudinary.com https://vercel.live wss://ws-us3.pusher.com",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join('; ')

  // Set security headers
  const headers: Record<string, string> = {
    'Content-Security-Policy': csp,
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(self)',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'X-DNS-Prefetch-Control': 'off',
    'X-Download-Options': 'noopen',
    'X-Permitted-Cross-Domain-Policies': 'none'
  }

  // Add CORS headers for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin')
    const allowedOrigins = [
      'http://localhost:3000',
      'https://pawtraits.com',
      'https://www.pawtraits.com',
      process.env.NEXT_PUBLIC_APP_URL
    ].filter(Boolean)

    if (origin && allowedOrigins.includes(origin)) {
      headers['Access-Control-Allow-Origin'] = origin
    }
    
    headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
    headers['Access-Control-Max-Age'] = '86400' // 24 hours
  }

  // Apply headers
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  // Store nonce for use in components
  response.headers.set('X-Nonce', nonce)
}

/**
 * Apply rate limiting to API requests
 */
async function applyRateLimit(req: NextRequest, supabase: any): Promise<NextResponse | null> {
  try {
    // Determine user type from session
    const { data: { session } } = await supabase.auth.getSession()
    let userType = 'anonymous'

    if (session?.user) {
      // Get user type from metadata or database
      userType = session.user.user_metadata?.user_type || 'customer'
    }

    // Check rate limit
    const rateLimitInfo = await rateLimiter.checkRateLimit(req, userType)

    if (rateLimitInfo.limited) {
      // Create rate limit response
      const response = NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests. Try again in ${rateLimitInfo.retryAfter} seconds.`,
          rateLimitInfo: {
            limit: rateLimitInfo.totalRequests,
            remaining: rateLimitInfo.remainingRequests,
            resetTime: rateLimitInfo.resetTime,
            retryAfter: rateLimitInfo.retryAfter
          }
        },
        { status: 429 }
      )

      // Add rate limit headers
      response.headers.set('X-RateLimit-Limit', rateLimitInfo.totalRequests.toString())
      response.headers.set('X-RateLimit-Remaining', rateLimitInfo.remainingRequests.toString())
      response.headers.set('X-RateLimit-Reset', rateLimitInfo.resetTime.toString())
      
      if (rateLimitInfo.retryAfter) {
        response.headers.set('Retry-After', rateLimitInfo.retryAfter.toString())
      }

      return response
    }

    // Add rate limit info headers to successful requests
    if (req.nextUrl.pathname.startsWith('/api/')) {
      const response = NextResponse.next()
      response.headers.set('X-RateLimit-Limit', rateLimitInfo.totalRequests.toString())
      response.headers.set('X-RateLimit-Remaining', rateLimitInfo.remainingRequests.toString())
      response.headers.set('X-RateLimit-Reset', rateLimitInfo.resetTime.toString())
      return response
    }

  } catch (error) {
    console.error('Rate limiting error:', error)
    // Continue without rate limiting on errors to avoid blocking legitimate requests
  }

  return null
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)  
     * - favicon.ico (favicon file)
     * - api/health (health checks)
     * - robots.txt, sitemap.xml (SEO files)
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
}