import { NextRequest, NextResponse } from 'next/server'
import { AuditLogger } from '@/lib/audit-logger'

const auditLogger = new AuditLogger()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      type, 
      component, 
      violation, 
      userAgent, 
      url, 
      timestamp 
    } = body

    // Log security violation
    try {
      await auditLogger.logSecurityViolation({
        violation_type: type || 'unknown',
        component: component || 'unknown',
        details: {
          violation: violation || 'No details provided',
          userAgent: userAgent || request.headers.get('user-agent'),
          url: url || request.url,
          timestamp: timestamp || new Date().toISOString(),
          ip: request.headers.get('x-forwarded-for') || 'unknown'
        }
      })
    } catch (dbError) {
      // If database tables don't exist yet, log to console but don't fail
      console.warn('Audit database tables not ready, logging to console:', {
        type,
        component,
        violation,
        userAgent: userAgent || request.headers.get('user-agent'),
        url: url || request.url,
        timestamp: timestamp || new Date().toISOString(),
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        error: dbError
      })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Security violation logged' 
    })
  } catch (error) {
    console.error('Security violation logging error:', error)
    return NextResponse.json(
      { error: 'Failed to log security violation' },
      { status: 500 }
    )
  }
}

// Return 405 for other methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}