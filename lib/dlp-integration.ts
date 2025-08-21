/**
 * SECURITY CRITICAL: DLP Integration Layer
 * 
 * Provides seamless integration of DLP scanning with:
 * - Next.js middleware
 * - API route handlers
 * - Database operations
 * - File upload handlers
 * - Email sending systems
 * - Third-party integrations
 */

import { NextRequest, NextResponse } from 'next/server'
import { DLPScanner, DLPConfig, DLPScanResult } from './dlp-scanner'
import { AuditLogger } from './audit-logger'

export interface DLPIntegrationConfig extends Partial<DLPConfig> {
  enableAPIProtection: boolean
  enableFileUploadScanning: boolean
  enableEmailScanning: boolean
  enableDatabaseScanning: boolean
  autoQuarantine: boolean
  blockOnViolation: boolean
  exemptPaths: string[]
  alertWebhook?: string
  emergencyContacts: string[]
}

export class DLPIntegration {
  private scanner: DLPScanner
  private auditLogger: AuditLogger
  private config: DLPIntegrationConfig

  constructor(config: Partial<DLPIntegrationConfig> = {}) {
    this.config = {
      enableAPIProtection: true,
      enableFileUploadScanning: true,
      enableEmailScanning: true,
      enableDatabaseScanning: true,
      autoQuarantine: true,
      blockOnViolation: true,
      exemptPaths: [],
      emergencyContacts: [],
      ...config
    }
    
    this.scanner = new DLPScanner(config)
    this.auditLogger = new AuditLogger()
  }

  /**
   * Enhanced middleware with DLP protection
   */
  createDLPMiddleware() {
    return async (req: NextRequest): Promise<NextResponse | null> => {
      if (!this.config.enableAPIProtection) {
        return null
      }

      // Check if path is exempt
      const pathname = req.nextUrl.pathname
      const isExempt = this.config.exemptPaths.some(exemptPath => pathname.startsWith(exemptPath))
      
      if (isExempt) {
        console.log(`[DLP] Skipping scan for exempt path: ${pathname}`)
        return null // Skip DLP scanning for exempt paths
      }
      
      console.log(`[DLP] Scanning path: ${pathname}`)

      try {
        // Scan incoming request
        const requestScanResult = await this.scanner.scanRequest(req)
        
        if (requestScanResult.hasViolations) {
          // Handle violations based on severity and config
          const shouldBlock = this.config.blockOnViolation && this.shouldBlockRequest(requestScanResult)
          
          console.log(`[DLP] Violation detected - blockOnViolation: ${this.config.blockOnViolation}, shouldBlock: ${shouldBlock}, riskScore: ${requestScanResult.riskScore}`)
          
          if (shouldBlock) {
            await this.handleViolationBlocked(req, requestScanResult)
            
            return new NextResponse(
              JSON.stringify({
                error: 'Request blocked due to security policy violation',
                code: 'DLP_VIOLATION',
                reference: await this.generateIncidentReference()
              }),
              {
                status: 403,
                headers: {
                  'Content-Type': 'application/json',
                  'X-DLP-Block-Reason': 'Sensitive data detected'
                }
              }
            )
          } else {
            // Log but allow (with potential redaction)
            await this.handleViolationLogged(req, requestScanResult)
          }
        }

        // Allow request to proceed
        return null

      } catch (error) {
        console.error('DLP middleware error:', error)
        // Fail open for availability, but log the error
        await this.auditLogger.logEvent({
          eventType: 'SYSTEM_ACCESS',
          severity: 'HIGH',
          action: 'DLP_MIDDLEWARE_ERROR',
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
          outcome: 'FAILURE'
        })
        return null
      }
    }
  }

  /**
   * API route wrapper with DLP protection
   */
  protectAPIRoute(handler: (req: NextRequest) => Promise<NextResponse>) {
    return async (req: NextRequest): Promise<NextResponse> => {
      try {
        // Pre-process scanning
        const requestScanResult = await this.scanner.scanRequest(req)
        
        if (requestScanResult.hasViolations && this.shouldBlockRequest(requestScanResult)) {
          return new NextResponse(
            JSON.stringify({
              error: 'Request rejected due to sensitive data detection',
              violations: requestScanResult.matches.length,
              reference: await this.generateIncidentReference()
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            }
          )
        }

        // Execute original handler
        const response = await handler(req)

        // Post-process scanning of response
        const responseScanResult = await this.scanner.scanResponse(response, req)
        
        if (responseScanResult.hasViolations) {
          await this.handleResponseViolation(req, response, responseScanResult)
          
          // Return redacted response if configured
          if (responseScanResult.redactedContent && this.config.redactSensitiveData) {
            return new NextResponse(responseScanResult.redactedContent, {
              status: response.status,
              headers: response.headers
            })
          }
          
          // Or block response entirely for critical violations
          if (this.shouldBlockResponse(responseScanResult)) {
            return new NextResponse(
              JSON.stringify({
                error: 'Response blocked due to sensitive data exposure',
                reference: await this.generateIncidentReference()
              }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
              }
            )
          }
        }

        return response

      } catch (error) {
        console.error('DLP API protection error:', error)
        await this.auditLogger.logSecurityIncident(
          'DLP_API_PROTECTION_ERROR',
          'HIGH',
          req,
          { error: error instanceof Error ? error.message : 'Unknown error' }
        )
        
        // Return generic error to avoid information leakage
        return new NextResponse(
          JSON.stringify({ error: 'Internal server error' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }
    }
  }

  /**
   * File upload scanner
   */
  async scanFileUpload(file: File | Buffer, filename: string, metadata: Record<string, any> = {}): Promise<DLPScanResult> {
    if (!this.config.enableFileUploadScanning) {
      return { hasViolations: false, matches: [], riskScore: 0, recommendations: [] }
    }

    try {
      let content: string

      if (file instanceof Buffer) {
        content = file.toString('utf-8')
      } else {
        // Handle File object
        const arrayBuffer = await file.arrayBuffer()
        content = new TextDecoder().decode(arrayBuffer)
      }

      const result = await this.scanner.scanFile(filename, content)

      if (result.hasViolations) {
        await this.handleFileViolation(filename, result, metadata)
        
        // Quarantine file if configured
        if (this.config.autoQuarantine) {
          await this.quarantineFile(filename, content, result)
        }
      }

      return result

    } catch (error) {
      console.error('File upload scanning error:', error)
      return { hasViolations: false, matches: [], riskScore: 0, recommendations: [] }
    }
  }

  /**
   * Database query scanner
   */
  async scanDatabaseOperation(
    operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE',
    table: string,
    data: Record<string, any>,
    userId?: string
  ): Promise<DLPScanResult> {
    if (!this.config.enableDatabaseScanning) {
      return { hasViolations: false, matches: [], riskScore: 0, recommendations: [] }
    }

    try {
      // Convert data to scannable content
      const content = JSON.stringify(data, null, 2)
      const result = await this.scanner.scanContent(content, {
        source: 'DATABASE',
        operation,
        table,
        userId
      })

      if (result.hasViolations) {
        await this.handleDatabaseViolation(operation, table, result, userId, data)
      }

      return result

    } catch (error) {
      console.error('Database scanning error:', error)
      return { hasViolations: false, matches: [], riskScore: 0, recommendations: [] }
    }
  }

  /**
   * Email content scanner
   */
  async scanEmail(
    to: string | string[],
    subject: string,
    content: string,
    attachments: Array<{filename: string, content: string}> = []
  ): Promise<DLPScanResult> {
    if (!this.config.enableEmailScanning) {
      return { hasViolations: false, matches: [], riskScore: 0, recommendations: [] }
    }

    try {
      // Combine all email content for scanning
      const fullContent = [
        `TO: ${Array.isArray(to) ? to.join(', ') : to}`,
        `SUBJECT: ${subject}`,
        `BODY: ${content}`,
        ...attachments.map(att => `ATTACHMENT ${att.filename}: ${att.content}`)
      ].join('\n\n')

      const result = await this.scanner.scanContent(fullContent, {
        source: 'EMAIL',
        recipients: Array.isArray(to) ? to : [to],
        subject,
        attachmentCount: attachments.length
      })

      if (result.hasViolations) {
        await this.handleEmailViolation(to, subject, result)
        
        // Block email if critical violations found
        if (this.shouldBlockEmail(result)) {
          throw new Error('Email blocked due to sensitive data detection')
        }
      }

      return result

    } catch (error) {
      console.error('Email scanning error:', error)
      throw error // Re-throw to prevent email sending
    }
  }

  /**
   * Real-time monitoring dashboard data
   */
  async getMonitoringData(): Promise<Record<string, any>> {
    const now = new Date()
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const [recent24h, recent7d] = await Promise.all([
      this.scanner.generateComplianceReport(last24Hours, now),
      this.scanner.generateComplianceReport(last7Days, now)
    ])

    return {
      current: {
        activeScans: 0, // Would track active scanning operations
        riskScore: recent24h.averageRiskScore || 0,
        violationsLast24h: recent24h.totalViolations,
        criticalViolations: recent24h.violationsBySeverity?.CRITICAL || 0
      },
      trends: {
        violationsLast7d: recent7d.totalViolations,
        riskTrend: this.calculateRiskTrend(recent7d, recent24h),
        topViolationTypes: recent24h.violationsByType || {},
        complianceStatus: recent24h.complianceStatus || {}
      },
      alerts: await this.getActiveAlerts(),
      recommendations: recent24h.recommendations || []
    }
  }

  /**
   * Private helper methods
   */
  private shouldBlockRequest(scanResult: DLPScanResult): boolean {
    // Only block critical violations with very high risk scores to reduce false positives
    return scanResult.matches.some(m => 
      m.pattern.severity === 'CRITICAL' && 
      (m.pattern.type === 'CREDIT_CARD' || m.pattern.type === 'SSN')
    ) || scanResult.riskScore >= 95
  }

  private shouldBlockResponse(scanResult: DLPScanResult): boolean {
    // More conservative blocking for responses to avoid breaking functionality
    return scanResult.matches.some(m => 
      m.pattern.severity === 'CRITICAL' && 
      (m.pattern.type === 'CREDIT_CARD' || m.pattern.type === 'SSN' || m.pattern.type === 'API_KEY')
    )
  }

  private shouldBlockEmail(scanResult: DLPScanResult): boolean {
    // Block emails with critical financial or credential data
    return scanResult.matches.some(m => 
      m.pattern.severity === 'CRITICAL' && 
      ['CREDIT_CARD', 'API_KEY', 'ENCRYPTION_KEY', 'DATABASE_CONNECTION'].includes(m.pattern.type)
    )
  }

  private async generateIncidentReference(): Promise<string> {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substr(2, 5)
    return `DLP-${timestamp}-${random}`.toUpperCase()
  }

  private async handleViolationBlocked(req: NextRequest, scanResult: DLPScanResult): Promise<void> {
    await this.auditLogger.logSecurityIncident(
      'DLP_REQUEST_BLOCKED',
      'HIGH',
      req,
      {
        violationCount: scanResult.matches.length,
        riskScore: scanResult.riskScore,
        dataTypes: scanResult.matches.map(m => m.pattern.type),
        patterns: scanResult.matches.map(m => m.pattern.name)
      }
    )

    // Send alert if configured
    if (this.config.alertWebhook) {
      await this.sendAlert('Request Blocked', scanResult, req)
    }
  }

  private async handleViolationLogged(req: NextRequest, scanResult: DLPScanResult): Promise<void> {
    await this.auditLogger.logEvent({
      eventType: 'SECURITY_INCIDENT',
      severity: 'MEDIUM',
      action: 'DLP_VIOLATION_LOGGED',
      resource: 'REQUEST',
      details: {
        violationCount: scanResult.matches.length,
        riskScore: scanResult.riskScore,
        dataTypes: scanResult.matches.map(m => m.pattern.type)
      },
      outcome: 'SUCCESS'
    })
  }

  private async handleResponseViolation(req: NextRequest, response: NextResponse, scanResult: DLPScanResult): Promise<void> {
    await this.auditLogger.logEvent({
      eventType: 'DATA_ACCESS',
      severity: 'HIGH',
      action: 'SENSITIVE_DATA_EXPOSURE',
      resource: 'RESPONSE',
      details: {
        path: new URL(req.url).pathname,
        statusCode: response.status,
        violationCount: scanResult.matches.length,
        riskScore: scanResult.riskScore,
        dataTypes: scanResult.matches.map(m => m.pattern.type)
      },
      outcome: 'SUCCESS'
    })
  }

  private async handleFileViolation(filename: string, scanResult: DLPScanResult, metadata: Record<string, any>): Promise<void> {
    await this.auditLogger.logEvent({
      eventType: 'FILE_OPERATION',
      severity: 'HIGH',
      action: 'SENSITIVE_DATA_IN_UPLOAD',
      resource: 'FILE',
      resourceId: filename,
      details: {
        filename,
        violationCount: scanResult.matches.length,
        riskScore: scanResult.riskScore,
        dataTypes: scanResult.matches.map(m => m.pattern.type),
        metadata
      },
      outcome: 'BLOCKED'
    })
  }

  private async handleDatabaseViolation(
    operation: string,
    table: string,
    scanResult: DLPScanResult,
    userId?: string,
    data?: Record<string, any>
  ): Promise<void> {
    await this.auditLogger.logEvent({
      eventType: 'DATA_MODIFICATION',
      severity: 'MEDIUM',
      userId,
      action: `DATABASE_${operation}_VIOLATION`,
      resource: table,
      details: {
        operation,
        table,
        violationCount: scanResult.matches.length,
        riskScore: scanResult.riskScore,
        dataTypes: scanResult.matches.map(m => m.pattern.type),
        affectedFields: Object.keys(data || {})
      },
      outcome: 'SUCCESS'
    })
  }

  private async handleEmailViolation(to: string | string[], subject: string, scanResult: DLPScanResult): Promise<void> {
    await this.auditLogger.logEvent({
      eventType: 'PRIVACY_EVENT',
      severity: 'HIGH',
      action: 'EMAIL_VIOLATION_DETECTED',
      resource: 'EMAIL',
      details: {
        recipients: Array.isArray(to) ? to : [to],
        subject,
        violationCount: scanResult.matches.length,
        riskScore: scanResult.riskScore,
        dataTypes: scanResult.matches.map(m => m.pattern.type)
      },
      outcome: 'BLOCKED'
    })
  }

  private async quarantineFile(filename: string, content: string, scanResult: DLPScanResult): Promise<void> {
    // In a real implementation, this would move the file to a secure quarantine location
    console.log(`File quarantined: ${filename} (${scanResult.matches.length} violations)`)
    
    await this.auditLogger.logEvent({
      eventType: 'FILE_OPERATION',
      severity: 'MEDIUM',
      action: 'FILE_QUARANTINED',
      resource: 'FILE',
      resourceId: filename,
      details: {
        filename,
        quarantineReason: 'DLP violations',
        violationCount: scanResult.matches.length
      },
      outcome: 'SUCCESS'
    })
  }

  private async sendAlert(type: string, scanResult: DLPScanResult, req?: NextRequest): Promise<void> {
    if (!this.config.alertWebhook) return

    try {
      const alertData = {
        type,
        timestamp: new Date().toISOString(),
        violations: scanResult.matches.length,
        riskScore: scanResult.riskScore,
        dataTypes: scanResult.matches.map(m => m.pattern.type),
        severity: scanResult.matches.map(m => m.pattern.severity),
        path: req ? new URL(req.url).pathname : undefined,
        reference: await this.generateIncidentReference()
      }

      await fetch(this.config.alertWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertData)
      })
    } catch (error) {
      console.error('Failed to send DLP alert:', error)
    }
  }

  private calculateRiskTrend(recent7d: any, recent24h: any): 'INCREASING' | 'DECREASING' | 'STABLE' {
    const avgDaily7d = recent7d.totalViolations / 7
    const recent24hCount = recent24h.totalViolations

    if (recent24hCount > avgDaily7d * 1.5) return 'INCREASING'
    if (recent24hCount < avgDaily7d * 0.5) return 'DECREASING'
    return 'STABLE'
  }

  private async getActiveAlerts(): Promise<Array<{severity: string, message: string, timestamp: string}>> {
    // In a real implementation, this would fetch active alerts from storage
    return []
  }
}

// Export singleton instance for easy usage
export const dlpIntegration = new DLPIntegration()

// Export middleware factory
export function createDLPMiddleware(config?: Partial<DLPIntegrationConfig>) {
  const integration = new DLPIntegration(config)
  return integration.createDLPMiddleware()
}