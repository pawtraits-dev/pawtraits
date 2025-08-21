/**
 * SECURITY CRITICAL: Comprehensive Audit Logging System
 * 
 * Provides enterprise-grade audit logging for:
 * - Sensitive operations and data access
 * - User authentication and authorization events
 * - Data modification and deletion tracking
 * - System security events and incidents
 * - Compliance reporting (GDPR, CCPA, SOX, etc.)
 * - Forensic investigation support
 */

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export interface AuditEvent {
  id?: string
  timestamp: string
  eventType: AuditEventType
  severity: AuditSeverity
  userId?: string
  sessionId?: string
  ipAddress?: string
  userAgent?: string
  resource?: string
  action: string
  resourceId?: string
  details: Record<string, any>
  outcome: AuditOutcome
  riskScore?: number
  complianceFlags?: string[]
}

export type AuditEventType = 
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'DATA_ACCESS'
  | 'DATA_MODIFICATION'
  | 'DATA_DELETION'
  | 'SYSTEM_ACCESS'
  | 'SECURITY_INCIDENT'
  | 'PRIVACY_EVENT'
  | 'COMPLIANCE_EVENT'
  | 'ADMIN_ACTION'
  | 'API_ACCESS'
  | 'FILE_OPERATION'
  | 'PAYMENT_EVENT'

export type AuditSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type AuditOutcome = 'SUCCESS' | 'FAILURE' | 'PARTIAL' | 'BLOCKED'

export interface AuditRule {
  id: string
  eventType: AuditEventType
  conditions: AuditCondition[]
  actions: AuditAction[]
  isActive: boolean
  priority: number
}

export interface AuditCondition {
  field: string
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in'
  value: any
}

export interface AuditAction {
  type: 'ALERT' | 'NOTIFY' | 'BLOCK' | 'LOG' | 'REPORT'
  target?: string
  parameters?: Record<string, any>
}

export interface AuditQuery {
  eventTypes?: AuditEventType[]
  severities?: AuditSeverity[]
  outcomes?: AuditOutcome[]
  userId?: string
  dateFrom?: Date
  dateTo?: Date
  resource?: string
  ipAddress?: string
  limit?: number
  offset?: number
}

export interface AuditReport {
  totalEvents: number
  eventsByType: Record<AuditEventType, number>
  eventsBySeverity: Record<AuditSeverity, number>
  eventsByOutcome: Record<AuditOutcome, number>
  topUsers: Array<{ userId: string; eventCount: number }>
  topIPs: Array<{ ipAddress: string; eventCount: number }>
  timeline: Array<{ date: string; eventCount: number }>
  riskEvents: AuditEvent[]
  complianceEvents: AuditEvent[]
}

export class AuditLogger {
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  private rules: AuditRule[] = []
  private retentionPeriodDays = 2555 // 7 years default for compliance

  constructor() {
    this.initializeDefaultRules()
  }

  /**
   * Log audit event
   */
  async logEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<string | null> {
    try {
      const auditEvent: AuditEvent = {
        ...event,
        timestamp: new Date().toISOString(),
        riskScore: this.calculateRiskScore(event),
        complianceFlags: this.determineComplianceFlags(event)
      }

      // Store in database
      const { data, error } = await this.supabase
        .from('audit_events')
        .insert({
          event_type: auditEvent.eventType,
          severity: auditEvent.severity,
          user_id: auditEvent.userId,
          session_id: auditEvent.sessionId,
          ip_address: auditEvent.ipAddress,
          user_agent: auditEvent.userAgent,
          resource: auditEvent.resource,
          action: auditEvent.action,
          resource_id: auditEvent.resourceId,
          event_details: auditEvent.details,
          outcome: auditEvent.outcome,
          risk_score: auditEvent.riskScore,
          compliance_flags: auditEvent.complianceFlags,
          timestamp: auditEvent.timestamp,
          created_at: new Date().toISOString()
        })
        .select('id')
        .single()

      if (error) {
        console.error('Failed to log audit event:', error)
        return null
      }

      // Process audit rules
      await this.processAuditRules(auditEvent)

      return data?.id || null

    } catch (error) {
      console.error('Audit logging error:', error)
      return null
    }
  }

  /**
   * Log authentication event
   */
  async logAuthEvent(
    req: NextRequest,
    action: string,
    userId?: string,
    outcome: AuditOutcome = 'SUCCESS',
    details: Record<string, any> = {}
  ): Promise<void> {
    await this.logEvent({
      eventType: 'AUTHENTICATION',
      severity: outcome === 'FAILURE' ? 'MEDIUM' : 'LOW',
      userId,
      ipAddress: this.extractIP(req),
      userAgent: req.headers.get('user-agent') || undefined,
      action,
      details: {
        ...details,
        endpoint: new URL(req.url).pathname,
        method: req.method
      },
      outcome
    })
  }

  /**
   * Log data access event
   */
  async logDataAccess(
    resource: string,
    action: string,
    userId?: string,
    resourceId?: string,
    outcome: AuditOutcome = 'SUCCESS',
    details: Record<string, any> = {}
  ): Promise<void> {
    await this.logEvent({
      eventType: 'DATA_ACCESS',
      severity: this.getSeverityForDataAccess(resource, action),
      userId,
      resource,
      action,
      resourceId,
      details,
      outcome
    })
  }

  /**
   * Log data modification event
   */
  async logDataModification(
    resource: string,
    action: string,
    userId: string,
    resourceId?: string,
    changes?: Record<string, { from: any; to: any }>,
    outcome: AuditOutcome = 'SUCCESS'
  ): Promise<void> {
    await this.logEvent({
      eventType: 'DATA_MODIFICATION',
      severity: 'MEDIUM',
      userId,
      resource,
      action,
      resourceId,
      details: {
        changes: changes || {},
        changeCount: changes ? Object.keys(changes).length : 0
      },
      outcome
    })
  }

  /**
   * Log security incident
   */
  async logSecurityIncident(
    incident: string,
    severity: AuditSeverity = 'HIGH',
    req?: NextRequest,
    details: Record<string, any> = {}
  ): Promise<void> {
    await this.logEvent({
      eventType: 'SECURITY_INCIDENT',
      severity,
      ipAddress: req ? this.extractIP(req) : undefined,
      userAgent: req?.headers.get('user-agent') || undefined,
      action: 'SECURITY_INCIDENT_DETECTED',
      details: {
        incident,
        ...details
      },
      outcome: 'BLOCKED'
    })
  }

  /**
   * Log privacy event (GDPR/CCPA)
   */
  async logPrivacyEvent(
    action: string,
    userId: string,
    dataTypes: string[],
    legalBasis?: string,
    outcome: AuditOutcome = 'SUCCESS'
  ): Promise<void> {
    await this.logEvent({
      eventType: 'PRIVACY_EVENT',
      severity: 'HIGH',
      userId,
      action,
      details: {
        dataTypes,
        legalBasis,
        regulation: 'GDPR/CCPA'
      },
      outcome,
      complianceFlags: ['GDPR', 'CCPA']
    })
  }

  /**
   * Log admin action
   */
  async logAdminAction(
    adminId: string,
    action: string,
    targetUserId?: string,
    resource?: string,
    details: Record<string, any> = {},
    outcome: AuditOutcome = 'SUCCESS'
  ): Promise<void> {
    await this.logEvent({
      eventType: 'ADMIN_ACTION',
      severity: 'HIGH',
      userId: adminId,
      resource,
      action,
      resourceId: targetUserId,
      details: {
        ...details,
        adminPrivilegeUsed: true
      },
      outcome
    })
  }

  /**
   * Log security violations
   */
  async logSecurityViolation(violation: {
    violation_type: string
    component: string
    details: any
  }): Promise<void> {
    try {
      await this.logEvent({
        eventType: 'SECURITY_INCIDENT',
        severity: 'HIGH',
        action: 'SECURITY_VIOLATION',
        resource: violation.component,
        details: {
          violationType: violation.violation_type,
          component: violation.component,
          ...violation.details
        },
        outcome: 'BLOCKED'
      })
    } catch (error) {
      console.error('Failed to log security violation:', error)
      throw error
    }
  }

  /**
   * Query audit events
   */
  async queryEvents(query: AuditQuery): Promise<AuditEvent[]> {
    try {
      let supabaseQuery = this.supabase
        .from('audit_events')
        .select('*')
        .order('timestamp', { ascending: false })

      // Apply filters
      if (query.eventTypes && query.eventTypes.length > 0) {
        supabaseQuery = supabaseQuery.in('event_type', query.eventTypes)
      }

      if (query.severities && query.severities.length > 0) {
        supabaseQuery = supabaseQuery.in('severity', query.severities)
      }

      if (query.outcomes && query.outcomes.length > 0) {
        supabaseQuery = supabaseQuery.in('outcome', query.outcomes)
      }

      if (query.userId) {
        supabaseQuery = supabaseQuery.eq('user_id', query.userId)
      }

      if (query.resource) {
        supabaseQuery = supabaseQuery.eq('resource', query.resource)
      }

      if (query.ipAddress) {
        supabaseQuery = supabaseQuery.eq('ip_address', query.ipAddress)
      }

      if (query.dateFrom) {
        supabaseQuery = supabaseQuery.gte('timestamp', query.dateFrom.toISOString())
      }

      if (query.dateTo) {
        supabaseQuery = supabaseQuery.lte('timestamp', query.dateTo.toISOString())
      }

      if (query.limit) {
        supabaseQuery = supabaseQuery.limit(query.limit)
      }

      if (query.offset) {
        supabaseQuery = supabaseQuery.range(query.offset, query.offset + (query.limit || 100) - 1)
      }

      const { data, error } = await supabaseQuery

      if (error) {
        console.error('Failed to query audit events:', error)
        return []
      }

      return this.mapDatabaseToAuditEvents(data || [])

    } catch (error) {
      console.error('Audit query error:', error)
      return []
    }
  }

  /**
   * Generate audit report
   */
  async generateReport(query: AuditQuery): Promise<AuditReport> {
    try {
      const events = await this.queryEvents({ ...query, limit: 10000 }) // Large limit for report

      const report: AuditReport = {
        totalEvents: events.length,
        eventsByType: {} as Record<AuditEventType, number>,
        eventsBySeverity: {} as Record<AuditSeverity, number>,
        eventsByOutcome: {} as Record<AuditOutcome, number>,
        topUsers: [],
        topIPs: [],
        timeline: [],
        riskEvents: events.filter(e => (e.riskScore || 0) >= 80),
        complianceEvents: events.filter(e => e.complianceFlags && e.complianceFlags.length > 0)
      }

      // Count by type
      events.forEach(event => {
        report.eventsByType[event.eventType] = (report.eventsByType[event.eventType] || 0) + 1
        report.eventsBySeverity[event.severity] = (report.eventsBySeverity[event.severity] || 0) + 1
        report.eventsByOutcome[event.outcome] = (report.eventsByOutcome[event.outcome] || 0) + 1
      })

      // Top users
      const userCounts = new Map<string, number>()
      events.forEach(event => {
        if (event.userId) {
          userCounts.set(event.userId, (userCounts.get(event.userId) || 0) + 1)
        }
      })
      report.topUsers = Array.from(userCounts.entries())
        .map(([userId, eventCount]) => ({ userId, eventCount }))
        .sort((a, b) => b.eventCount - a.eventCount)
        .slice(0, 10)

      // Top IPs
      const ipCounts = new Map<string, number>()
      events.forEach(event => {
        if (event.ipAddress) {
          ipCounts.set(event.ipAddress, (ipCounts.get(event.ipAddress) || 0) + 1)
        }
      })
      report.topIPs = Array.from(ipCounts.entries())
        .map(([ipAddress, eventCount]) => ({ ipAddress, eventCount }))
        .sort((a, b) => b.eventCount - a.eventCount)
        .slice(0, 10)

      // Timeline (daily buckets)
      const dateCountsMap = new Map<string, number>()
      events.forEach(event => {
        const date = new Date(event.timestamp).toISOString().split('T')[0]
        dateCountsMap.set(date, (dateCountsMap.get(date) || 0) + 1)
      })
      report.timeline = Array.from(dateCountsMap.entries())
        .map(([date, eventCount]) => ({ date, eventCount }))
        .sort((a, b) => a.date.localeCompare(b.date))

      return report

    } catch (error) {
      console.error('Failed to generate audit report:', error)
      throw new Error('Failed to generate audit report')
    }
  }

  /**
   * Clean up old audit events based on retention policy
   */
  async cleanupExpiredEvents(): Promise<number> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionPeriodDays)

      const { data, error } = await this.supabase
        .from('audit_events')
        .delete()
        .lt('timestamp', cutoffDate.toISOString())
        .select('id')

      if (error) {
        console.error('Failed to cleanup expired audit events:', error)
        return 0
      }

      const deletedCount = data?.length || 0
      
      if (deletedCount > 0) {
        await this.logEvent({
          eventType: 'SYSTEM_ACCESS',
          severity: 'LOW',
          action: 'AUDIT_CLEANUP',
          details: {
            deletedCount,
            cutoffDate: cutoffDate.toISOString()
          },
          outcome: 'SUCCESS'
        })
      }

      return deletedCount

    } catch (error) {
      console.error('Audit cleanup error:', error)
      return 0
    }
  }

  /**
   * Private helper methods
   */
  private calculateRiskScore(event: Omit<AuditEvent, 'id' | 'timestamp'>): number {
    let score = 0

    // Base severity scoring
    switch (event.severity) {
      case 'LOW': score += 10; break
      case 'MEDIUM': score += 30; break
      case 'HIGH': score += 60; break
      case 'CRITICAL': score += 90; break
    }

    // Event type scoring
    switch (event.eventType) {
      case 'SECURITY_INCIDENT': score += 40; break
      case 'DATA_DELETION': score += 20; break
      case 'ADMIN_ACTION': score += 15; break
      case 'AUTHENTICATION': 
        if (event.outcome === 'FAILURE') score += 25
        break
    }

    // Outcome penalty
    if (event.outcome === 'FAILURE') score += 20
    if (event.outcome === 'BLOCKED') score += 30

    // Special conditions
    if (event.details?.suspiciousActivity) score += 25
    if (event.details?.multipleFailures) score += 20
    if (event.details?.privilegeEscalation) score += 35

    return Math.min(score, 100) // Cap at 100
  }

  private determineComplianceFlags(event: Omit<AuditEvent, 'id' | 'timestamp'>): string[] {
    const flags: string[] = []

    // GDPR/CCPA flags
    if (event.eventType === 'PRIVACY_EVENT') {
      flags.push('GDPR', 'CCPA')
    }

    if (event.eventType === 'DATA_ACCESS' || event.eventType === 'DATA_MODIFICATION') {
      if (this.isPIIResource(event.resource)) {
        flags.push('GDPR', 'CCPA')
      }
    }

    // SOX compliance for financial data
    if (event.resource === 'payments' || event.resource === 'financial_records') {
      flags.push('SOX')
    }

    // HIPAA for health-related data (if applicable)
    if (event.resource === 'health_records' || event.resource === 'medical_data') {
      flags.push('HIPAA')
    }

    return flags
  }

  private isPIIResource(resource?: string): boolean {
    const piiResources = ['users', 'customers', 'partners', 'contacts', 'addresses']
    return piiResources.includes(resource || '')
  }

  private getSeverityForDataAccess(resource: string, action: string): AuditSeverity {
    if (this.isPIIResource(resource)) {
      return action === 'delete' ? 'HIGH' : 'MEDIUM'
    }
    return 'LOW'
  }

  private extractIP(req: NextRequest): string {
    return req.headers.get('x-forwarded-for') || 
           req.headers.get('x-real-ip') || 
           'unknown'
  }

  private mapDatabaseToAuditEvents(data: any[]): AuditEvent[] {
    return data.map(record => ({
      id: record.id,
      timestamp: record.timestamp,
      eventType: record.event_type,
      severity: record.severity,
      userId: record.user_id,
      sessionId: record.session_id,
      ipAddress: record.ip_address,
      userAgent: record.user_agent,
      resource: record.resource,
      action: record.action,
      resourceId: record.resource_id,
      details: record.event_details,
      outcome: record.outcome,
      riskScore: record.risk_score,
      complianceFlags: record.compliance_flags
    }))
  }

  private async processAuditRules(event: AuditEvent): Promise<void> {
    // Process any configured audit rules
    // This is a placeholder for rule processing logic
    for (const rule of this.rules) {
      if (rule.isActive && this.matchesRule(event, rule)) {
        await this.executeRuleActions(event, rule)
      }
    }
  }

  private matchesRule(event: AuditEvent, rule: AuditRule): boolean {
    if (rule.eventType !== event.eventType) return false

    return rule.conditions.every(condition => {
      const fieldValue = (event as any)[condition.field]
      
      switch (condition.operator) {
        case 'equals': return fieldValue === condition.value
        case 'contains': return String(fieldValue).includes(condition.value)
        case 'greater_than': return fieldValue > condition.value
        case 'less_than': return fieldValue < condition.value
        case 'in': return condition.value.includes(fieldValue)
        case 'not_in': return !condition.value.includes(fieldValue)
        default: return false
      }
    })
  }

  private async executeRuleActions(event: AuditEvent, rule: AuditRule): Promise<void> {
    // Execute rule actions (alerts, notifications, etc.)
    for (const action of rule.actions) {
      switch (action.type) {
        case 'ALERT':
          console.warn(`AUDIT ALERT: Rule ${rule.id} triggered`, event)
          break
        case 'LOG':
          console.log(`AUDIT LOG: Rule ${rule.id} matched`, event)
          break
        // Additional action types would be implemented here
      }
    }
  }

  private initializeDefaultRules(): void {
    // Initialize with some default audit rules
    this.rules = [
      {
        id: 'high-risk-events',
        eventType: 'SECURITY_INCIDENT',
        conditions: [
          { field: 'severity', operator: 'in', value: ['HIGH', 'CRITICAL'] }
        ],
        actions: [
          { type: 'ALERT', target: 'security-team' }
        ],
        isActive: true,
        priority: 100
      }
    ]
  }

  /**
   * Create audit logging middleware
   */
  static createAuditMiddleware() {
    return (auditLogger: AuditLogger) => {
      return {
        logAuth: (req: NextRequest, action: string, userId?: string, outcome?: AuditOutcome) =>
          auditLogger.logAuthEvent(req, action, userId, outcome),
        
        logDataAccess: (resource: string, action: string, userId?: string, resourceId?: string) =>
          auditLogger.logDataAccess(resource, action, userId, resourceId),
        
        logSecurityIncident: (incident: string, req?: NextRequest, details?: Record<string, any>) =>
          auditLogger.logSecurityIncident(incident, 'HIGH', req, details)
      }
    }
  }
}