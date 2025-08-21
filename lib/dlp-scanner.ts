/**
 * SECURITY CRITICAL: Data Loss Prevention (DLP) System
 * 
 * Provides comprehensive data loss prevention including:
 * - Sensitive data detection in requests/responses
 * - PII (Personally Identifiable Information) scanning
 * - Credit card, social security, and phone number detection
 * - Email address and IP address scanning
 * - Custom pattern matching for business-specific data
 * - Real-time monitoring and blocking
 * - Compliance reporting (GDPR, CCPA, HIPAA)
 * - Data classification and handling recommendations
 */

import { NextRequest, NextResponse } from 'next/server'
import { AuditLogger } from './audit-logger'

export interface DLPPattern {
  id: string
  name: string
  pattern: RegExp
  type: DLPDataType
  severity: DLPSeverity
  action: DLPAction
  description: string
  complianceFlags: string[]
}

export type DLPDataType = 
  | 'CREDIT_CARD'
  | 'SSN'
  | 'PHONE_NUMBER'
  | 'EMAIL'
  | 'IP_ADDRESS'
  | 'API_KEY'
  | 'DATABASE_CONNECTION'
  | 'ENCRYPTION_KEY'
  | 'PERSONAL_NAME'
  | 'ADDRESS'
  | 'DATE_OF_BIRTH'
  | 'MEDICAL_INFO'
  | 'FINANCIAL_INFO'
  | 'CUSTOM'

export type DLPSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type DLPAction = 'LOG' | 'BLOCK' | 'REDACT' | 'QUARANTINE' | 'ALERT'

export interface DLPMatch {
  pattern: DLPPattern
  value: string
  position: number
  context: string
  confidence: number
}

export interface DLPScanResult {
  hasViolations: boolean
  matches: DLPMatch[]
  riskScore: number
  recommendations: string[]
  blockedContent?: string
  redactedContent?: string
}

export interface DLPConfig {
  enableRealTimeScanning: boolean
  enableRequestScanning: boolean
  enableResponseScanning: boolean
  enableFileScanning: boolean
  blockOnViolation: boolean
  redactSensitiveData: boolean
  logAllMatches: boolean
  customPatterns: DLPPattern[]
  whitelist: string[]
  exemptPaths: string[]
}

export class DLPScanner {
  private auditLogger: AuditLogger
  private config: DLPConfig
  private patterns: DLPPattern[]

  constructor(config: Partial<DLPConfig> = {}) {
    this.auditLogger = new AuditLogger()
    this.config = {
      enableRealTimeScanning: true,
      enableRequestScanning: true,
      enableResponseScanning: true,
      enableFileScanning: true,
      blockOnViolation: true,
      redactSensitiveData: true,
      logAllMatches: true,
      customPatterns: [],
      whitelist: [],
      exemptPaths: ['/api/health', '/api/status'],
      ...config
    }
    this.patterns = this.initializePatterns()
  }

  /**
   * Scan request for sensitive data
   */
  async scanRequest(req: NextRequest): Promise<DLPScanResult> {
    if (!this.config.enableRequestScanning || this.isExemptPath(req)) {
      return this.createEmptyResult()
    }

    try {
      let content = ''

      // Extract content from different sources
      const url = new URL(req.url)
      
      // Scan URL parameters
      content += url.search || ''
      
      // Scan headers (selective - avoid scanning auth tokens that should be encrypted)
      const sensitiveHeaders = ['user-agent', 'referer', 'cookie']
      sensitiveHeaders.forEach(header => {
        const value = req.headers.get(header)
        if (value) content += ` ${value}`
      })

      // Scan body if available
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        try {
          const body = await req.clone().text()
          content += ` ${body}`
        } catch (error) {
          // Body might not be text or already consumed
          console.debug('Could not read request body for DLP scanning')
        }
      }

      const result = await this.scanContent(content, {
        source: 'REQUEST',
        method: req.method,
        path: url.pathname,
        userAgent: req.headers.get('user-agent') || 'unknown'
      })

      // Log if violations found
      if (result.hasViolations && this.config.logAllMatches) {
        await this.auditLogger.logEvent({
          eventType: 'SECURITY_INCIDENT',
          severity: this.getHighestSeverity(result.matches),
          action: 'DLP_VIOLATION_DETECTED',
          resource: 'REQUEST',
          details: {
            path: url.pathname,
            method: req.method,
            violationCount: result.matches.length,
            riskScore: result.riskScore,
            dataTypes: result.matches.map(m => m.pattern.type),
            recommendations: result.recommendations
          },
          outcome: 'BLOCKED'
        })
      }

      return result

    } catch (error) {
      console.error('DLP request scanning error:', error)
      return this.createEmptyResult()
    }
  }

  /**
   * Scan response for sensitive data
   */
  async scanResponse(response: NextResponse, req: NextRequest): Promise<DLPScanResult> {
    if (!this.config.enableResponseScanning || this.isExemptPath(req)) {
      return this.createEmptyResult()
    }

    try {
      // Only scan certain content types
      const contentType = response.headers.get('content-type') || ''
      const scannableTypes = ['application/json', 'text/html', 'text/plain', 'application/xml']
      
      if (!scannableTypes.some(type => contentType.includes(type))) {
        return this.createEmptyResult()
      }

      let content = ''

      // Extract response body
      try {
        const responseClone = response.clone()
        content = await responseClone.text()
      } catch (error) {
        console.debug('Could not read response body for DLP scanning')
        return this.createEmptyResult()
      }

      const result = await this.scanContent(content, {
        source: 'RESPONSE',
        contentType,
        path: new URL(req.url).pathname,
        statusCode: response.status
      })

      // Log if violations found
      if (result.hasViolations && this.config.logAllMatches) {
        await this.auditLogger.logEvent({
          eventType: 'DATA_ACCESS',
          severity: this.getHighestSeverity(result.matches),
          action: 'SENSITIVE_DATA_EXPOSURE',
          resource: 'RESPONSE',
          details: {
            path: new URL(req.url).pathname,
            statusCode: response.status,
            contentType,
            violationCount: result.matches.length,
            riskScore: result.riskScore,
            dataTypes: result.matches.map(m => m.pattern.type),
            recommendations: result.recommendations
          },
          outcome: 'SUCCESS' // Data was exposed
        })
      }

      return result

    } catch (error) {
      console.error('DLP response scanning error:', error)
      return this.createEmptyResult()
    }
  }

  /**
   * Scan arbitrary content for sensitive data
   */
  async scanContent(content: string, context: Record<string, any> = {}): Promise<DLPScanResult> {
    const matches: DLPMatch[] = []
    
    for (const pattern of this.patterns) {
      const regex = new RegExp(pattern.pattern, 'gi')
      let match

      while ((match = regex.exec(content)) !== null) {
        const matchValue = match[0]
        
        // Skip if whitelisted
        if (this.isWhitelisted(matchValue)) {
          continue
        }

        // Calculate confidence based on pattern type and context
        const confidence = this.calculateConfidence(pattern, matchValue, content, match.index)
        
        // Only include high-confidence matches
        if (confidence >= 0.7) {
          matches.push({
            pattern,
            value: matchValue,
            position: match.index,
            context: this.extractContext(content, match.index, 50),
            confidence
          })
        }
      }
    }

    const riskScore = this.calculateRiskScore(matches)
    const recommendations = this.generateRecommendations(matches)
    
    const result: DLPScanResult = {
      hasViolations: matches.length > 0,
      matches,
      riskScore,
      recommendations
    }

    // Apply redaction if configured
    if (this.config.redactSensitiveData && matches.length > 0) {
      result.redactedContent = this.redactContent(content, matches)
    }

    // Generate blocked content if configured
    if (this.config.blockOnViolation && matches.length > 0) {
      result.blockedContent = this.generateBlockedMessage(matches, context)
    }

    return result
  }

  /**
   * Scan file content
   */
  async scanFile(filePath: string, content: string): Promise<DLPScanResult> {
    if (!this.config.enableFileScanning) {
      return this.createEmptyResult()
    }

    const result = await this.scanContent(content, {
      source: 'FILE',
      filePath,
      fileType: this.getFileExtension(filePath)
    })

    if (result.hasViolations) {
      await this.auditLogger.logEvent({
        eventType: 'FILE_OPERATION',
        severity: this.getHighestSeverity(result.matches),
        action: 'SENSITIVE_DATA_IN_FILE',
        resource: 'FILE',
        resourceId: filePath,
        details: {
          filePath,
          violationCount: result.matches.length,
          riskScore: result.riskScore,
          dataTypes: result.matches.map(m => m.pattern.type)
        },
        outcome: 'SUCCESS'
      })
    }

    return result
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(dateFrom: Date, dateTo: Date): Promise<Record<string, any>> {
    const events = await this.auditLogger.queryEvents({
      eventTypes: ['SECURITY_INCIDENT', 'DATA_ACCESS', 'FILE_OPERATION'],
      dateFrom,
      dateTo
    })

    const dlpEvents = events.filter(event => 
      event.details?.violationCount || 
      event.action?.includes('DLP') ||
      event.action?.includes('SENSITIVE_DATA')
    )

    return {
      totalViolations: dlpEvents.length,
      violationsByType: this.groupBy(dlpEvents, event => event.details?.dataTypes?.[0] || 'UNKNOWN'),
      violationsBySeverity: this.groupBy(dlpEvents, event => event.severity),
      averageRiskScore: dlpEvents.reduce((sum, event) => sum + (event.details?.riskScore || 0), 0) / dlpEvents.length,
      complianceStatus: {
        GDPR: this.assessGDPRCompliance(dlpEvents),
        CCPA: this.assessCCPACompliance(dlpEvents),
        HIPAA: this.assessHIPAACompliance(dlpEvents)
      },
      topViolationSources: this.getTopSources(dlpEvents),
      recommendations: this.generateComplianceRecommendations(dlpEvents)
    }
  }

  /**
   * Private helper methods
   */
  private initializePatterns(): DLPPattern[] {
    const patterns: DLPPattern[] = [
      // Credit Card Numbers (Luhn algorithm validation would be added for higher accuracy)
      {
        id: 'credit-card-visa',
        name: 'Visa Credit Card',
        pattern: /\b4[0-9]{12}(?:[0-9]{3})?\b/,
        type: 'CREDIT_CARD',
        severity: 'CRITICAL',
        action: 'BLOCK',
        description: 'Visa credit card number detected',
        complianceFlags: ['PCI-DSS', 'GDPR']
      },
      {
        id: 'credit-card-mastercard',
        name: 'MasterCard Credit Card',
        pattern: /\b5[1-5][0-9]{14}\b/,
        type: 'CREDIT_CARD',
        severity: 'CRITICAL',
        action: 'BLOCK',
        description: 'MasterCard credit card number detected',
        complianceFlags: ['PCI-DSS', 'GDPR']
      },
      
      // Social Security Numbers (US format)
      {
        id: 'ssn-us',
        name: 'US Social Security Number',
        pattern: /\b\d{3}-?\d{2}-?\d{4}\b/,
        type: 'SSN',
        severity: 'CRITICAL',
        action: 'BLOCK',
        description: 'US Social Security Number detected',
        complianceFlags: ['GDPR', 'CCPA']
      },

      // Phone Numbers (international formats)
      {
        id: 'phone-us',
        name: 'US Phone Number',
        pattern: /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/,
        type: 'PHONE_NUMBER',
        severity: 'MEDIUM',
        action: 'REDACT',
        description: 'US phone number detected',
        complianceFlags: ['GDPR', 'CCPA']
      },
      {
        id: 'phone-uk',
        name: 'UK Phone Number',
        pattern: /\b(?:\+44|0)\s?[1-9]\d{8,9}\b/,
        type: 'PHONE_NUMBER',
        severity: 'MEDIUM',
        action: 'REDACT',
        description: 'UK phone number detected',
        complianceFlags: ['GDPR']
      },

      // Email Addresses
      {
        id: 'email-address',
        name: 'Email Address',
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
        type: 'EMAIL',
        severity: 'MEDIUM',
        action: 'REDACT',
        description: 'Email address detected',
        complianceFlags: ['GDPR', 'CCPA']
      },

      // IP Addresses
      {
        id: 'ip-v4',
        name: 'IPv4 Address',
        pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/,
        type: 'IP_ADDRESS',
        severity: 'LOW',
        action: 'LOG',
        description: 'IPv4 address detected',
        complianceFlags: ['GDPR']
      },

      // API Keys and Tokens
      {
        id: 'api-key-generic',
        name: 'Generic API Key',
        pattern: /\b[A-Za-z0-9]{32,}\b/,
        type: 'API_KEY',
        severity: 'HIGH',
        action: 'BLOCK',
        description: 'Potential API key detected',
        complianceFlags: []
      },
      {
        id: 'jwt-token',
        name: 'JWT Token',
        pattern: /eyJ[A-Za-z0-9_\/+-]*={0,2}\.[A-Za-z0-9_\/+-]*={0,2}\.[A-Za-z0-9_\/+-]*={0,2}/,
        type: 'API_KEY',
        severity: 'HIGH',
        action: 'BLOCK',
        description: 'JWT token detected',
        complianceFlags: []
      },

      // Database Connection Strings
      {
        id: 'db-connection-postgres',
        name: 'PostgreSQL Connection String',
        pattern: /postgresql:\/\/[^\s]+/,
        type: 'DATABASE_CONNECTION',
        severity: 'CRITICAL',
        action: 'BLOCK',
        description: 'PostgreSQL connection string detected',
        complianceFlags: []
      },

      // Encryption Keys
      {
        id: 'private-key',
        name: 'Private Key',
        pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE KEY-----/,
        type: 'ENCRYPTION_KEY',
        severity: 'CRITICAL',
        action: 'BLOCK',
        description: 'Private key detected',
        complianceFlags: []
      },

      // Personal Names (simple pattern - would need NLP for accuracy)
      {
        id: 'personal-name',
        name: 'Personal Name',
        pattern: /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/,
        type: 'PERSONAL_NAME',
        severity: 'LOW',
        action: 'LOG',
        description: 'Potential personal name detected',
        complianceFlags: ['GDPR', 'CCPA']
      },

      // Date of Birth patterns
      {
        id: 'dob-mmddyyyy',
        name: 'Date of Birth (MM/DD/YYYY)',
        pattern: /\b(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/(19|20)\d{2}\b/,
        type: 'DATE_OF_BIRTH',
        severity: 'HIGH',
        action: 'REDACT',
        description: 'Date of birth detected',
        complianceFlags: ['GDPR', 'CCPA']
      },

      ...this.config.customPatterns
    ]

    return patterns
  }

  private calculateConfidence(pattern: DLPPattern, value: string, content: string, position: number): number {
    let confidence = 0.8 // Base confidence

    // Pattern-specific confidence adjustments
    switch (pattern.type) {
      case 'CREDIT_CARD':
        // Would implement Luhn algorithm check here for higher confidence
        confidence = this.validateCreditCard(value) ? 0.95 : 0.3
        break
      case 'EMAIL':
        // Additional email validation
        confidence = this.validateEmail(value) ? 0.9 : 0.4
        break
      case 'PHONE_NUMBER':
        // Phone number format validation
        confidence = value.replace(/\D/g, '').length >= 10 ? 0.85 : 0.4
        break
      case 'API_KEY':
        // Context-based detection for API keys
        const context = this.extractContext(content, position, 100).toLowerCase()
        if (context.includes('api') || context.includes('key') || context.includes('token')) {
          confidence = 0.9
        } else {
          confidence = 0.5
        }
        break
      case 'PERSONAL_NAME':
        // Lower confidence for name detection without NLP
        confidence = 0.4
        break
    }

    return confidence
  }

  private calculateRiskScore(matches: DLPMatch[]): number {
    if (matches.length === 0) return 0

    let score = 0
    const severityScores = { LOW: 10, MEDIUM: 30, HIGH: 60, CRITICAL: 90 }

    for (const match of matches) {
      const baseScore = severityScores[match.pattern.severity]
      const confidenceMultiplier = match.confidence
      score += baseScore * confidenceMultiplier
    }

    // Normalize to 0-100 scale
    return Math.min(Math.round(score / matches.length), 100)
  }

  private generateRecommendations(matches: DLPMatch[]): string[] {
    const recommendations: string[] = []
    const dataTypes = new Set(matches.map(m => m.pattern.type))

    if (dataTypes.has('CREDIT_CARD')) {
      recommendations.push('Credit card numbers detected - ensure PCI-DSS compliance')
      recommendations.push('Implement tokenization for credit card data storage')
    }

    if (dataTypes.has('SSN')) {
      recommendations.push('Social Security Numbers detected - implement strong encryption')
      recommendations.push('Consider data minimization - collect only if necessary')
    }

    if (dataTypes.has('EMAIL') || dataTypes.has('PHONE_NUMBER')) {
      recommendations.push('PII detected - ensure GDPR/CCPA compliance')
      recommendations.push('Implement consent management for personal data')
    }

    if (dataTypes.has('API_KEY') || dataTypes.has('ENCRYPTION_KEY')) {
      recommendations.push('Credentials detected - rotate keys immediately')
      recommendations.push('Implement proper secret management system')
    }

    if (matches.length > 5) {
      recommendations.push('Multiple violations detected - conduct comprehensive security review')
    }

    return recommendations
  }

  private redactContent(content: string, matches: DLPMatch[]): string {
    let redacted = content

    // Sort matches by position (descending) to avoid position shifts
    const sortedMatches = matches.sort((a, b) => b.position - a.position)

    for (const match of sortedMatches) {
      const replacement = this.generateRedaction(match.pattern.type, match.value)
      redacted = redacted.substring(0, match.position) + 
                 replacement + 
                 redacted.substring(match.position + match.value.length)
    }

    return redacted
  }

  private generateRedaction(type: DLPDataType, originalValue: string): string {
    switch (type) {
      case 'CREDIT_CARD':
        return `****-****-****-${originalValue.slice(-4)}`
      case 'SSN':
        return 'XXX-XX-XXXX'
      case 'PHONE_NUMBER':
        return '***-***-****'
      case 'EMAIL':
        const [local, domain] = originalValue.split('@')
        return `${local.charAt(0)}***@${domain}`
      default:
        return '[REDACTED]'
    }
  }

  private generateBlockedMessage(matches: DLPMatch[], context: Record<string, any>): string {
    return `Content blocked due to sensitive data detection. ${matches.length} violation(s) found. Contact security team for assistance.`
  }

  private validateCreditCard(cardNumber: string): boolean {
    // Simplified Luhn algorithm check
    const digits = cardNumber.replace(/\D/g, '')
    if (digits.length < 13 || digits.length > 19) return false

    let sum = 0
    let alternate = false

    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits.charAt(i))

      if (alternate) {
        digit *= 2
        if (digit > 9) digit = (digit % 10) + 1
      }

      sum += digit
      alternate = !alternate
    }

    return sum % 10 === 0
  }

  private validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email) && email.length <= 254
  }

  private extractContext(content: string, position: number, contextLength: number): string {
    const start = Math.max(0, position - contextLength)
    const end = Math.min(content.length, position + contextLength)
    return content.substring(start, end)
  }

  private getFileExtension(filePath: string): string {
    return filePath.split('.').pop()?.toLowerCase() || ''
  }

  private isExemptPath(req: NextRequest): boolean {
    const path = new URL(req.url).pathname
    return this.config.exemptPaths.some(exemptPath => path.startsWith(exemptPath))
  }

  private isWhitelisted(value: string): boolean {
    return this.config.whitelist.some(pattern => {
      if (pattern.startsWith('/') && pattern.endsWith('/')) {
        // Regex pattern
        const regex = new RegExp(pattern.slice(1, -1))
        return regex.test(value)
      }
      return value.includes(pattern)
    })
  }

  private createEmptyResult(): DLPScanResult {
    return {
      hasViolations: false,
      matches: [],
      riskScore: 0,
      recommendations: []
    }
  }

  private getHighestSeverity(matches: DLPMatch[]): DLPSeverity {
    const severityOrder: DLPSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
    for (const severity of severityOrder) {
      if (matches.some(m => m.pattern.severity === severity)) {
        return severity
      }
    }
    return 'LOW'
  }

  private groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, number> {
    return array.reduce((acc, item) => {
      const key = keyFn(item)
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }

  private getTopSources(events: any[]): Array<{source: string, count: number}> {
    const sources = this.groupBy(events, event => event.details?.source || 'UNKNOWN')
    return Object.entries(sources)
      .map(([source, count]) => ({source, count}))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }

  private assessGDPRCompliance(events: any[]): string {
    const gdprViolations = events.filter(event => 
      event.details?.complianceFlags?.includes('GDPR')
    ).length
    
    if (gdprViolations === 0) return 'COMPLIANT'
    if (gdprViolations < 5) return 'MINOR_ISSUES'
    return 'NON_COMPLIANT'
  }

  private assessCCPACompliance(events: any[]): string {
    const ccpaViolations = events.filter(event => 
      event.details?.complianceFlags?.includes('CCPA')
    ).length
    
    if (ccpaViolations === 0) return 'COMPLIANT'
    if (ccpaViolations < 5) return 'MINOR_ISSUES'
    return 'NON_COMPLIANT'
  }

  private assessHIPAACompliance(events: any[]): string {
    const hipaaViolations = events.filter(event => 
      event.details?.complianceFlags?.includes('HIPAA')
    ).length
    
    if (hipaaViolations === 0) return 'COMPLIANT'
    return 'POTENTIAL_ISSUES'
  }

  private generateComplianceRecommendations(events: any[]): string[] {
    const recommendations: string[] = []
    
    if (events.length > 10) {
      recommendations.push('High volume of DLP violations - implement staff training program')
    }
    
    if (events.some(e => e.severity === 'CRITICAL')) {
      recommendations.push('Critical violations detected - conduct immediate security review')
    }
    
    recommendations.push('Regular DLP policy review and updates recommended')
    recommendations.push('Consider implementing automated remediation workflows')
    
    return recommendations
  }

  /**
   * Create DLP middleware for Next.js
   */
  static createDLPMiddleware(config: Partial<DLPConfig> = {}) {
    const scanner = new DLPScanner(config)
    
    return {
      scanner,
      scanRequest: (req: NextRequest) => scanner.scanRequest(req),
      scanResponse: (res: NextResponse, req: NextRequest) => scanner.scanResponse(res, req)
    }
  }
}