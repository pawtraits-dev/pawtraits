/**
 * SECURITY CRITICAL: XSS Protection Utilities
 * 
 * Provides comprehensive protection against Cross-Site Scripting (XSS) attacks:
 * - Reflected XSS protection
 * - Stored XSS protection
 * - DOM-based XSS protection
 * - Content sanitization and validation
 * - Safe URL handling
 * - JavaScript execution prevention
 * - HTML attribute sanitization
 * - CSS injection protection
 */

import DOMPurify from 'isomorphic-dompurify'

export interface XSSProtectionConfig {
  enableStrictMode: boolean
  allowedTags: string[]
  allowedAttributes: Record<string, string[]>
  forbiddenPatterns: RegExp[]
  maxContentLength: number
  enableLogging: boolean
  allowDataUris: boolean
  allowExternalLinks: boolean
  safeDomains: string[]
}

export interface SanitizationResult {
  sanitized: string
  violations: XSSViolation[]
  blocked: boolean
  originalLength: number
  sanitizedLength: number
}

export interface XSSViolation {
  type: 'SCRIPT_TAG' | 'EVENT_HANDLER' | 'JAVASCRIPT_URI' | 'DATA_URI' | 'CSS_INJECTION' | 'HTML_INJECTION' | 'FORBIDDEN_PATTERN'
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  description: string
  content: string
  position?: number
}

export interface URLValidationResult {
  isValid: boolean
  isSafe: boolean
  violations: string[]
  sanitizedUrl?: string
}

// Default configuration
const DEFAULT_CONFIG: XSSProtectionConfig = {
  enableStrictMode: true,
  allowedTags: [
    'p', 'br', 'strong', 'em', 'u', 'i', 'b', 'span', 'div',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'a', 'img'
  ],
  allowedAttributes: {
    'a': ['href', 'title', 'target', 'rel'],
    'img': ['src', 'alt', 'title', 'width', 'height'],
    'blockquote': ['cite'],
    '*': ['class', 'id', 'data-*', 'aria-*']
  },
  forbiddenPatterns: [
    // JavaScript execution patterns
    /javascript:/gi,
    /data:text\/html/gi,
    /vbscript:/gi,
    
    // Event handlers
    /on\w+\s*=/gi,
    /on[a-z]+\s*:/gi,
    
    // Script tags and variants
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<\/?\s*script\b[^>]*>/gi,
    
    // Dangerous tags
    /<iframe\b[^>]*>/gi,
    /<object\b[^>]*>/gi,
    /<embed\b[^>]*>/gi,
    /<applet\b[^>]*>/gi,
    /<form\b[^>]*>/gi,
    
    // Style injection
    /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
    /style\s*=\s*['"]*[^'"]*expression\s*\([^)]*\)/gi,
    /style\s*=\s*['"]*[^'"]*javascript\s*:/gi,
    
    // Meta tags
    /<meta\b[^>]*>/gi,
    
    // Link tags
    /<link\b[^>]*>/gi,
    
    // Base tags
    /<base\b[^>]*>/gi,
    
    // Import statements
    /@import/gi,
    
    // Data exfiltration
    /document\.cookie/gi,
    /localStorage/gi,
    /sessionStorage/gi,
    /window\.location/gi,
    
    // Common XSS vectors
    /alert\s*\(/gi,
    /confirm\s*\(/gi,
    /prompt\s*\(/gi,
    /eval\s*\(/gi,
    /setTimeout\s*\(/gi,
    /setInterval\s*\(/gi,
    
    // HTML entity evasion
    /&#x?[0-9a-f]+;?/gi,
    /&[a-z]+;?/gi
  ],
  maxContentLength: 100000,
  enableLogging: true,
  allowDataUris: false,
  allowExternalLinks: true,
  safeDomains: ['localhost', 'pawtraits.com', 'www.pawtraits.com']
}

export class XSSProtector {
  private config: XSSProtectionConfig

  constructor(config: Partial<XSSProtectionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Sanitize HTML content against XSS attacks
   */
  sanitizeHTML(content: string, customConfig?: Partial<XSSProtectionConfig>): SanitizationResult {
    const config = customConfig ? { ...this.config, ...customConfig } : this.config
    const violations: XSSViolation[] = []
    const originalLength = content.length

    if (!content) {
      return {
        sanitized: '',
        violations: [],
        blocked: false,
        originalLength: 0,
        sanitizedLength: 0
      }
    }

    // Check content length
    if (content.length > config.maxContentLength) {
      violations.push({
        type: 'HTML_INJECTION',
        severity: 'MEDIUM',
        description: `Content exceeds maximum length (${content.length} > ${config.maxContentLength})`,
        content: content.substring(0, 100) + '...'
      })
      content = content.substring(0, config.maxContentLength)
    }

    // Check for forbidden patterns
    for (const pattern of config.forbiddenPatterns) {
      const matches = content.match(pattern)
      if (matches) {
        matches.forEach(match => {
          violations.push({
            type: this.categorizeViolation(match),
            severity: this.getSeverityForPattern(match),
            description: `Forbidden pattern detected: ${pattern.toString()}`,
            content: match,
            position: content.indexOf(match)
          })
        })
      }
    }

    // Configure DOMPurify
    const purifyConfig: any = {
      ALLOWED_TAGS: config.allowedTags,
      ALLOWED_ATTR: this.flattenAllowedAttributes(config.allowedAttributes),
      FORBID_ATTR: ['style', 'onerror', 'onload', 'onmouseover', 'onfocus', 'onblur'],
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'applet', 'form', 'input', 'meta', 'link', 'base'],
      ALLOW_DATA_ATTR: false,
      ALLOW_UNKNOWN_PROTOCOLS: false,
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false,
      SANITIZE_DOM: true,
      KEEP_CONTENT: false
    }

    if (config.enableStrictMode) {
      purifyConfig.FORBID_ATTR.push(...['class', 'id', 'style', 'onclick', 'onmouseover'])
      purifyConfig.ALLOWED_TAGS = purifyConfig.ALLOWED_TAGS.slice(0, 10) // Limit to basic tags
    }

    // Add hooks for custom validation
    DOMPurify.addHook('beforeSanitizeElements', (node: Element) => {
      // Check for suspicious attributes
      if (node.attributes) {
        for (let i = 0; i < node.attributes.length; i++) {
          const attr = node.attributes[i]
          if (this.isSuspiciousAttribute(attr.name, attr.value)) {
            violations.push({
              type: 'EVENT_HANDLER',
              severity: 'HIGH',
              description: `Suspicious attribute detected: ${attr.name}="${attr.value}"`,
              content: `${attr.name}="${attr.value}"`
            })
            node.removeAttribute(attr.name)
          }
        }
      }
    })

    DOMPurify.addHook('beforeSanitizeAttributes', (node: Element) => {
      // Sanitize URLs
      const urlAttributes = ['href', 'src', 'action', 'formaction', 'cite', 'background']
      urlAttributes.forEach(attr => {
        if (node.hasAttribute(attr)) {
          const url = node.getAttribute(attr)!
          const validationResult = this.validateURL(url)
          
          if (!validationResult.isSafe) {
            violations.push({
              type: 'JAVASCRIPT_URI',
              severity: 'CRITICAL',
              description: `Unsafe URL detected in ${attr}: ${url}`,
              content: url
            })
            
            if (validationResult.sanitizedUrl) {
              node.setAttribute(attr, validationResult.sanitizedUrl)
            } else {
              node.removeAttribute(attr)
            }
          }
        }
      })
    })

    // Sanitize content
    let sanitized: string
    try {
      sanitized = DOMPurify.sanitize(content, purifyConfig)
    } catch (error) {
      violations.push({
        type: 'HTML_INJECTION',
        severity: 'CRITICAL',
        description: `Sanitization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        content: content.substring(0, 200)
      })
      sanitized = '' // Block completely on sanitization failure
    } finally {
      DOMPurify.removeAllHooks()
    }

    // Post-sanitization validation
    if (sanitized !== content && sanitized.length < content.length * 0.5) {
      violations.push({
        type: 'HTML_INJECTION',
        severity: 'HIGH',
        description: 'Significant content removal during sanitization (>50% reduction)',
        content: 'Content heavily modified'
      })
    }

    const blocked = violations.some(v => v.severity === 'CRITICAL')

    if (config.enableLogging && violations.length > 0) {
      this.logXSSAttempt(violations)
    }

    return {
      sanitized: blocked ? '[CONTENT BLOCKED: XSS attempt detected]' : sanitized,
      violations,
      blocked,
      originalLength,
      sanitizedLength: sanitized.length
    }
  }

  /**
   * Sanitize text input to prevent XSS
   */
  sanitizeText(input: string): string {
    if (!input) return ''

    return input
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/data:/gi, '') // Remove data: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .replace(/['"]/g, (match) => match === '"' ? '&quot;' : '&#x27;') // Escape quotes
      .trim()
  }

  /**
   * Validate and sanitize URLs
   */
  validateURL(url: string): URLValidationResult {
    const violations: string[] = []
    let isValid = true
    let isSafe = true
    let sanitizedUrl: string | undefined

    if (!url) {
      return { isValid: false, isSafe: false, violations: ['Empty URL'] }
    }

    try {
      // Basic URL validation
      const urlObj = new URL(url, window.location.origin)
      
      // Check protocol
      const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:']
      if (!allowedProtocols.includes(urlObj.protocol)) {
        violations.push(`Unsafe protocol: ${urlObj.protocol}`)
        isSafe = false
        
        if (urlObj.protocol === 'javascript:' || urlObj.protocol === 'data:') {
          isValid = false
        }
      }

      // Check for JavaScript execution
      if (url.toLowerCase().includes('javascript:')) {
        violations.push('JavaScript protocol detected')
        isValid = false
        isSafe = false
      }

      // Check for data URIs
      if (url.toLowerCase().startsWith('data:')) {
        if (!this.config.allowDataUris) {
          violations.push('Data URI not allowed')
          isSafe = false
        } else if (url.toLowerCase().includes('data:text/html')) {
          violations.push('HTML data URI detected')
          isValid = false
          isSafe = false
        }
      }

      // Check domain safety for external links
      if (urlObj.origin !== window.location.origin && !this.config.allowExternalLinks) {
        violations.push('External links not allowed')
        isSafe = false
      } else if (urlObj.origin !== window.location.origin && this.config.safeDomains.length > 0) {
        const isDomainSafe = this.config.safeDomains.some(domain => 
          urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
        )
        
        if (!isDomainSafe) {
          violations.push(`Unsafe domain: ${urlObj.hostname}`)
          isSafe = false
        }
      }

      // Create sanitized URL if possible
      if (isValid && violations.length === 0) {
        sanitizedUrl = urlObj.toString()
      } else if (isValid) {
        // Try to create a safe version
        if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
          sanitizedUrl = urlObj.toString()
        }
      }

    } catch (error) {
      violations.push(`Invalid URL format: ${error instanceof Error ? error.message : 'Unknown error'}`)
      isValid = false
      isSafe = false
    }

    return {
      isValid,
      isSafe,
      violations,
      sanitizedUrl
    }
  }

  /**
   * Escape HTML entities
   */
  escapeHTML(text: string): string {
    if (!text) return ''

    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
  }

  /**
   * Remove all HTML tags
   */
  stripHTML(html: string): string {
    if (!html) return ''
    
    return html.replace(/<[^>]*>/g, '').trim()
  }

  /**
   * Sanitize CSS to prevent injection attacks
   */
  sanitizeCSS(css: string): string {
    if (!css) return ''

    const dangerousPatterns = [
      /javascript\s*:/gi,
      /expression\s*\(/gi,
      /url\s*\(\s*javascript/gi,
      /url\s*\(\s*data/gi,
      /@import/gi,
      /behavior\s*:/gi,
      /-moz-binding/gi,
      /vbscript\s*:/gi
    ]

    let sanitized = css

    dangerousPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '')
    })

    return sanitized.trim()
  }

  /**
   * Validate form input for XSS attempts
   */
  validateFormInput(input: Record<string, any>): { valid: boolean; violations: XSSViolation[]; sanitized: Record<string, any> } {
    const violations: XSSViolation[] = []
    const sanitized: Record<string, any> = {}

    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'string') {
        const result = this.sanitizeHTML(value, { enableStrictMode: true })
        sanitized[key] = result.sanitized
        violations.push(...result.violations)
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(item => 
          typeof item === 'string' ? this.sanitizeText(item) : item
        )
      } else {
        sanitized[key] = value
      }
    }

    return {
      valid: violations.length === 0,
      violations,
      sanitized
    }
  }

  /**
   * Private helper methods
   */
  private categorizeViolation(content: string): XSSViolation['type'] {
    const lowerContent = content.toLowerCase()
    
    if (lowerContent.includes('script')) return 'SCRIPT_TAG'
    if (lowerContent.includes('javascript:')) return 'JAVASCRIPT_URI'
    if (lowerContent.includes('data:')) return 'DATA_URI'
    if (lowerContent.includes('on') && lowerContent.includes('=')) return 'EVENT_HANDLER'
    if (lowerContent.includes('style')) return 'CSS_INJECTION'
    
    return 'FORBIDDEN_PATTERN'
  }

  private getSeverityForPattern(content: string): XSSViolation['severity'] {
    const criticalPatterns = ['javascript:', 'data:text/html', '<script', 'eval(', 'document.cookie']
    const highPatterns = ['on\w+=', '<iframe', '<object', 'expression(']
    
    const lowerContent = content.toLowerCase()
    
    if (criticalPatterns.some(pattern => lowerContent.includes(pattern))) return 'CRITICAL'
    if (highPatterns.some(pattern => new RegExp(pattern).test(lowerContent))) return 'HIGH'
    
    return 'MEDIUM'
  }

  private flattenAllowedAttributes(allowedAttrs: Record<string, string[]>): string[] {
    const flattened = new Set<string>()
    
    Object.values(allowedAttrs).forEach(attrs => {
      attrs.forEach(attr => flattened.add(attr))
    })
    
    return Array.from(flattened)
  }

  private isSuspiciousAttribute(name: string, value: string): boolean {
    const suspiciousNames = /^on\w+$/i
    const suspiciousValues = /javascript:|data:text\/html|vbscript:/i
    
    return suspiciousNames.test(name) || suspiciousValues.test(value)
  }

  private async logXSSAttempt(violations: XSSViolation[]): Promise<void> {
    try {
      await fetch('/api/security/xss-attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          violations,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href
        })
      })
    } catch (error) {
      console.error('Failed to log XSS attempt:', error)
    }
  }
}

// Export singleton instance
export const xssProtector = new XSSProtector()

// Utility functions for common use cases
export const sanitizeHTML = (content: string) => xssProtector.sanitizeHTML(content)
export const sanitizeText = (text: string) => xssProtector.sanitizeText(text)
export const escapeHTML = (text: string) => xssProtector.escapeHTML(text)
export const stripHTML = (html: string) => xssProtector.stripHTML(html)
export const validateURL = (url: string) => xssProtector.validateURL(url)
export const sanitizeCSS = (css: string) => xssProtector.sanitizeCSS(css)