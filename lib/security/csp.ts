/**
 * Content Security Policy builder, shared by the enforced policy and the report-only trial.
 *
 * Both policies are built from ONE directive list (DIRECTIVES) so they cannot drift apart:
 *   - the ENFORCED policy is exactly what the site has always sent (pinned byte-for-byte in scripts/test-csp.ts);
 *   - the REPORT-ONLY policy is the strict policy we want to move to: same directives, except script-src
 *     is nonce + 'strict-dynamic' (no 'unsafe-eval'), plus the reporting directives. Nothing is blocked by it;
 *     browsers only POST violation reports to /api/csp-report.
 *
 * Kill switch: CSP_REPORT_ONLY=off (env var) makes the middleware send no report-only header and set no nonce
 * request headers (behaviour identical to before this trial). Unset or any other value = on.
 *
 * Pure functions only (no Node APIs): this file runs in the Edge runtime (middleware) and in plain tsx tests.
 */

export const CSP_REPORT_PATH = '/api/csp-report'
export const CSP_REPORT_GROUP = 'csp'

/** Every directive of the enforced policy, in order. `script-src` is replaced in the report-only policy. */
const DIRECTIVES: ReadonlyArray<readonly [string, string]> = [
  ['default-src', "'self'"],
  ['script-src', "'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.js.stripe.com https://pay.google.com https://maps.googleapis.com https://vercel.live https://www.googletagmanager.com https://connect.facebook.net https://challenges.cloudflare.com"],
  ['style-src', "'self' 'unsafe-inline' https://fonts.googleapis.com"],
  ['font-src', "'self' https://fonts.gstatic.com"],
  ['img-src', "'self' data: blob: https://www.googletagmanager.com https://*.google-analytics.com https://*.g.doubleclick.net https://www.google.com https://www.google.co.uk https://www.facebook.com https://res.cloudinary.com https://lh3.googleusercontent.com https://images.unsplash.com https://*.stripe.com https://*.supabase.co https://pawtraits.pics https://www.pawtraits.pics"],
  ['connect-src', "'self' https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://*.g.doubleclick.net https://www.google.com https://www.facebook.com https://connect.facebook.net https://api.stripe.com https://upload.stripe.com https://*.stripe.com https://*.stripe.network https://*.link.com https://pay.google.com https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://api.cloudinary.com https://res.cloudinary.com https://vercel.live wss://ws-us3.pusher.com"],
  ['frame-src', "'self' https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com https://pay.google.com https://*.link.com https://td.doubleclick.net https://www.googletagmanager.com"],
  ['object-src', "'none'"],
  ['base-uri', "'self'"],
  ['form-action', "'self'"],
  ['frame-ancestors', "'none'"],
  ['upgrade-insecure-requests', ''],
]

/** Directives that browsers ignore (and warn about in the console) when delivered report-only. */
const IGNORED_WHEN_REPORT_ONLY = new Set(['upgrade-insecure-requests'])

function serialise(list: ReadonlyArray<readonly [string, string]>): string {
  return list.map(([name, value]) => (value ? `${name} ${value}` : name)).join('; ')
}

/** The policy that is actually enforced. Must stay byte-for-byte unchanged by this trial. */
export function buildEnforcedCsp(): string {
  return serialise(DIRECTIVES)
}

/** The strict script-src of the report-only policy. 'https:' and 'unsafe-inline' are fallbacks for browsers without nonce support (nonce-aware browsers ignore them). */
export function strictScriptSrc(nonce: string): string {
  return `'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-inline'`
}

/** The strict policy we want to move to, to be sent as Content-Security-Policy-Report-Only. */
export function buildReportOnlyCsp(nonce: string): string {
  const list: Array<readonly [string, string]> = DIRECTIVES
    .filter(([name]) => !IGNORED_WHEN_REPORT_ONLY.has(name))
    .map(([name, value]) => (name === 'script-src' ? ([name, strictScriptSrc(nonce)] as const) : ([name, value] as const)))
  list.push(['report-uri', CSP_REPORT_PATH])
  list.push(['report-to', CSP_REPORT_GROUP])
  return serialise(list)
}

/** Value of the Reporting-Endpoints response header that the `report-to csp` directive refers to. */
export function reportingEndpointsHeader(): string {
  return `${CSP_REPORT_GROUP}="${CSP_REPORT_PATH}"`
}

/** Per-request nonce: base64 of 16 random bytes (Edge-runtime safe). */
export function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

/** Kill switch: CSP_REPORT_ONLY=off turns the trial off. Default (unset) is on. */
export function isCspReportOnlyEnabled(envValue: string | undefined): boolean {
  return (envValue ?? '').trim().toLowerCase() !== 'off'
}

interface HeaderReader { get(name: string): string | null }

/**
 * Does this request return an HTML page (a browser navigation)? Only those get the report-only header and the nonce.
 * Not /api/*, not /_next/*, not files with an extension, not client-side navigation fetches (RSC).
 * Uses Sec-Fetch-Dest when the browser sends it, otherwise the Accept header.
 */
export function wantsHtmlDocument(method: string, pathname: string, headers: HeaderReader): boolean {
  if (method !== 'GET') return false
  if (pathname === '/api' || pathname.startsWith('/api/') || pathname.startsWith('/_next/')) return false
  const last = pathname.split('/').pop() || ''
  if (last.includes('.')) return false
  if (headers.get('rsc') !== null || headers.get('next-router-prefetch') !== null) return false
  const dest = headers.get('sec-fetch-dest')
  if (dest) return dest === 'document'
  return (headers.get('accept') || '').includes('text/html')
}
