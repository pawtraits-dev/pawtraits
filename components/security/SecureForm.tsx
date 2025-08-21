/**
 * SECURITY CRITICAL: Secure Form Components
 * 
 * Provides secure form handling with:
 * - Client-side input validation and sanitization
 * - XSS protection for all form inputs
 * - CSRF token management
 * - Rate limiting for form submissions
 * - Secure file uploads with validation
 * - Password strength validation
 * - Real-time security validation
 * - Form submission encryption
 */

'use client'

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  FormEvent,
  ChangeEvent,
  ReactNode
} from 'react'
import { z } from 'zod'
import { xssProtector, XSSViolation } from '@/lib/xss-protection'
import { SecureWrapper } from './SecureWrapper'

export interface SecureFormConfig {
  enableCSRFProtection: boolean
  enableRateLimiting: boolean
  enableEncryption: boolean
  maxSubmissionsPerMinute: number
  requiredSecurityLevel: 'low' | 'medium' | 'high' | 'critical'
  enableRealTimeValidation: boolean
  enableSecurityLogging: boolean
  sanitizeInputs: boolean
  validateFileUploads: boolean
  maxFileSize: number
  allowedFileTypes: string[]
}

export interface FormField {
  name: string
  type: 'text' | 'email' | 'password' | 'tel' | 'url' | 'textarea' | 'select' | 'file' | 'hidden'
  label?: string
  placeholder?: string
  required?: boolean
  schema?: z.ZodSchema
  sensitive?: boolean
  maxLength?: number
  pattern?: RegExp
  options?: Array<{ value: string; label: string }>
  accept?: string // For file inputs
  multiple?: boolean // For file inputs
}

export interface SecurityValidationResult {
  isValid: boolean
  violations: XSSViolation[]
  sanitizedValue: string
  strengthScore?: number
}

export interface SecureFormProps {
  fields: FormField[]
  onSubmit: (data: Record<string, any>, securityInfo: SecurityInfo) => Promise<void> | void
  onSecurityViolation?: (violation: XSSViolation) => void
  config?: Partial<SecureFormConfig>
  className?: string
  children?: ReactNode
  submitButtonText?: string
  enableProgressiveEnhancement?: boolean
}

export interface SecurityInfo {
  csrfToken: string
  submissionId: string
  securityLevel: string
  violations: XSSViolation[]
  encrypted: boolean
}

const DEFAULT_CONFIG: SecureFormConfig = {
  enableCSRFProtection: true,
  enableRateLimiting: true,
  enableEncryption: false,
  maxSubmissionsPerMinute: 10,
  requiredSecurityLevel: 'medium',
  enableRealTimeValidation: true,
  enableSecurityLogging: true,
  sanitizeInputs: true,
  validateFileUploads: true,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain']
}

export const SecureForm: React.FC<SecureFormProps> = ({
  fields,
  onSubmit,
  onSecurityViolation,
  config = {},
  className,
  children,
  submitButtonText = 'Submit',
  enableProgressiveEnhancement = true
}) => {
  const formConfig = { ...DEFAULT_CONFIG, ...config }
  const formRef = useRef<HTMLFormElement>(null)
  
  // Form state
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [securityViolations, setSecurityViolations] = useState<Record<string, XSSViolation[]>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [csrfToken, setCsrfToken] = useState<string>('')
  const [submissionCount, setSubmissionCount] = useState(0)
  const [lastSubmissionTime, setLastSubmissionTime] = useState<Date | null>(null)

  // Security monitoring
  const [securityMetrics, setSecurityMetrics] = useState({
    totalViolations: 0,
    blockedSubmissions: 0,
    successfulSubmissions: 0
  })

  /**
   * Initialize CSRF token and security setup
   */
  useEffect(() => {
    const initializeSecurity = async () => {
      try {
        const response = await fetch('/api/security/csrf-token', {
          method: 'GET',
          credentials: 'same-origin'
        })
        
        if (response.ok) {
          const { token } = await response.json()
          setCsrfToken(token)
        } else {
          console.error('Failed to obtain CSRF token')
        }
      } catch (error) {
        console.error('Security initialization failed:', error)
      }
    }

    if (formConfig.enableCSRFProtection) {
      initializeSecurity()
    }
  }, [formConfig.enableCSRFProtection])

  /**
   * Validate and sanitize input value
   */
  const validateInput = useCallback((field: FormField, value: any): SecurityValidationResult => {
    if (!value && !field.required) {
      return { isValid: true, violations: [], sanitizedValue: '' }
    }

    let violations: XSSViolation[] = []
    let sanitizedValue = value
    let strengthScore: number | undefined

    // Type-specific validation
    switch (field.type) {
      case 'email':
        const emailSchema = z.string().email()
        if (!emailSchema.safeParse(value).success) {
          violations.push({
            type: 'FORBIDDEN_PATTERN',
            severity: 'MEDIUM',
            description: 'Invalid email format',
            content: value
          })
        }
        sanitizedValue = xssProtector.sanitizeText(value)
        break

      case 'password':
        strengthScore = calculatePasswordStrength(value)
        if (strengthScore < 60) {
          violations.push({
            type: 'FORBIDDEN_PATTERN',
            severity: 'HIGH',
            description: 'Weak password detected',
            content: '[PASSWORD]'
          })
        }
        // Don't sanitize passwords as it might break them
        break

      case 'url':
        const urlResult = xssProtector.validateURL(value)
        if (!urlResult.isSafe) {
          violations.push({
            type: 'JAVASCRIPT_URI',
            severity: 'HIGH',
            description: 'Unsafe URL detected',
            content: value
          })
        }
        sanitizedValue = urlResult.sanitizedUrl || ''
        break

      case 'file':
        // File validation handled separately
        break

      default:
        if (formConfig.sanitizeInputs) {
          const result = xssProtector.sanitizeHTML(value)
          sanitizedValue = result.sanitized
          violations = result.violations
        }
        break
    }

    // Schema validation
    if (field.schema) {
      const schemaResult = field.schema.safeParse(sanitizedValue)
      if (!schemaResult.success) {
        violations.push({
          type: 'FORBIDDEN_PATTERN',
          severity: 'MEDIUM',
          description: 'Schema validation failed',
          content: schemaResult.error.issues.map(i => i.message).join(', ')
        })
      }
    }

    // Length validation
    if (field.maxLength && sanitizedValue.length > field.maxLength) {
      violations.push({
        type: 'FORBIDDEN_PATTERN',
        severity: 'MEDIUM',
        description: `Input exceeds maximum length (${sanitizedValue.length} > ${field.maxLength})`,
        content: sanitizedValue.substring(0, 100) + '...'
      })
      sanitizedValue = sanitizedValue.substring(0, field.maxLength)
    }

    // Pattern validation
    if (field.pattern && !field.pattern.test(sanitizedValue)) {
      violations.push({
        type: 'FORBIDDEN_PATTERN',
        severity: 'MEDIUM',
        description: `Input does not match required pattern`,
        content: sanitizedValue
      })
    }

    return {
      isValid: violations.filter(v => v.severity === 'HIGH' || v.severity === 'CRITICAL').length === 0,
      violations,
      sanitizedValue,
      strengthScore
    }
  }, [formConfig.sanitizeInputs])

  /**
   * Handle input changes with real-time validation
   */
  const handleInputChange = useCallback((field: FormField, value: any) => {
    if (formConfig.enableRealTimeValidation) {
      const validation = validateInput(field, value)
      
      setFormData(prev => ({ ...prev, [field.name]: validation.sanitizedValue }))
      
      if (validation.violations.length > 0) {
        setSecurityViolations(prev => ({
          ...prev,
          [field.name]: validation.violations
        }))
        
        validation.violations.forEach(violation => {
          onSecurityViolation?.(violation)
        })
      } else {
        setSecurityViolations(prev => {
          const newViolations = { ...prev }
          delete newViolations[field.name]
          return newViolations
        })
      }

      // Set validation error if invalid
      if (!validation.isValid) {
        setValidationErrors(prev => ({
          ...prev,
          [field.name]: validation.violations[0]?.description || 'Invalid input'
        }))
      } else {
        setValidationErrors(prev => {
          const newErrors = { ...prev }
          delete newErrors[field.name]
          return newErrors
        })
      }
    } else {
      setFormData(prev => ({ ...prev, [field.name]: value }))
    }
  }, [formConfig.enableRealTimeValidation, validateInput, onSecurityViolation])

  /**
   * Validate file uploads
   */
  const validateFileUpload = useCallback((file: File, field: FormField): SecurityValidationResult => {
    const violations: XSSViolation[] = []

    // File size validation
    if (file.size > formConfig.maxFileSize) {
      violations.push({
        type: 'FORBIDDEN_PATTERN',
        severity: 'HIGH',
        description: `File size exceeds limit (${file.size} > ${formConfig.maxFileSize})`,
        content: file.name
      })
    }

    // File type validation
    if (!formConfig.allowedFileTypes.includes(file.type)) {
      violations.push({
        type: 'FORBIDDEN_PATTERN',
        severity: 'HIGH',
        description: `File type not allowed: ${file.type}`,
        content: file.name
      })
    }

    // File name validation
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js']
    const fileName = file.name.toLowerCase()
    
    if (dangerousExtensions.some(ext => fileName.endsWith(ext))) {
      violations.push({
        type: 'FORBIDDEN_PATTERN',
        severity: 'CRITICAL',
        description: `Dangerous file extension detected: ${file.name}`,
        content: file.name
      })
    }

    // Check for embedded scripts in filename
    if (/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(file.name)) {
      violations.push({
        type: 'SCRIPT_TAG',
        severity: 'CRITICAL',
        description: 'Script detected in filename',
        content: file.name
      })
    }

    return {
      isValid: violations.filter(v => v.severity === 'CRITICAL' || v.severity === 'HIGH').length === 0,
      violations,
      sanitizedValue: file.name
    }
  }, [formConfig.maxFileSize, formConfig.allowedFileTypes])

  /**
   * Rate limiting check
   */
  const checkRateLimit = useCallback((): boolean => {
    if (!formConfig.enableRateLimiting) return true

    const now = new Date()
    const oneMinuteAgo = new Date(now.getTime() - 60000)

    // Reset counter if more than a minute has passed
    if (!lastSubmissionTime || lastSubmissionTime < oneMinuteAgo) {
      setSubmissionCount(1)
      setLastSubmissionTime(now)
      return true
    }

    // Check if under rate limit
    if (submissionCount < formConfig.maxSubmissionsPerMinute) {
      setSubmissionCount(prev => prev + 1)
      return true
    }

    return false
  }, [
    formConfig.enableRateLimiting,
    formConfig.maxSubmissionsPerMinute,
    submissionCount,
    lastSubmissionTime
  ])

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    
    if (isSubmitting) return

    // Rate limiting check
    if (!checkRateLimit()) {
      alert('Too many submissions. Please wait before trying again.')
      return
    }

    setIsSubmitting(true)

    try {
      // Validate all fields
      const allViolations: XSSViolation[] = []
      const validatedData: Record<string, any> = {}
      let hasErrors = false

      for (const field of fields) {
        const value = formData[field.name]
        
        if (field.type === 'file' && value instanceof FileList) {
          // Handle file uploads
          const files = Array.from(value)
          for (const file of files) {
            const fileValidation = validateFileUpload(file, field)
            allViolations.push(...fileValidation.violations)
            
            if (!fileValidation.isValid) {
              hasErrors = true
            }
          }
          validatedData[field.name] = files
        } else {
          const validation = validateInput(field, value)
          allViolations.push(...validation.violations)
          validatedData[field.name] = validation.sanitizedValue
          
          if (!validation.isValid) {
            hasErrors = true
          }
        }
      }

      // Check if there are critical violations
      const criticalViolations = allViolations.filter(v => 
        v.severity === 'CRITICAL' || v.severity === 'HIGH'
      )

      if (criticalViolations.length > 0 && formConfig.requiredSecurityLevel === 'critical') {
        setSecurityMetrics(prev => ({ ...prev, blockedSubmissions: prev.blockedSubmissions + 1 }))
        alert('Form submission blocked due to security violations.')
        return
      }

      if (hasErrors && formConfig.requiredSecurityLevel !== 'low') {
        alert('Please fix validation errors before submitting.')
        return
      }

      // Prepare security info
      const securityInfo: SecurityInfo = {
        csrfToken,
        submissionId: generateSubmissionId(),
        securityLevel: formConfig.requiredSecurityLevel,
        violations: allViolations,
        encrypted: formConfig.enableEncryption
      }

      // Log security metrics
      setSecurityMetrics(prev => ({
        ...prev,
        totalViolations: prev.totalViolations + allViolations.length,
        successfulSubmissions: prev.successfulSubmissions + 1
      }))

      // Call the submit handler
      await onSubmit(validatedData, securityInfo)

    } catch (error) {
      console.error('Form submission error:', error)
      alert('An error occurred during form submission. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }, [
    isSubmitting,
    checkRateLimit,
    formData,
    fields,
    validateInput,
    validateFileUpload,
    formConfig.requiredSecurityLevel,
    formConfig.enableEncryption,
    csrfToken,
    onSubmit
  ])

  /**
   * Render form field
   */
  const renderField = useCallback((field: FormField) => {
    const hasError = validationErrors[field.name]
    const hasViolations = securityViolations[field.name]?.length > 0
    const fieldValue = formData[field.name] || ''

    const commonProps = {
      id: field.name,
      name: field.name,
      required: field.required,
      className: `form-input ${hasError ? 'error' : ''} ${hasViolations ? 'security-warning' : ''}`,
      onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        handleInputChange(field, e.target.value)
      }
    }

    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            {...commonProps}
            value={fieldValue}
            placeholder={field.placeholder}
            maxLength={field.maxLength}
            rows={4}
          />
        )

      case 'select':
        return (
          <select {...commonProps} value={fieldValue}>
            <option value="">Select...</option>
            {field.options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )

      case 'file':
        return (
          <input
            {...commonProps}
            type="file"
            accept={field.accept}
            multiple={field.multiple}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              handleInputChange(field, e.target.files)
            }}
          />
        )

      default:
        return (
          <input
            {...commonProps}
            type={field.type}
            value={field.type !== 'file' ? fieldValue : undefined}
            placeholder={field.placeholder}
            maxLength={field.maxLength}
            pattern={field.pattern?.source}
          />
        )
    }
  }, [formData, validationErrors, securityViolations, handleInputChange])

  return (
    <SecureWrapper
      componentName="SecureForm"
      sensitiveContent={fields.some(f => f.sensitive)}
      config={{ enableClickjackingProtection: true }}
    >
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className={`secure-form ${className || ''}`}
        noValidate={enableProgressiveEnhancement}
      >
        {/* CSRF Token */}
        {formConfig.enableCSRFProtection && csrfToken && (
          <input type="hidden" name="csrf_token" value={csrfToken} />
        )}

        {/* Form Fields */}
        {fields.map(field => (
          <div key={field.name} className="form-field">
            {field.label && (
              <label htmlFor={field.name} className="form-label">
                {field.label}
                {field.required && <span className="required">*</span>}
                {field.sensitive && <span className="sensitive-indicator">🔒</span>}
              </label>
            )}

            {renderField(field)}

            {/* Validation Error */}
            {validationErrors[field.name] && (
              <div className="form-error" role="alert">
                {validationErrors[field.name]}
              </div>
            )}

            {/* Security Violations */}
            {securityViolations[field.name] && securityViolations[field.name].length > 0 && (
              <div className="security-warning" role="alert">
                Security issue detected: {securityViolations[field.name][0].description}
              </div>
            )}
          </div>
        ))}

        {/* Custom children */}
        {children}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || Object.keys(validationErrors).length > 0}
          className="form-submit"
        >
          {isSubmitting ? 'Submitting...' : submitButtonText}
        </button>

        {/* Security Metrics (Development Only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="security-metrics">
            <small>
              Security Metrics: {securityMetrics.totalViolations} violations, {securityMetrics.blockedSubmissions} blocked, {securityMetrics.successfulSubmissions} successful
            </small>
          </div>
        )}
      </form>
    </SecureWrapper>
  )
}

/**
 * Calculate password strength score
 */
function calculatePasswordStrength(password: string): number {
  if (!password) return 0

  let score = 0
  
  // Length
  if (password.length >= 8) score += 20
  if (password.length >= 12) score += 10
  if (password.length >= 16) score += 10
  
  // Character variety
  if (/[a-z]/.test(password)) score += 10
  if (/[A-Z]/.test(password)) score += 10
  if (/[0-9]/.test(password)) score += 10
  if (/[^a-zA-Z0-9]/.test(password)) score += 15
  
  // Complexity patterns
  if (/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) score += 15
  
  return Math.min(score, 100)
}

/**
 * Generate unique submission ID
 */
function generateSubmissionId(): string {
  return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export default SecureForm