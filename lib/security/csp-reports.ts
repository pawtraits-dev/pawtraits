/**
 * CSP violation report handling for the report-only trial (see lib/security/csp.ts).
 *
 * Pure functions: parse both report formats, drop noise, normalise into a compact aggregation key.
 * Storage is in app/api/csp-report/route.ts (public.csp_reports, one row per key with a counter).
 *
 * What is kept: effective directive, blocked origin-or-keyword, document PATH (ids -> :id, no query),
 * disposition, and from the first report only: script sample (<=120 chars), source file origin+path,
 * line number, user-agent family. Never kept: full URLs with query strings, IP addresses, cookies, referrers.
 */

export const MAX_BODY_BYTES = 16 * 1024
export const MAX_REPORTS_PER_REQUEST = 20

export interface NormalisedReport {
  effectiveDirective: string
  blocked: string
  documentPath: string
  disposition: 'enforce' | 'report'
  sample: string | null
  sourceFile: string | null
  lineNumber: number | null
  userAgentFamily: string
}

const EXTENSION_SCHEMES = ['chrome-extension:', 'moz-extension:', 'safari-web-extension:', 'safari-extension:', 'webkit-masked-url:', 'about:']
const KEYWORDS = new Set(['inline', 'eval', 'wasm-eval', 'self', 'data', 'blob', 'trusted-types-policy', 'trusted-types-sink', 'ws', 'wss', 'http', 'https', 'mediastream', 'filesystem'])

export function isNoiseUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const v = value.trim().toLowerCase()
  return EXTENSION_SCHEMES.some((s) => v.startsWith(s))
}

/** 'https://a.example/x/y?q=1' -> 'https://a.example'; keywords stay; data:/blob: URLs -> 'data'/'blob'. */
export function blockedKey(raw: unknown, directive: string): string {
  const v = typeof raw === 'string' ? raw.trim() : ''
  if (!v) return /^(script|style)-src/.test(directive) ? 'inline' : 'unknown'
  const lower = v.toLowerCase()
  if (KEYWORDS.has(lower)) return lower
  if (lower.startsWith('data:')) return 'data'
  if (lower.startsWith('blob:')) return 'blob'
  try {
    const u = new URL(v)
    if (u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'ws:' || u.protocol === 'wss:') return u.origin.slice(0, 120)
    return `${u.protocol}`.slice(0, 40)
  } catch {
    return 'other'
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Replace id-like path segments with :id: UUIDs, all-digit, long hex, or anything with 2+ digits (e.g. QR codes like 1123M). */
export function normalisePath(raw: unknown): string {
  if (typeof raw !== 'string' || !raw) return '/'
  let path: string
  try {
    path = new URL(raw, 'https://x.invalid').pathname
  } catch {
    return '/'
  }
  const segments = path.split('/').map((seg) => {
    if (!seg) return seg
    let s = seg
    try { s = decodeURIComponent(seg) } catch { /* keep raw */ }
    const digits = (s.match(/\d/g) || []).length
    if (UUID.test(s) || /^\d+$/.test(s) || /^[0-9a-f]{8,}$/i.test(s) || digits >= 2) return ':id'
    return s.slice(0, 60)
  })
  const out = segments.join('/') || '/'
  return out.slice(0, 120)
}

/** origin + path of a script URL (no query, no hash); '' for non-http(s). */
export function originAndPath(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw) return null
  try {
    const u = new URL(raw)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return `${u.origin}${u.pathname}`.slice(0, 150)
  } catch {
    return null
  }
}

export function userAgentFamily(ua: unknown): string {
  if (typeof ua !== 'string' || !ua) return 'Other'
  if (/bot|crawl|spider|headless|lighthouse/i.test(ua)) return 'Bot'
  if (/Edg(e|A|iOS)?\//.test(ua)) return 'Edge'
  if (/OPR\/|Opera/.test(ua)) return 'Opera'
  if (/SamsungBrowser/.test(ua)) return 'Samsung Internet'
  if (/Firefox\/|FxiOS\//.test(ua)) return 'Firefox'
  if (/Chrome\/|CriOS\//.test(ua)) return 'Chrome'
  if (/Safari\//.test(ua)) return 'Safari'
  return 'Other'
}

function str(v: unknown, max: number): string | null {
  return typeof v === 'string' && v ? v.slice(0, max) : null
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1e9 ? Math.floor(v) : null
}

/** Normalise one report body (fields already unified to the legacy names). Returns null for noise / unusable. */
function normaliseOne(b: {
  blocked: unknown; directive: unknown; violated: unknown; document: unknown
  disposition: unknown; sample: unknown; source: unknown; line: unknown; ua: unknown
}): NormalisedReport | null {
  let directive = typeof b.directive === 'string' ? b.directive.trim().toLowerCase() : ''
  if (!directive && typeof b.violated === 'string') directive = b.violated.trim().split(/\s+/)[0].toLowerCase()
  const blockedRaw = typeof b.blocked === 'string' ? b.blocked.trim() : ''
  if (!directive && !blockedRaw) return null // empty with no directive
  if (!/^[a-z-]{3,40}$/.test(directive)) return null
  if (isNoiseUrl(blockedRaw) || isNoiseUrl(b.source)) return null
  if (isNoiseUrl(b.document)) return null
  return {
    effectiveDirective: directive,
    blocked: blockedKey(blockedRaw, directive),
    documentPath: normalisePath(b.document),
    disposition: b.disposition === 'enforce' ? 'enforce' : 'report',
    sample: str(b.sample, 120),
    sourceFile: originAndPath(b.source),
    lineNumber: num(b.line),
    userAgentFamily: userAgentFamily(b.ua),
  }
}

export type ParseResult =
  | { ok: true; reports: NormalisedReport[]; truncated: boolean }
  | { ok: false; reason: 'content-type' | 'too-large' | 'invalid' }

/**
 * Parse a request body. Accepts application/csp-report ({"csp-report": {...}}) and application/reports+json
 * (array of {type:'csp-violation', body:{...}}). At most 20 reports are used; noise is dropped.
 */
export function parseReportBody(contentType: string | null, bodyText: string, requestUa: string | null): ParseResult {
  const ct = (contentType || '').toLowerCase()
  const legacy = ct.includes('application/csp-report')
  const modern = ct.includes('application/reports+json')
  if (!legacy && !modern) return { ok: false, reason: 'content-type' }
  if (bodyText.length > MAX_BODY_BYTES) return { ok: false, reason: 'too-large' }
  let json: any
  try {
    json = JSON.parse(bodyText)
  } catch {
    return { ok: false, reason: 'invalid' }
  }

  const out: NormalisedReport[] = []
  let truncated = false

  if (legacy) {
    const r = json && typeof json === 'object' ? json['csp-report'] : null
    if (!r || typeof r !== 'object') return { ok: false, reason: 'invalid' }
    const n = normaliseOne({
      blocked: r['blocked-uri'], directive: r['effective-directive'], violated: r['violated-directive'],
      document: r['document-uri'], disposition: r['disposition'], sample: r['script-sample'],
      source: r['source-file'], line: r['line-number'], ua: requestUa,
    })
    if (n) out.push(n)
    return { ok: true, reports: out, truncated }
  }

  if (!Array.isArray(json)) return { ok: false, reason: 'invalid' }
  for (const item of json) {
    if (!item || typeof item !== 'object' || item.type !== 'csp-violation' || !item.body || typeof item.body !== 'object') continue
    if (out.length >= MAX_REPORTS_PER_REQUEST) { truncated = true; break }
    const r = item.body
    const n = normaliseOne({
      blocked: r.blockedURL, directive: r.effectiveDirective, violated: r.violatedDirective,
      document: r.documentURL ?? item.url, disposition: r.disposition, sample: r.sample,
      source: r.sourceFile, line: r.lineNumber, ua: item.user_agent ?? requestUa,
    })
    if (n) out.push(n)
  }
  return { ok: true, reports: out, truncated }
}

/** Collapse reports with the same key into one row with a count (first sample wins). */
export interface AggregatedRow extends NormalisedReport { count: number }

export function aggregateReports(reports: NormalisedReport[]): AggregatedRow[] {
  const map = new Map<string, AggregatedRow>()
  for (const r of reports) {
    const key = [r.effectiveDirective, r.blocked, r.documentPath, r.disposition].join('\u0001')
    const hit = map.get(key)
    if (hit) hit.count++
    else map.set(key, { ...r, count: 1 })
  }
  return Array.from(map.values())
}

/** Read a request body as text, giving up (null) as soon as it exceeds the limit. */
export async function readBodyLimited(req: Request, limit = MAX_BODY_BYTES): Promise<string | null> {
  const declared = Number(req.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > limit) return null
  if (!req.body) return ''
  const reader = req.body.getReader()
  const decoder = new TextDecoder()
  let total = 0
  let text = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > limit) {
      try { await reader.cancel() } catch { /* ignore */ }
      return null
    }
    text += decoder.decode(value, { stream: true })
  }
  return text + decoder.decode()
}
