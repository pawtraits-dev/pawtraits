/**
 * SECURITY CRITICAL: React Component Security Wrapper
 * 
 * Provides comprehensive security protection for React components including:
 * - XSS prevention for dynamic content
 * - Input sanitization and validation
 * - Safe HTML rendering with DOMPurify
 * - Click-jacking protection
 * - Sensitive data handling
 * - Security event logging
 * - Performance monitoring for security operations
 */

'use client'

import React, { 
  ReactNode, 
  useEffect, 
  useRef, 
  useState, 
  useCallback,
  useMemo,
  createContext,
  useContext
} from 'react'
import DOMPurify from 'isomorphic-dompurify'
import { useRouter } from 'next/navigation'

export interface SecurityConfig {
  enableXSSProtection: boolean
  enableClickjackingProtection: boolean
  enableInputSanitization: boolean
  enableContentValidation: boolean
  enableSecurityLogging: boolean
  sanitizationLevel: 'strict' | 'moderate' | 'relaxed'
  allowedTags: string[]
  allowedAttributes: string[]
  forbiddenPatterns: RegExp[]
  sensitiveDataPatterns: RegExp[]
  maxContentLength: number
  enablePerformanceMonitoring: boolean
}

export interface SecurityViolation {
  type: 'XSS_ATTEMPT' | 'CLICKJACKING' | 'INVALID_INPUT' | 'SENSITIVE_DATA' | 'CONTENT_VIOLATION'
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  description: string
  content?: string
  component?: string
  timestamp: Date
  userAgent?: string
  url?: string
}

export interface SecureWrapperProps {
  children: ReactNode
  config?: Partial<SecurityConfig>
  componentName?: string
  sensitiveContent?: boolean
  allowUnsafeContent?: boolean
  onSecurityViolation?: (violation: SecurityViolation) => void
  className?: string
  'data-testid'?: string
}

// Default security configuration
const DEFAULT_CONFIG: SecurityConfig = {
  enableXSSProtection: true,
  enableClickjackingProtection: true,
  enableInputSanitization: true,
  enableContentValidation: true,
  enableSecurityLogging: true,
  sanitizationLevel: 'strict',
  allowedTags: [
    'p', 'br', 'strong', 'em', 'u', 'i', 'b', 'span', 'div',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'a', 'img'
  ],
  allowedAttributes: [
    'class', 'id', 'href', 'src', 'alt', 'title',
    'data-*', 'aria-*'
  ],
  forbiddenPatterns: [
    /javascript:/gi,
    /data:text\/html/gi,
    /vbscript:/gi,
    /on\w+\s*=/gi, // Event handlers
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^>]*>/gi,
    /<object\b[^>]*>/gi,
    /<embed\b[^>]*>/gi
  ],
  sensitiveDataPatterns: [
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/, // Credit card
    /\b\d{3}-\d{2}-\d{4}\b/, // SSN
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
    /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/ // Phone
  ],
  maxContentLength: 50000,
  enablePerformanceMonitoring: true
}

// Security Context
const SecurityContext = createContext<{
  config: SecurityConfig
  reportViolation: (violation: Omit<SecurityViolation, 'timestamp'>) => void
  sanitizeContent: (content: string) => string
}>({
  config: DEFAULT_CONFIG,
  reportViolation: () => {},
  sanitizeContent: (content: string) => content
})

export const useSecurityContext = () => useContext(SecurityContext)

/**
 * Main Security Wrapper Component
 */
export const SecureWrapper: React.FC<SecureWrapperProps> = ({
  children,
  config = {},
  componentName = 'UnknownComponent',
  sensitiveContent = false,
  allowUnsafeContent = false,
  onSecurityViolation,
  className,
  'data-testid': testId,
  ...props
}) => {
  const router = useRouter()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [isSecure, setIsSecure] = useState(true)
  const [violations, setViolations] = useState<SecurityViolation[]>([])
  const [performanceMetrics, setPerformanceMetrics] = useState<Record<string, number>>({})

  // Merge configuration
  const securityConfig = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...config }),
    [config]
  )

  /**
   * Report security violation
   */
  const reportViolation = useCallback((violation: Omit<SecurityViolation, 'timestamp'>) => {
    const fullViolation: SecurityViolation = {
      ...violation,
      timestamp: new Date(),
      component: componentName,
      userAgent: navigator.userAgent,
      url: window.location.href
    }

    setViolations(prev => [...prev, fullViolation])

    // External handler
    onSecurityViolation?.(fullViolation)

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.warn('🔒 Security Violation:', fullViolation)
    }

    // Send to monitoring service
    if (securityConfig.enableSecurityLogging) {
      logSecurityViolation(fullViolation)
    }

    // Block rendering for critical violations
    if (fullViolation.severity === 'CRITICAL' && !allowUnsafeContent) {
      setIsSecure(false)
    }
  }, [componentName, onSecurityViolation, securityConfig.enableSecurityLogging, allowUnsafeContent])

  /**
   * Sanitize content using DOMPurify
   */
  const sanitizeContent = useCallback((content: string): string => {
    if (!securityConfig.enableInputSanitization) {
      return content
    }

    const startTime = performance.now()

    try {
      // Check content length
      if (content.length > securityConfig.maxContentLength) {
        reportViolation({
          type: 'CONTENT_VIOLATION',
          severity: 'MEDIUM',
          description: `Content exceeds maximum length (${content.length} > ${securityConfig.maxContentLength})`,
          content: content.substring(0, 100) + '...'
        })
        content = content.substring(0, securityConfig.maxContentLength)
      }

      // Check for forbidden patterns
      for (const pattern of securityConfig.forbiddenPatterns) {
        if (pattern.test(content)) {
          reportViolation({
            type: 'XSS_ATTEMPT',
            severity: 'HIGH',
            description: `Forbidden pattern detected: ${pattern.toString()}`,
            content: content.substring(0, 200)
          })
          
          if (!allowUnsafeContent) {
            return '[CONTENT BLOCKED: Security violation detected]'
          }
        }
      }

      // Check for sensitive data
      if (sensitiveContent) {
        for (const pattern of securityConfig.sensitiveDataPatterns) {
          if (pattern.test(content)) {
            reportViolation({
              type: 'SENSITIVE_DATA',
              severity: 'HIGH',
              description: 'Sensitive data pattern detected in content',
              content: '[REDACTED]'
            })
          }
        }
      }

      // Configure DOMPurify based on security level
      let purifyConfig: any = {}
      
      switch (securityConfig.sanitizationLevel) {
        case 'strict':
          purifyConfig = {
            ALLOWED_TAGS: securityConfig.allowedTags.slice(0, 5), // Very limited tags
            ALLOWED_ATTR: ['class', 'id'],
            FORBID_ATTR: ['style', 'onerror', 'onload'],
            FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input']
          }
          break
        case 'moderate':
          purifyConfig = {
            ALLOWED_TAGS: securityConfig.allowedTags,
            ALLOWED_ATTR: securityConfig.allowedAttributes,
            FORBID_TAGS: ['script', 'iframe', 'object', 'embed']
          }
          break
        case 'relaxed':
          purifyConfig = {
            FORBID_TAGS: ['script', 'object', 'embed'],
            FORBID_ATTR: ['onerror', 'onload', 'onmouseover']
          }
          break
      }

      const sanitized = DOMPurify.sanitize(content, purifyConfig)

      // Performance monitoring
      if (securityConfig.enablePerformanceMonitoring) {
        const duration = performance.now() - startTime
        setPerformanceMetrics(prev => ({
          ...prev,
          [`sanitization_${componentName}`]: duration
        }))
      }

      return sanitized

    } catch (error) {
      reportViolation({
        type: 'CONTENT_VIOLATION',
        severity: 'MEDIUM',
        description: `Sanitization error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        content: content.substring(0, 100)
      })
      
      return allowUnsafeContent ? content : '[CONTENT ERROR: Unable to sanitize]'
    }
  }, [
    securityConfig,
    reportViolation,
    componentName,
    sensitiveContent,
    allowUnsafeContent
  ])

  /**
   * Click-jacking protection
   */
  useEffect(() => {
    if (!securityConfig.enableClickjackingProtection) return

    const handleVisibilityChange = () => {
      if (document.hidden && sensitiveContent) {
        reportViolation({
          type: 'CLICKJACKING',
          severity: 'MEDIUM',
          description: 'Sensitive component hidden - potential clickjacking attempt'
        })
      }
    }

    const handleFrameCheck = () => {
      try {
        if (window.self !== window.top) {
          reportViolation({
            type: 'CLICKJACKING',
            severity: 'HIGH',
            description: 'Component loaded in iframe - potential clickjacking'
          })
          
          if (sensitiveContent && !allowUnsafeContent) {
            setIsSecure(false)
          }
        }
      } catch (error) {
        // Cross-origin iframe - this is expected and secure
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    handleFrameCheck()

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [
    securityConfig.enableClickjackingProtection,
    sensitiveContent,
    allowUnsafeContent,
    reportViolation
  ])

  /**
   * Content validation on mount and updates
   */
  useEffect(() => {
    if (!securityConfig.enableContentValidation) return

    const validateContent = () => {
      const element = wrapperRef.current
      if (!element) return

      const textContent = element.textContent || ''
      const innerHTML = element.innerHTML || ''

      // Check for suspicious content changes
      for (const pattern of securityConfig.forbiddenPatterns) {
        if (pattern.test(innerHTML)) {
          reportViolation({
            type: 'XSS_ATTEMPT',
            severity: 'CRITICAL',
            description: 'DOM manipulation detected - possible XSS attack',
            content: innerHTML.substring(0, 200)
          })
        }
      }

      // Check for sensitive data exposure
      if (!sensitiveContent) {
        for (const pattern of securityConfig.sensitiveDataPatterns) {
          if (pattern.test(textContent)) {
            reportViolation({
              type: 'SENSITIVE_DATA',
              severity: 'MEDIUM',
              description: 'Sensitive data detected in non-sensitive component',
              content: '[REDACTED]'
            })
          }
        }
      }
    }

    // Initial validation
    validateContent()

    // Set up mutation observer for DOM changes
    const observer = new MutationObserver(validateContent)
    
    if (wrapperRef.current) {
      observer.observe(wrapperRef.current, {
        childList: true,
        subtree: true,
        characterData: true
      })
    }

    return () => observer.disconnect()
  }, [
    securityConfig.enableContentValidation,
    securityConfig.forbiddenPatterns,
    securityConfig.sensitiveDataPatterns,
    sensitiveContent,
    reportViolation
  ])

  /**
   * Security context value
   */
  const contextValue = useMemo(() => ({
    config: securityConfig,
    reportViolation,
    sanitizeContent
  }), [securityConfig, reportViolation, sanitizeContent])

  // Render blocked content for critical violations
  if (!isSecure && !allowUnsafeContent) {
    return (
      <div 
        className={`security-blocked ${className || ''}`}
        data-testid={testId}
        role="alert"
        aria-label="Content blocked for security reasons"
      >
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Content Blocked
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>This content has been blocked due to security violations.</p>
                {process.env.NODE_ENV === 'development' && (
                  <details className="mt-2">
                    <summary className="cursor-pointer font-medium">
                      Security Violations ({violations.length})
                    </summary>
                    <ul className="mt-1 list-disc list-inside space-y-1">
                      {violations.map((violation, index) => (
                        <li key={index} className="text-xs">
                          <span className="font-medium">{violation.type}</span>: {violation.description}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <SecurityContext.Provider value={contextValue}>
      <div
        ref={wrapperRef}
        className={`secure-wrapper ${sensitiveContent ? 'sensitive-content' : ''} ${className || ''}`}
        data-testid={testId}
        data-component={componentName}
        data-security-level={securityConfig.sanitizationLevel}
        {...props}
      >
        {children}
      </div>
    </SecurityContext.Provider>
  )
}

/**
 * Send security violation to monitoring service
 */
async function logSecurityViolation(violation: SecurityViolation): Promise<void> {
  try {
    await fetch('/api/security/violations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(violation)
    })
  } catch (error) {
    console.error('Failed to log security violation:', error)
  }
}

/**
 * Higher-order component for automatic security wrapping
 */
export function withSecurity<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  securityConfig?: Partial<SecurityConfig>
) {
  const WithSecurityComponent = (props: P) => (
    <SecureWrapper 
      config={securityConfig} 
      componentName={WrappedComponent.displayName || WrappedComponent.name}
    >
      <WrappedComponent {...props} />
    </SecureWrapper>
  )

  WithSecurityComponent.displayName = `withSecurity(${WrappedComponent.displayName || WrappedComponent.name})`
  
  return WithSecurityComponent
}

/**
 * Hook for secure content rendering
 */
export function useSecureContent(content: string, options: Partial<SecurityConfig> = {}) {
  const { sanitizeContent } = useSecurityContext()
  
  return useMemo(() => {
    if (!content) return ''
    return sanitizeContent(content)
  }, [content, sanitizeContent])
}

/**
 * Component for safely rendering HTML content
 */
export const SecureHTMLRenderer: React.FC<{
  content: string
  className?: string
  config?: Partial<SecurityConfig>
}> = ({ content, className, config }) => {
  const secureContent = useSecureContent(content, config)
  
  return (
    <div 
      className={className}
      dangerouslySetInnerHTML={{ __html: secureContent }}
    />
  )
}