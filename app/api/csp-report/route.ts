import { NextRequest, NextResponse, after } from 'next/server'
import { serviceClient } from '@/lib/qr/server'
import { aggregateReports, parseReportBody, readBodyLimited } from '@/lib/security/csp-reports'

/**
 * Receives CSP violation reports from browsers (report-only trial, see lib/security/csp.ts).
 * No auth: browsers send these without credentials. Always answers 204 quickly and never throws;
 * anything unusable (wrong type, too big, malformed, noise) is silently ignored. The database write
 * happens after the response is sent. The middleware rate limits this path (POST /api/csp-report).
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_CONTENT = () => new NextResponse(null, { status: 204 })

let warnedMissing = false

async function store(rows: ReturnType<typeof aggregateReports>) {
  try {
    const payload = rows.map((r) => ({
      effective_directive: r.effectiveDirective,
      blocked: r.blocked,
      document_path: r.documentPath,
      disposition: r.disposition,
      count: r.count,
      sample: r.sample,
      source_file: r.sourceFile,
      line_number: r.lineNumber,
      user_agent_family: r.userAgentFamily,
    }))
    const { error } = await serviceClient().rpc('csp_report_upsert', { p_rows: payload })
    if (error && !warnedMissing) {
      warnedMissing = true
      console.warn('csp-report: not stored (has db/migrations/2026-11-15-csp-reports.sql been run?):', error.code || error.message)
    }
  } catch (e) {
    if (!warnedMissing) {
      warnedMissing = true
      console.warn('csp-report: store failed:', (e as Error)?.message)
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const text = await readBodyLimited(req)
    if (text === null) return NO_CONTENT()
    const parsed = parseReportBody(req.headers.get('content-type'), text, req.headers.get('user-agent'))
    if (!parsed.ok || parsed.reports.length === 0) return NO_CONTENT()
    const rows = aggregateReports(parsed.reports)
    try {
      after(() => store(rows))
    } catch {
      void store(rows)
    }
  } catch {
    // never throw
  }
  return NO_CONTENT()
}
