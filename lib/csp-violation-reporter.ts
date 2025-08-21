/**
 * SECURITY CRITICAL: Content Security Policy (CSP) Violation Reporter
 * 
 * Provides comprehensive CSP violation reporting and analysis:
 * - Real-time violation detection and reporting
 * - Violation categorization and risk assessment
 * - Automated incident response and alerting
 * - Performance impact monitoring
 * - Attack pattern recognition
 * - Compliance reporting for security audits
 */

export interface CSPViolation {
  'blocked-uri': string
  'column-number': number
  'disposition': 'enforce' | 'report'
  'document-uri': string
  'effective-directive': string
  'line-number': number
  'original-policy': string
  'referrer': string
  'sample': string
  'source-file': string
  'status-code': number
  'violated-directive': string
}

export interface ProcessedCSPViolation {
  id: string
  timestamp: Date
  violation: CSPViolation
  category: ViolationType
  severity: ViolationSeverity
  riskScore: number
  attackVector?: AttackVector
  userAgent: string
  ipAddress?: string
  sessionId?: string
  userId?: string
  isRecurring: boolean
  relatedViolations: string[]
}

export type ViolationType = 
  | 'SCRIPT_INJECTION'
  | 'STYLE_INJECTION' 
  | 'IFRAME_INJECTION'
  | 'OBJECT_INJECTION'
  | 'BASE_INJECTION'
  | 'FORM_INJECTION'
  | 'FONT_VIOLATION'
  | 'IMAGE_VIOLATION'
  | 'MEDIA_VIOLATION'
  | 'CONNECT_VIOLATION'
  | 'WORKER_VIOLATION'
  | 'MANIFEST_VIOLATION'
  | 'UNKNOWN'

export type ViolationSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type AttackVector = 
  | 'XSS_REFLECTED'
  | 'XSS_STORED' 
  | 'XSS_DOM'
  | 'CLICKJACKING'
  | 'DATA_EXFILTRATION'
  | 'CODE_INJECTION'
  | 'RESOURCE_HIJACKING'
  | 'UNKNOWN'

export interface ViolationPattern {
  pattern: RegExp
  category: ViolationType
  severity: ViolationSeverity
  attackVector?: AttackVector
  description: string
}

export interface CSPReporterConfig {
  enableReporting: boolean
  enableRealTimeAlerts: boolean
  enablePatternDetection: boolean
  enableRiskScoring: boolean
  maxReportsPerMinute: number
  reportingEndpoint: string
  alertThreshold: ViolationSeverity
  enableIncidentResponse: boolean
  retentionDays: number
  enablePerformanceMonitoring: boolean
}

const DEFAULT_CONFIG: CSPReporterConfig = {
  enableReporting: true,
  enableRealTimeAlerts: true,
  enablePatternDetection: true,
  enableRiskScoring: true,
  maxReportsPerMinute: 100,
  reportingEndpoint: '/api/security/csp-violations',
  alertThreshold: 'HIGH',
  enableIncidentResponse: true,
  retentionDays: 90,
  enablePerformanceMonitoring: true
}

// Known attack patterns
const VIOLATION_PATTERNS: ViolationPattern[] = [
  // Script injection patterns
  {
    pattern: /eval\(|setTimeout\(|setInterval\(|Function\(/i,
    category: 'SCRIPT_INJECTION',
    severity: 'CRITICAL',
    attackVector: 'XSS_DOM',
    description: 'JavaScript evaluation functions detected'
  },
  {
    pattern: /data:text\/javascript|data:application\/javascript/i,
    category: 'SCRIPT_INJECTION', 
    severity: 'HIGH',
    attackVector: 'XSS_REFLECTED',
    description: 'Data URI with JavaScript content'
  },
  {
    pattern: /javascript:|vbscript:|livescript:|mocha:/i,
    category: 'SCRIPT_INJECTION',
    severity: 'CRITICAL',
    attackVector: 'XSS_REFLECTED',
    description: 'Script protocol in URI'
  },

  // Style injection patterns
  {
    pattern: /expression\(|behavior:|url\(javascript:/i,
    category: 'STYLE_INJECTION',
    severity: 'HIGH',
    attackVector: 'XSS_DOM',
    description: 'CSS expression or behavior injection'
  },
  {
    pattern: /@import.*javascript:|@import.*data:/i,
    category: 'STYLE_INJECTION',
    severity: 'HIGH',
    attackVector: 'CODE_INJECTION',
    description: 'CSS import with dangerous protocol'
  },

  // Frame/Object injection
  {
    pattern: /srcdoc=.*<script/i,
    category: 'IFRAME_INJECTION',
    severity: 'HIGH',
    attackVector: 'XSS_STORED',
    description: 'Script injection via iframe srcdoc'
  },
  {
    pattern: /data:text\/html.*<script/i,
    category: 'IFRAME_INJECTION',
    severity: 'CRITICAL',
    attackVector: 'XSS_REFLECTED',
    description: 'HTML data URI with script content'
  },

  // Data exfiltration patterns
  {
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
    category: 'CONNECT_VIOLATION',
    severity: 'MEDIUM',
    attackVector: 'DATA_EXFILTRATION',
    description: 'Possible email address in violation (data exfiltration)'
  },
  {
    pattern: /token=|key=|password=|auth=/i,
    category: 'CONNECT_VIOLATION',
    severity: 'HIGH',
    attackVector: 'DATA_EXFILTRATION',
    description: 'Possible credentials in violation'
  },

  // Clickjacking attempts
  {
    pattern: /opacity\s*:\s*0|position\s*:\s*absolute.*z-index/i,
    category: 'STYLE_INJECTION',
    severity: 'MEDIUM',
    attackVector: 'CLICKJACKING',
    description: 'Possible clickjacking style injection'
  }
]

export class CSPViolationReporter {
  private config: CSPReporterConfig
  private reportQueue: ProcessedCSPViolation[] = []
  private reportCounts = new Map<string, number>()
  private lastReportTime = new Map<string, number>()
  private violationHistory = new Map<string, ProcessedCSPViolation[]>()
  private performanceMetrics = {
    totalReports: 0,
    processedReports: 0,
    alertsSent: 0,
    averageProcessingTime: 0
  }

  constructor(config: Partial<CSPReporterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.initializeReporting()
  }

  /**
   * Initialize CSP violation reporting
   */
  private initializeReporting(): void {
    if (!this.config.enableReporting || typeof window === 'undefined') {
      return
    }

    // Set up CSP violation event listener
    document.addEventListener('securitypolicyviolation', (event) => {
      this.handleViolationEvent(event)
    })

    // Legacy support for older browsers
    if ('SecurityPolicyViolationEvent' in window) {
      document.addEventListener('securitypolicyviolation', (event) => {
        this.handleViolationEvent(event as SecurityPolicyViolationEvent)
      })
    }

    // Set up periodic report processing
    setInterval(() => {
      this.processReportQueue()
    }, 5000) // Process every 5 seconds

    // Set up cleanup of old data
    setInterval(() => {
      this.cleanupOldData()
    }, 24 * 60 * 60 * 1000) // Daily cleanup
  }

  /**
   * Handle CSP violation event
   */
  private async handleViolationEvent(event: SecurityPolicyViolationEvent): Promise<void> {
    const startTime = performance.now()

    try {
      // Rate limiting check
      const violationKey = this.generateViolationKey(event)
      if (!this.checkRateLimit(violationKey)) {
        return
      }

      // Process the violation
      const processedViolation = await this.processViolation(event)

      // Add to queue for batch processing
      this.reportQueue.push(processedViolation)

      // Immediate alert for critical violations
      if (processedViolation.severity === 'CRITICAL' || 
          (processedViolation.severity === 'HIGH' && this.config.alertThreshold === 'HIGH')) {
        await this.sendImmediateAlert(processedViolation)
      }

      // Update performance metrics
      this.updatePerformanceMetrics(startTime)

    } catch (error) {
      console.error('Error handling CSP violation:', error)
    }
  }

  /**
   * Process individual CSP violation
   */
  private async processViolation(event: SecurityPolicyViolationEvent): Promise<ProcessedCSPViolation> {
    const violation: CSPViolation = {
      'blocked-uri': event.blockedURI,
      'column-number': event.columnNumber,
      'disposition': event.disposition as 'enforce' | 'report',
      'document-uri': event.documentURI,
      'effective-directive': event.effectiveDirective,
      'line-number': event.lineNumber,
      'original-policy': event.originalPolicy,
      'referrer': event.referrer || '',
      'sample': event.sample,
      'source-file': event.sourceFile || '',
      'status-code': event.statusCode,
      'violated-directive': event.violatedDirective
    }

    // Categorize violation
    const category = this.categorizeViolation(violation)
    const severity = this.calculateSeverity(violation, category)
    const riskScore = this.calculateRiskScore(violation, category, severity)
    const attackVector = this.detectAttackVector(violation)

    // Check for recurring violations
    const violationKey = this.generateViolationKey(event)
    const isRecurring = this.isRecurringViolation(violationKey)

    // Find related violations
    const relatedViolations = this.findRelatedViolations(violation)

    const processedViolation: ProcessedCSPViolation = {
      id: this.generateViolationId(),
      timestamp: new Date(),
      violation,
      category,
      severity,
      riskScore,
      attackVector,
      userAgent: navigator.userAgent,
      sessionId: this.getSessionId(),
      userId: await this.getCurrentUserId(),
      isRecurring,
      relatedViolations
    }

    // Store in history
    this.addToHistory(violationKey, processedViolation)

    return processedViolation
  }

  /**
   * Categorize violation based on violated directive and content
   */
  private categorizeViolation(violation: CSPViolation): ViolationType {
    const directive = violation['violated-directive'].toLowerCase()
    const blockedUri = violation['blocked-uri'].toLowerCase()
    const sample = violation.sample?.toLowerCase() || ''

    // Check against known patterns first
    for (const pattern of VIOLATION_PATTERNS) {
      const content = `${blockedUri} ${sample} ${violation['source-file']}`.toLowerCase()
      if (pattern.pattern.test(content)) {
        return pattern.category
      }
    }

    // Categorize by directive
    if (directive.includes('script-src')) return 'SCRIPT_INJECTION'
    if (directive.includes('style-src')) return 'STYLE_INJECTION'
    if (directive.includes('frame-src') || directive.includes('child-src')) return 'IFRAME_INJECTION'
    if (directive.includes('object-src')) return 'OBJECT_INJECTION'
    if (directive.includes('base-uri')) return 'BASE_INJECTION'
    if (directive.includes('form-action')) return 'FORM_INJECTION'
    if (directive.includes('font-src')) return 'FONT_VIOLATION'
    if (directive.includes('img-src')) return 'IMAGE_VIOLATION'
    if (directive.includes('media-src')) return 'MEDIA_VIOLATION'
    if (directive.includes('connect-src')) return 'CONNECT_VIOLATION'
    if (directive.includes('worker-src')) return 'WORKER_VIOLATION'
    if (directive.includes('manifest-src')) return 'MANIFEST_VIOLATION'

    return 'UNKNOWN'
  }

  /**
   * Calculate severity of violation
   */
  private calculateSeverity(violation: CSPViolation, category: ViolationType): ViolationSeverity {
    const blockedUri = violation['blocked-uri'].toLowerCase()
    const sample = violation.sample?.toLowerCase() || ''

    // Critical patterns
    if (blockedUri.includes('javascript:') || 
        blockedUri.includes('data:text/javascript') ||
        sample.includes('eval(') ||
        sample.includes('<script')) {
      return 'CRITICAL'
    }

    // High severity categories
    if (['SCRIPT_INJECTION', 'OBJECT_INJECTION', 'BASE_INJECTION'].includes(category)) {
      return 'HIGH'
    }

    // Medium severity
    if (['STYLE_INJECTION', 'IFRAME_INJECTION', 'FORM_INJECTION'].includes(category)) {
      return 'MEDIUM'
    }

    return 'LOW'
  }

  /**
   * Calculate risk score (0-100)
   */
  private calculateRiskScore(violation: CSPViolation, category: ViolationType, severity: ViolationSeverity): number {
    let score = 0

    // Base score from severity
    switch (severity) {
      case 'CRITICAL': score = 90; break
      case 'HIGH': score = 70; break
      case 'MEDIUM': score = 50; break
      case 'LOW': score = 30; break
    }

    // Increase score for dangerous content
    const content = `${violation['blocked-uri']} ${violation.sample || ''} ${violation['source-file'] || ''}`.toLowerCase()
    
    if (content.includes('eval(') || content.includes('javascript:')) score += 10
    if (content.includes('data:text/html')) score += 8
    if (content.includes('<script') || content.includes('<iframe')) score += 6
    if (content.includes('onerror') || content.includes('onload')) score += 5

    // Decrease score for common legitimate violations
    if (content.includes('google') || content.includes('facebook') || content.includes('twitter')) {
      score -= 10
    }

    // Increase score for internal/localhost sources (more suspicious)
    if (content.includes('localhost') || content.includes('127.0.0.1')) {
      score += 5
    }

    return Math.min(Math.max(score, 0), 100)
  }

  /**
   * Detect attack vector
   */
  private detectAttackVector(violation: CSPViolation): AttackVector | undefined {
    for (const pattern of VIOLATION_PATTERNS) {
      const content = `${violation['blocked-uri']} ${violation.sample || ''} ${violation['source-file'] || ''}`.toLowerCase()
      if (pattern.pattern.test(content) && pattern.attackVector) {
        return pattern.attackVector
      }
    }

    return undefined
  }

  /**
   * Process report queue
   */
  private async processReportQueue(): Promise<void> {
    if (this.reportQueue.length === 0) return

    const reports = this.reportQueue.splice(0, 50) // Process up to 50 at a time
    
    try {
      await this.sendReports(reports)
      this.performanceMetrics.processedReports += reports.length
    } catch (error) {
      console.error('Error processing report queue:', error)
      // Add failed reports back to queue for retry
      this.reportQueue.unshift(...reports)
    }
  }

  /**
   * Send reports to backend
   */
  private async sendReports(reports: ProcessedCSPViolation[]): Promise<void> {
    const response = await fetch(this.config.reportingEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        reports,
        metadata: {
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: new Date().toISOString()
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to send reports: ${response.status}`)
    }
  }

  /**
   * Send immediate alert for critical violations
   */
  private async sendImmediateAlert(violation: ProcessedCSPViolation): Promise<void> {
    if (!this.config.enableRealTimeAlerts) return

    try {
      await fetch('/api/security/csp-alert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          violation,
          alert: {
            type: 'CRITICAL_CSP_VIOLATION',
            message: `Critical CSP violation detected: ${violation.category}`,
            timestamp: new Date().toISOString()
          }
        })
      })

      this.performanceMetrics.alertsSent += 1
    } catch (error) {
      console.error('Failed to send immediate alert:', error)
    }
  }

  /**
   * Utility methods
   */
  private generateViolationKey(event: SecurityPolicyViolationEvent): string {
    return `${event.violatedDirective}-${event.blockedURI}-${event.sourceFile || 'inline'}`
  }

  private generateViolationId(): string {
    return `csp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private checkRateLimit(violationKey: string): boolean {
    const now = Date.now()
    const lastReport = this.lastReportTime.get(violationKey) || 0
    const count = this.reportCounts.get(violationKey) || 0

    // Reset count every minute
    if (now - lastReport > 60000) {
      this.reportCounts.set(violationKey, 1)
      this.lastReportTime.set(violationKey, now)
      return true
    }

    // Check rate limit
    if (count >= this.config.maxReportsPerMinute) {
      return false
    }

    this.reportCounts.set(violationKey, count + 1)
    return true
  }

  private isRecurringViolation(violationKey: string): boolean {
    const history = this.violationHistory.get(violationKey) || []
    return history.length > 1
  }

  private findRelatedViolations(violation: CSPViolation): string[] {
    const related: string[] = []
    const sourceFile = violation['source-file']
    
    if (sourceFile) {
      for (const [key, violations] of this.violationHistory) {
        if (violations.some(v => v.violation['source-file'] === sourceFile)) {
          related.push(violations[0].id)
        }
      }
    }

    return related
  }

  private addToHistory(key: string, violation: ProcessedCSPViolation): void {
    const history = this.violationHistory.get(key) || []
    history.push(violation)
    
    // Keep only recent violations
    if (history.length > 10) {
      history.shift()
    }
    
    this.violationHistory.set(key, history)
  }

  private getSessionId(): string | undefined {
    try {
      return sessionStorage.getItem('sessionId') || undefined
    } catch {
      return undefined
    }
  }

  private async getCurrentUserId(): Promise<string | undefined> {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const user = await response.json()
        return user.id
      }
    } catch {
      // Ignore errors
    }
    return undefined
  }

  private updatePerformanceMetrics(startTime: number): void {
    const processingTime = performance.now() - startTime
    this.performanceMetrics.totalReports += 1
    
    // Update average processing time
    const totalTime = this.performanceMetrics.averageProcessingTime * (this.performanceMetrics.totalReports - 1)
    this.performanceMetrics.averageProcessingTime = (totalTime + processingTime) / this.performanceMetrics.totalReports
  }

  private cleanupOldData(): void {
    const cutoffTime = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000)
    
    for (const [key, violations] of this.violationHistory) {
      const filteredViolations = violations.filter(v => v.timestamp.getTime() > cutoffTime)
      
      if (filteredViolations.length === 0) {
        this.violationHistory.delete(key)
      } else {
        this.violationHistory.set(key, filteredViolations)
      }
    }
  }

  /**
   * Public API methods
   */
  public getPerformanceMetrics() {
    return { ...this.performanceMetrics }
  }

  public getViolationHistory(limit = 100): ProcessedCSPViolation[] {
    const allViolations: ProcessedCSPViolation[] = []
    
    for (const violations of this.violationHistory.values()) {
      allViolations.push(...violations)
    }

    return allViolations
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit)
  }

  public generateReport(): Record<string, any> {
    const violations = this.getViolationHistory()
    
    return {
      summary: {
        totalViolations: violations.length,
        criticalViolations: violations.filter(v => v.severity === 'CRITICAL').length,
        highViolations: violations.filter(v => v.severity === 'HIGH').length,
        averageRiskScore: violations.reduce((sum, v) => sum + v.riskScore, 0) / violations.length || 0
      },
      categories: this.groupBy(violations, v => v.category),
      attackVectors: this.groupBy(violations, v => v.attackVector || 'UNKNOWN'),
      topSources: this.getTopSources(violations),
      performanceMetrics: this.performanceMetrics
    }
  }

  private groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, number> {
    return array.reduce((acc, item) => {
      const key = keyFn(item)
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }

  private getTopSources(violations: ProcessedCSPViolation[], limit = 10): Array<{source: string, count: number}> {
    const sources = this.groupBy(violations, v => v.violation['source-file'] || 'inline')
    
    return Object.entries(sources)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  }
}

// Export singleton instance
export const cspReporter = new CSPViolationReporter()

// Initialize if in browser environment
if (typeof window !== 'undefined') {
  // Auto-initialize with default config
  window.addEventListener('DOMContentLoaded', () => {
    // CSP reporter is already initialized in constructor
  })
}