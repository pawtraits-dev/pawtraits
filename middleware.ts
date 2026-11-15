import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { RateLimiter } from './lib/rate-limiter'
import { createDLPMiddleware } from './lib/dlp-integration'
import {
  buildEnforcedCsp, buildReportOnlyCsp, generateNonce, isCspReportOnlyEnabled,
  reportingEndpointsHeader, wantsHtmlDocument,
} from './lib/security/csp'

// Initialize global rate limiter
const rateLimiter = new RateLimiter({
  suspiciousThreshold: 60,
  blockThreshold: 120,
  blockDurationMs: 5 * 60 * 1000, // 5 minutes
  enableAutoBlock: true
})

// Catalogue pictures: a page of 24 designs is 24+ picture requests at once, and "load more" adds more.
// The general limiter treats anonymous API traffic as 20 requests/minute, which a single page load exceeds,
// so pictures get their own limiter instance (own counters) and a generous limit. Counters live in this
// server instance's memory (a Map): no database or network call per request, and each warm instance counts
// separately. Its auto-block threshold is above the per-minute limit, so it never blocks, it only returns 429
// until the window slides.
const PICTURE_REQUESTS_PER_MINUTE = 600
const pictureRateLimiter = new RateLimiter({
  suspiciousThreshold: PICTURE_REQUESTS_PER_MINUTE,
  blockThreshold: PICTURE_REQUESTS_PER_MINUTE * 2,
  enableAutoBlock: true
})
pictureRateLimiter.addRule({
  id: 'secure-images',
  pattern: '/api/secure-images/*',
  userTypes: ['anonymous'],
  config: { windowMs: 60 * 1000, maxRequests: PICTURE_REQUESTS_PER_MINUTE, strategy: 'sliding' },
  priority: 200,
  isActive: true
})

// CSP violation reports (POST /api/csp-report) come from browsers, in bursts when a page has many blocked scripts.
// They get their own limiter (own counters, in-memory like the picture one) so they are not 429ed by the general
// 20 requests/minute anonymous API limit, and skip the session refresh and DLP scan (no cookies, nothing to protect).
const CSP_REPORTS_PER_MINUTE = 120
const cspReportRateLimiter = new RateLimiter({
  suspiciousThreshold: CSP_REPORTS_PER_MINUTE,
  blockThreshold: CSP_REPORTS_PER_MINUTE * 2,
  enableAutoBlock: true
})
cspReportRateLimiter.addRule({
  id: 'csp-report',
  pattern: '/api/csp-report',
  userTypes: ['anonymous'],
  config: { windowMs: 60 * 1000, maxRequests: CSP_REPORTS_PER_MINUTE, strategy: 'sliding' },
  priority: 200,
  isActive: true
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

const TEST_PAGES = new Set([
  '/quick-debug', '/css-test', '/ui-demo', '/demo', '/interactions-demo', '/customer/test-cart',
])

// One browse page (customer UX round 2): old listing routes → /browse, keeping any query string.
// Not redirected: /customer/gallery and /gallery (people's own Pawtraits; /gallery serves partners too), /catalog (admin shortcut).
const BROWSE_REDIRECTS: Record<string, { path: string; params?: Record<string, string> }> = {
  '/products': { path: '/browse' },
  '/customer/shop': { path: '/browse' },
  '/customer/products': { path: '/browse' },
  '/dogs': { path: '/browse', params: { type: 'dogs' } },
  '/cats': { path: '/browse', params: { type: 'cats' } },
  '/dogs-redirect': { path: '/browse', params: { type: 'dogs' } },
  '/cats-redirect': { path: '/browse', params: { type: 'cats' } },
  '/themes-redirect': { path: '/themes' },
  '/home': { path: '/' },
  '/quiz': { path: '/quiz/pawsonality', params: { src: 'short-link' } },   // short address printed on share cards
}

export async function middleware(req: NextRequest) {
  // Sticker QR codes are printed in UPPER CASE (/S/1123M/CAMDEN) for a smaller QR;
  // routes are case-sensitive, so rewrite to the /s handler before anything else.
  if (req.nextUrl.pathname.startsWith('/S/')) {
    const url = req.nextUrl.clone()
    url.pathname = '/s/' + req.nextUrl.pathname.slice(3)
    return NextResponse.rewrite(url)
  }

  // One design page: /shop/<design> → /customise/<design> (spec: docs/specs/customer-ux-round-1.md).
  // Partner discount and auto-add links keep the old page until those flows move across.
  const shopDesign = req.nextUrl.pathname.match(/^\/shop\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i)
  if (shopDesign && !req.nextUrl.searchParams.has('partner') && !req.nextUrl.searchParams.has('autoAdd')) {
    const url = req.nextUrl.clone()
    url.pathname = `/customise/${shopDesign[1]}`
    return NextResponse.redirect(url, 308)
  }

  // Themes are behind the scenes now (collections-plan phase 3): old theme browse links go to
  // /themes, which sends people to the theme's collection (or all collections)
  if (req.nextUrl.pathname === '/browse' && req.nextUrl.searchParams.get('type') === 'themes') {
    const url = req.nextUrl.clone()
    const theme = url.searchParams.get('theme')
    url.pathname = '/themes'
    url.search = theme ? `?theme=${encodeURIComponent(theme)}` : ''
    return NextResponse.redirect(url, 308)
  }

  // The Pawsonalities collection is the /pawsonalities pages: /collections/pawsonalities → /pawsonalities,
  // /collections/pawsonalities/enfb → /pawsonalities/dog/enfb (which redirects to the type's named page)
  const pawsonality = req.nextUrl.pathname.match(/^\/collections\/pawsonalities(?:\/([a-z]{4}))?\/?$/i)
  if (pawsonality) {
    const url = req.nextUrl.clone()
    const animal = url.searchParams.get('animal') === 'cat' ? 'cat' : 'dog'
    const code = pawsonality[1]?.toLowerCase()
    url.pathname = code ? `/pawsonalities/${animal}/${code}` : '/pawsonalities'
    const breed = url.searchParams.get('breed')
    url.search = ''
    if (!code && animal === 'cat') url.searchParams.set('animal', 'cat')
    if (breed && /^[0-9a-f-]{36}$/i.test(breed)) url.searchParams.set('breed', breed) // collection pages use breed slugs; ids only here
    return NextResponse.redirect(url, 308)
  }

  const browseTarget = BROWSE_REDIRECTS[req.nextUrl.pathname.replace(/\/$/, '') || '/']
  if (browseTarget) {
    const url = req.nextUrl.clone()
    url.pathname = browseTarget.path
    for (const [k, v] of Object.entries(browseTarget.params || {})) {
      if (!url.searchParams.has(k)) url.searchParams.set(k, v)
    }
    return NextResponse.redirect(url, 308)
  }

  // Development/test pages are not for customers
  if (process.env.NODE_ENV === 'production' && TEST_PAGES.has(req.nextUrl.pathname)) {
    return new NextResponse('Not found', { status: 404 })
  }

  // Catalogue pictures (GET /api/secure-images/...): the route does its own checks (watermarked variants
  // need no session; unwatermarked ones check for an admin themselves), so skip the Supabase session
  // refresh, the DLP scan and the account-based rate limit. Pictures are
  // rate limited as anonymous traffic with their own, generous limit (no session lookup).
  if (req.method === 'GET' && req.nextUrl.pathname.startsWith('/api/secure-images/')) {
    return handlePictureRequest(req)
  }

  // Browser violation reports: own rate limit, nothing else (the route validates and bounds the body itself)
  if (req.method === 'POST' && req.nextUrl.pathname === '/api/csp-report') {
    return handleCspReport(req)
  }

  // CSP report-only trial (kill switch: CSP_REPORT_ONLY=off). Only for requests that return an HTML page.
  // The nonce policy goes on the REQUEST so Next.js puts the nonce on its own scripts (it reads
  // content-security-policy-report-only as well as content-security-policy); the browser never sees request headers.
  // The enforced policy on the RESPONSE is untouched.
  let reportOnlyNonce: string | null = null
  let res: NextResponse
  if (isCspReportOnlyEnabled(process.env.CSP_REPORT_ONLY) && wantsHtmlDocument(req.method, req.nextUrl.pathname, req.headers)) {
    reportOnlyNonce = generateNonce()
    const requestHeaders = new Headers(req.headers)
    requestHeaders.delete('content-security-policy') // Next prefers this name; never let a client-supplied one win
    requestHeaders.set('content-security-policy-report-only', buildReportOnlyCsp(reportOnlyNonce))
    requestHeaders.set('x-nonce', reportOnlyNonce)
    res = NextResponse.next({ request: { headers: requestHeaders } })
  } else {
    res = NextResponse.next()
  }
  
  // Create a Supabase client configured to use cookies
  const supabase = createMiddlewareClient({ req, res })

  // Add comprehensive security headers
  addSecurityHeaders(res, req, reportOnlyNonce)

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
 * Cheap path for picture requests: anonymous rate limit, one security header, nothing else.
 */
async function handlePictureRequest(req: NextRequest): Promise<NextResponse> {
  try {
    const info = await pictureRateLimiter.checkRateLimit(req, 'anonymous')
    if (info.limited) {
      const limited = NextResponse.json(
        { error: 'Rate limit exceeded', message: `Too many requests. Try again in ${info.retryAfter} seconds.` },
        { status: 429 }
      )
      if (info.retryAfter) limited.headers.set('Retry-After', info.retryAfter.toString())
      limited.headers.set('X-Content-Type-Options', 'nosniff')
      return limited
    }
  } catch (error) {
    console.error('Picture rate limiting error:', error)
    // Fail open, like the general limiter
  }
  const res = NextResponse.next()
  res.headers.set('X-Content-Type-Options', 'nosniff')
  return res
}

/**
 * Violation reports from browsers: anonymous, own in-memory limit, no session work, no DLP.
 */
async function handleCspReport(req: NextRequest): Promise<NextResponse> {
  try {
    const info = await cspReportRateLimiter.checkRateLimit(req, 'anonymous')
    if (info.limited) {
      const limited = new NextResponse(null, { status: 429 })
      if (info.retryAfter) limited.headers.set('Retry-After', info.retryAfter.toString())
      return limited
    }
  } catch (error) {
    console.error('CSP report rate limiting error:', error)
    // Fail open, like the other limiters
  }
  return NextResponse.next()
}

/**
 * Add comprehensive security headers to response.
 * reportOnlyNonce is set only for HTML page requests while the CSP report-only trial is on.
 */
function addSecurityHeaders(response: NextResponse, request: NextRequest, reportOnlyNonce: string | null): void {
  // Nonce exposed to components (X-Nonce); the report-only trial supplies a proper one, otherwise as before
  const nonce = reportOnlyNonce ?? crypto.randomUUID()
  
  // Content Security Policy - More permissive for Next.js while maintaining security
  const csp = buildEnforcedCsp() // directive list lives in lib/security/csp.ts (shared with the report-only policy)

  // Set security headers
  const headers: Record<string, string> = {
    'Content-Security-Policy': csp,
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(self "https://js.stripe.com")', // Stripe iframe needs payment for Apple/Google Pay
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

  // Report-only trial of the strict nonce policy: observe only, nothing is blocked
  if (reportOnlyNonce) {
    response.headers.set('Content-Security-Policy-Report-Only', buildReportOnlyCsp(reportOnlyNonce))
    response.headers.set('Reporting-Endpoints', reportingEndpointsHeader())
  }

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