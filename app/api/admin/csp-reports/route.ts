import { NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/lib/qr/server'

export const dynamic = 'force-dynamic'

const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST205', 'PGRST202'])

/** Aggregated CSP report-only violations, most frequent first. */
export async function GET() {
  const denied = await requireAdmin()
  if (denied) return denied
  const { data, error } = await serviceClient()
    .from('csp_reports')
    .select('id, effective_directive, blocked, document_path, disposition, count, first_seen, last_seen, sample, source_file, line_number, user_agent_family')
    .order('count', { ascending: false })
    .limit(1000)
  if (error) {
    if (MISSING_TABLE_CODES.has(error.code) || /csp_reports/.test(error.message || '')) {
      return NextResponse.json({ missingTable: true, reports: [] })
    }
    console.error('csp-reports GET failed:', error)
    return NextResponse.json({ error: 'Could not load reports' }, { status: 500 })
  }
  return NextResponse.json({ missingTable: false, reports: data || [] })
}

/** Clear all collected reports. */
export async function DELETE() {
  const denied = await requireAdmin()
  if (denied) return denied
  const { error } = await serviceClient().from('csp_reports').delete().gt('id', 0)
  if (error) {
    console.error('csp-reports DELETE failed:', error)
    return NextResponse.json({ error: 'Could not clear reports' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
