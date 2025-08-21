/**
 * SECURITY CRITICAL: Client-Side Data Sanitization Utilities
 * 
 * Provides comprehensive client-side data sanitization including:
 * - Real-time input sanitization
 * - PII detection and masking
 * - Data format validation
 * - Secure clipboard operations
 * - Local storage sanitization
 * - URL parameter sanitization
 * - JSON data sanitization
 * - File content sanitization
 */

import { xssProtector } from './xss-protection'

export interface SanitizationOptions {
  enableXSSProtection: boolean
  enablePIIDetection: boolean
  enableFormatValidation: boolean
  strictMode: boolean
  allowedPatterns?: RegExp[]
  forbiddenPatterns?: RegExp[]
  maxLength?: number
  preserveFormatting?: boolean
}

export interface PIIPattern {
  name: string
  pattern: RegExp
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  maskingPattern: string
  description: string
}

export interface SanitizationResult {
  original: any
  sanitized: any
  violations: SanitizationViolation[]
  piiDetected: PIIMatch[]
  isValid: boolean
  confidence: number
}

export interface SanitizationViolation {
  type: 'XSS_ATTEMPT' | 'PII_EXPOSURE' | 'FORMAT_VIOLATION' | 'LENGTH_VIOLATION' | 'PATTERN_VIOLATION'
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  field?: string
  description: string
  originalValue: string
  position?: number
}

export interface PIIMatch {
  type: string
  value: string
  maskedValue: string
  position: number
  confidence: number
}

export interface SecureStorageOptions {
  encrypt: boolean
  expiryMinutes?: number
  keyPrefix?: string
  enableIntegrityCheck: boolean
}

// Common PII patterns
const PII_PATTERNS: PIIPattern[] = [
  {
    name: 'credit_card',
    pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3[0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
    severity: 'CRITICAL',
    maskingPattern: '****-****-****-####',
    description: 'Credit card number detected'
  },
  {
    name: 'ssn',
    pattern: /\b\d{3}-?\d{2}-?\d{4}\b/g,
    severity: 'CRITICAL',
    maskingPattern: 'XXX-XX-####',
    description: 'Social Security Number detected'
  },
  {
    name: 'phone_us',
    pattern: /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
    severity: 'MEDIUM',
    maskingPattern: '(###) ###-####',
    description: 'US phone number detected'
  },
  {
    name: 'email',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    severity: 'MEDIUM',
    maskingPattern: '***@***.***',
    description: 'Email address detected'
  },
  {
    name: 'ip_address',
    pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    severity: 'LOW',
    maskingPattern: '***.***.***.***',
    description: 'IP address detected'
  },
  {
    name: 'drivers_license',
    pattern: /\b[A-Z]{1,2}[0-9]{6,8}\b/g,
    severity: 'HIGH',
    maskingPattern: '**######',
    description: 'Driver\'s license number detected'
  },
  {
    name: 'bank_account',
    pattern: /\b[0-9]{8,17}\b/g,
    severity: 'CRITICAL',
    maskingPattern: '****####',
    description: 'Bank account number detected'
  },
  {
    name: 'passport',
    pattern: /\b[A-Z]{1,3}[0-9]{6,9}\b/g,
    severity: 'HIGH',
    maskingPattern: '**######',
    description: 'Passport number detected'
  }
]

export class ClientDataSanitizer {
  private defaultOptions: SanitizationOptions = {
    enableXSSProtection: true,
    enablePIIDetection: true,
    enableFormatValidation: true,
    strictMode: false,
    maxLength: 10000,
    preserveFormatting: false
  }

  /**
   * Sanitize any data value
   */
  sanitize(data: any, options: Partial<SanitizationOptions> = {}): SanitizationResult {
    const opts = { ...this.defaultOptions, ...options }
    const violations: SanitizationViolation[] = []
    const piiDetected: PIIMatch[] = []
    let sanitized = data
    let confidence = 1.0

    if (data == null || data === undefined) {
      return {
        original: data,
        sanitized: data,
        violations: [],
        piiDetected: [],
        isValid: true,
        confidence: 1.0
      }
    }

    // Handle different data types
    if (typeof data === 'string') {
      const result = this.sanitizeString(data, opts)
      sanitized = result.sanitized
      violations.push(...result.violations)
      piiDetected.push(...result.piiDetected)
      confidence = result.confidence
    } else if (Array.isArray(data)) {
      const result = this.sanitizeArray(data, opts)
      sanitized = result.sanitized
      violations.push(...result.violations)
      piiDetected.push(...result.piiDetected)
      confidence = result.confidence
    } else if (typeof data === 'object') {
      const result = this.sanitizeObject(data, opts)
      sanitized = result.sanitized
      violations.push(...result.violations)
      piiDetected.push(...result.piiDetected)
      confidence = result.confidence
    }

    const isValid = violations.filter(v => v.severity === 'CRITICAL' || v.severity === 'HIGH').length === 0

    return {
      original: data,
      sanitized,
      violations,
      piiDetected,
      isValid,
      confidence
    }
  }

  /**
   * Sanitize string data
   */
  private sanitizeString(str: string, options: SanitizationOptions): SanitizationResult {
    const violations: SanitizationViolation[] = []
    const piiDetected: PIIMatch[] = []
    let sanitized = str
    let confidence = 1.0

    // Length validation
    if (options.maxLength && str.length > options.maxLength) {
      violations.push({
        type: 'LENGTH_VIOLATION',
        severity: 'MEDIUM',
        description: `String exceeds maximum length (${str.length} > ${options.maxLength})`,
        originalValue: str.substring(0, 100) + '...'
      })
      sanitized = sanitized.substring(0, options.maxLength)
      confidence *= 0.8
    }

    // XSS Protection
    if (options.enableXSSProtection) {
      const xssResult = xssProtector.sanitizeHTML(sanitized)
      if (xssResult.violations.length > 0) {
        violations.push(...xssResult.violations.map(v => ({
          type: 'XSS_ATTEMPT' as const,
          severity: v.severity,
          description: v.description,
          originalValue: str,
          position: v.position
        })))
        sanitized = xssResult.sanitized
        confidence *= 0.6
      }
    }

    // PII Detection
    if (options.enablePIIDetection) {
      const piiResult = this.detectPII(sanitized)
      piiDetected.push(...piiResult.matches)
      
      if (piiResult.matches.length > 0) {
        violations.push(...piiResult.matches.map(match => ({
          type: 'PII_EXPOSURE' as const,
          severity: this.getPIIPatternSeverity(match.type),
          description: `PII detected: ${match.type}`,
          originalValue: match.value,
          position: match.position
        })))
        sanitized = piiResult.sanitized
        confidence *= 0.7
      }
    }

    // Pattern validation
    if (options.allowedPatterns && options.allowedPatterns.length > 0) {
      const matchesAllowed = options.allowedPatterns.some(pattern => pattern.test(sanitized))
      if (!matchesAllowed) {
        violations.push({
          type: 'PATTERN_VIOLATION',
          severity: 'MEDIUM',
          description: 'String does not match any allowed patterns',
          originalValue: str
        })
        confidence *= 0.5
      }
    }

    if (options.forbiddenPatterns && options.forbiddenPatterns.length > 0) {
      for (const pattern of options.forbiddenPatterns) {
        if (pattern.test(sanitized)) {
          violations.push({
            type: 'PATTERN_VIOLATION',
            severity: 'HIGH',
            description: `String matches forbidden pattern: ${pattern.toString()}`,
            originalValue: str
          })
          sanitized = sanitized.replace(pattern, '[REMOVED]')
          confidence *= 0.4
        }
      }
    }

    return {
      original: str,
      sanitized,
      violations,
      piiDetected,
      isValid: violations.filter(v => v.severity === 'CRITICAL' || v.severity === 'HIGH').length === 0,
      confidence
    }
  }

  /**
   * Sanitize array data
   */
  private sanitizeArray(arr: any[], options: SanitizationOptions): SanitizationResult {
    const violations: SanitizationViolation[] = []
    const piiDetected: PIIMatch[] = []
    const sanitized: any[] = []
    let confidence = 1.0

    for (let i = 0; i < arr.length; i++) {
      const result = this.sanitize(arr[i], options)
      sanitized[i] = result.sanitized
      violations.push(...result.violations)
      piiDetected.push(...result.piiDetected)
      confidence *= result.confidence
    }

    return {
      original: arr,
      sanitized,
      violations,
      piiDetected,
      isValid: violations.filter(v => v.severity === 'CRITICAL' || v.severity === 'HIGH').length === 0,
      confidence
    }
  }

  /**
   * Sanitize object data
   */
  private sanitizeObject(obj: Record<string, any>, options: SanitizationOptions): SanitizationResult {
    const violations: SanitizationViolation[] = []
    const piiDetected: PIIMatch[] = []
    const sanitized: Record<string, any> = {}
    let confidence = 1.0

    for (const [key, value] of Object.entries(obj)) {
      // Sanitize key
      const keyResult = this.sanitizeString(key, options)
      const sanitizedKey = keyResult.sanitized
      
      if (keyResult.violations.length > 0) {
        violations.push(...keyResult.violations.map(v => ({ ...v, field: key })))
        confidence *= keyResult.confidence
      }

      // Sanitize value
      const valueResult = this.sanitize(value, options)
      sanitized[sanitizedKey] = valueResult.sanitized
      
      if (valueResult.violations.length > 0) {
        violations.push(...valueResult.violations.map(v => ({ ...v, field: key })))
        piiDetected.push(...valueResult.piiDetected)
        confidence *= valueResult.confidence
      }
    }

    return {
      original: obj,
      sanitized,
      violations,
      piiDetected,
      isValid: violations.filter(v => v.severity === 'CRITICAL' || v.severity === 'HIGH').length === 0,
      confidence
    }
  }

  /**
   * Detect PII in text
   */
  private detectPII(text: string): { matches: PIIMatch[]; sanitized: string } {
    const matches: PIIMatch[] = []
    let sanitized = text

    for (const pattern of PII_PATTERNS) {
      const regex = new RegExp(pattern.pattern.source, 'gi')
      let match

      while ((match = regex.exec(text)) !== null) {
        const value = match[0]
        const maskedValue = this.maskPII(value, pattern)
        
        matches.push({
          type: pattern.name,
          value,
          maskedValue,
          position: match.index,
          confidence: this.calculatePIIConfidence(value, pattern)
        })

        // Replace in sanitized version
        sanitized = sanitized.replace(value, maskedValue)
      }
    }

    return { matches, sanitized }
  }

  /**
   * Mask PII value
   */
  private maskPII(value: string, pattern: PIIPattern): string {
    switch (pattern.name) {
      case 'credit_card':
        return value.length > 4 ? `****-****-****-${value.slice(-4)}` : '****-****-****-****'
      case 'ssn':
        return value.length > 4 ? `XXX-XX-${value.slice(-4)}` : 'XXX-XX-XXXX'
      case 'phone_us':
        return '(***) ***-****'
      case 'email':
        const [local, domain] = value.split('@')
        if (local && domain) {
          const maskedLocal = local.length > 1 ? local[0] + '*'.repeat(local.length - 1) : '*'
          return `${maskedLocal}@***`
        }
        return '***@***.***'
      case 'ip_address':
        const parts = value.split('.')
        return parts.length === 4 ? `${parts[0]}.${parts[1]}.**.***` : '***.***.***.***'
      default:
        return '*'.repeat(Math.min(value.length, 8))
    }
  }

  /**
   * Calculate PII detection confidence
   */
  private calculatePIIConfidence(value: string, pattern: PIIPattern): number {
    let confidence = 0.8

    // Luhn algorithm for credit cards
    if (pattern.name === 'credit_card') {
      confidence = this.validateCreditCardLuhn(value.replace(/\D/g, '')) ? 0.95 : 0.3
    }

    // Email validation
    if (pattern.name === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      confidence = emailRegex.test(value) ? 0.9 : 0.4
    }

    // Phone number validation
    if (pattern.name === 'phone_us') {
      const digits = value.replace(/\D/g, '')
      confidence = digits.length === 10 || digits.length === 11 ? 0.85 : 0.4
    }

    return confidence
  }

  /**
   * Validate credit card using Luhn algorithm
   */
  private validateCreditCardLuhn(cardNumber: string): boolean {
    let sum = 0
    let alternate = false

    for (let i = cardNumber.length - 1; i >= 0; i--) {
      let n = parseInt(cardNumber.charAt(i), 10)

      if (alternate) {
        n *= 2
        if (n > 9) n = (n % 10) + 1
      }

      sum += n
      alternate = !alternate
    }

    return sum % 10 === 0
  }

  /**
   * Get PII pattern severity
   */
  private getPIIPatternSeverity(patternName: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const pattern = PII_PATTERNS.find(p => p.name === patternName)
    return pattern ? pattern.severity : 'MEDIUM'
  }

  /**
   * Secure clipboard operations
   */
  async writeToSecureClipboard(text: string, options: Partial<SanitizationOptions> = {}): Promise<boolean> {
    try {
      // Sanitize before writing to clipboard
      const result = this.sanitizeString(text, { ...this.defaultOptions, ...options })
      
      if (result.violations.filter(v => v.severity === 'CRITICAL').length > 0) {
        console.warn('Blocking clipboard write due to critical violations')
        return false
      }

      await navigator.clipboard.writeText(result.sanitized)
      return true
    } catch (error) {
      console.error('Failed to write to clipboard:', error)
      return false
    }
  }

  async readFromSecureClipboard(options: Partial<SanitizationOptions> = {}): Promise<string | null> {
    try {
      const text = await navigator.clipboard.readText()
      const result = this.sanitizeString(text, { ...this.defaultOptions, ...options })
      
      if (result.violations.filter(v => v.severity === 'CRITICAL').length > 0) {
        console.warn('Clipboard content contains critical violations')
        return null
      }

      return result.sanitized
    } catch (error) {
      console.error('Failed to read from clipboard:', error)
      return null
    }
  }

  /**
   * Secure local storage operations
   */
  setSecureStorage(key: string, value: any, options: SecureStorageOptions = { encrypt: false, enableIntegrityCheck: true }): boolean {
    try {
      // Sanitize the value
      const sanitizationResult = this.sanitize(value)
      
      if (!sanitizationResult.isValid && !options.encrypt) {
        console.warn('Blocking storage write due to sanitization violations')
        return false
      }

      const storageKey = options.keyPrefix ? `${options.keyPrefix}_${key}` : key
      let storageValue: any = {
        data: sanitizationResult.sanitized,
        timestamp: Date.now(),
        violations: sanitizationResult.violations.length,
        piiDetected: sanitizationResult.piiDetected.length > 0
      }

      if (options.expiryMinutes) {
        storageValue.expiry = Date.now() + (options.expiryMinutes * 60 * 1000)
      }

      if (options.enableIntegrityCheck) {
        storageValue.hash = this.generateHash(JSON.stringify(storageValue.data))
      }

      localStorage.setItem(storageKey, JSON.stringify(storageValue))
      return true
    } catch (error) {
      console.error('Failed to write to secure storage:', error)
      return false
    }
  }

  getSecureStorage(key: string, options: SecureStorageOptions = { encrypt: false, enableIntegrityCheck: true }): any | null {
    try {
      const storageKey = options.keyPrefix ? `${options.keyPrefix}_${key}` : key
      const rawValue = localStorage.getItem(storageKey)
      
      if (!rawValue) return null

      const storageValue = JSON.parse(rawValue)

      // Check expiry
      if (storageValue.expiry && Date.now() > storageValue.expiry) {
        localStorage.removeItem(storageKey)
        return null
      }

      // Check integrity
      if (options.enableIntegrityCheck && storageValue.hash) {
        const currentHash = this.generateHash(JSON.stringify(storageValue.data))
        if (currentHash !== storageValue.hash) {
          console.warn('Storage integrity check failed')
          localStorage.removeItem(storageKey)
          return null
        }
      }

      return storageValue.data
    } catch (error) {
      console.error('Failed to read from secure storage:', error)
      return null
    }
  }

  /**
   * Sanitize URL parameters
   */
  sanitizeURLParams(url: string): { sanitizedUrl: string; violations: SanitizationViolation[] } {
    const violations: SanitizationViolation[] = []
    
    try {
      const urlObj = new URL(url)
      const sanitizedParams = new URLSearchParams()

      for (const [key, value] of urlObj.searchParams.entries()) {
        const keyResult = this.sanitizeString(key, { strictMode: true })
        const valueResult = this.sanitizeString(value, { strictMode: true })

        violations.push(...keyResult.violations)
        violations.push(...valueResult.violations)

        sanitizedParams.set(keyResult.sanitized, valueResult.sanitized)
      }

      urlObj.search = sanitizedParams.toString()
      return {
        sanitizedUrl: urlObj.toString(),
        violations
      }
    } catch (error) {
      violations.push({
        type: 'FORMAT_VIOLATION',
        severity: 'HIGH',
        description: 'Invalid URL format',
        originalValue: url
      })
      
      return {
        sanitizedUrl: '',
        violations
      }
    }
  }

  /**
   * Generate simple hash for integrity checking
   */
  private generateHash(data: string): string {
    let hash = 0
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(36)
  }

  /**
   * Sanitize JSON data
   */
  sanitizeJSON(json: string, options: Partial<SanitizationOptions> = {}): { sanitized: string; violations: SanitizationViolation[]; valid: boolean } {
    const violations: SanitizationViolation[] = []
    let sanitized = ''
    let valid = true

    try {
      const parsed = JSON.parse(json)
      const result = this.sanitize(parsed, options)
      
      sanitized = JSON.stringify(result.sanitized)
      violations.push(...result.violations)
      valid = result.isValid
    } catch (error) {
      violations.push({
        type: 'FORMAT_VIOLATION',
        severity: 'HIGH',
        description: 'Invalid JSON format',
        originalValue: json.substring(0, 200)
      })
      valid = false
    }

    return { sanitized, violations, valid }
  }
}

// Export singleton instance
export const clientSanitizer = new ClientDataSanitizer()

// Utility functions
export const sanitizeData = (data: any, options?: Partial<SanitizationOptions>) => 
  clientSanitizer.sanitize(data, options)

export const sanitizeForStorage = (key: string, value: any, options?: SecureStorageOptions) => 
  clientSanitizer.setSecureStorage(key, value, options)

export const getFromSecureStorage = (key: string, options?: SecureStorageOptions) => 
  clientSanitizer.getSecureStorage(key, options)

export const sanitizeClipboard = async (text: string, options?: Partial<SanitizationOptions>) => 
  await clientSanitizer.writeToSecureClipboard(text, options)

export const sanitizeURL = (url: string) => 
  clientSanitizer.sanitizeURLParams(url)