/**
 * SECURITY CRITICAL: DLP Scanner Test Suite
 * 
 * Tests data loss prevention scanning functionality including:
 * - Sensitive data pattern detection
 * - Risk score calculation
 * - Content redaction
 * - Compliance reporting
 * - Performance under load
 */

import { DLPScanner } from '../dlp-scanner'
import { NextRequest } from 'next/server'

// Test data samples
const testData = {
  creditCards: {
    visa: '4532015112830366',
    mastercard: '5425233430109903',
    formatted: '4532-0151-1283-0366',
    spaces: '4532 0151 1283 0366'
  },
  ssns: {
    formatted: '123-45-6789',
    unformatted: '123456789'
  },
  phones: {
    us: '(555) 123-4567',
    usFormatted: '+1-555-123-4567',
    uk: '+44 20 7946 0958'
  },
  emails: [
    'user@example.com',
    'test.user+tag@domain.co.uk',
    'firstname.lastname@company.org'
  ],
  apiKeys: [
    'sk_test_51234567890abcdefghijklmnopqrstuvwxyz',
    'AIzaSyBkEe1Z2345678901234567890123456789',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
  ],
  ips: [
    '192.168.1.1',
    '10.0.0.1',
    '172.16.0.1',
    '8.8.8.8'
  ]
}

describe('DLP Scanner', () => {
  let scanner: DLPScanner

  beforeEach(() => {
    scanner = new DLPScanner()
  })

  describe('Credit Card Detection', () => {
    it('should detect Visa credit card numbers', async () => {
      const content = `Payment processed with card ${testData.creditCards.visa}`
      const result = await scanner.scanContent(content)
      
      expect(result.hasViolations).toBe(true)
      expect(result.matches).toHaveLength(1)
      expect(result.matches[0].pattern.type).toBe('CREDIT_CARD')
      expect(result.matches[0].pattern.name).toBe('Visa Credit Card')
      expect(result.riskScore).toBeGreaterThan(80)
    })

    it('should detect MasterCard numbers', async () => {
      const content = `Card: ${testData.creditCards.mastercard}`
      const result = await scanner.scanContent(content)
      
      expect(result.hasViolations).toBe(true)
      expect(result.matches[0].pattern.type).toBe('CREDIT_CARD')
      expect(result.matches[0].pattern.name).toBe('MasterCard Credit Card')
    })

    it('should detect formatted credit card numbers', async () => {
      const content = `Payment with ${testData.creditCards.formatted}`
      const result = await scanner.scanContent(content)
      
      expect(result.hasViolations).toBe(true)
      expect(result.matches[0].pattern.type).toBe('CREDIT_CARD')
    })

    it('should properly redact credit card numbers', async () => {
      const content = `Card number: ${testData.creditCards.visa}`
      const result = await scanner.scanContent(content)
      
      expect(result.redactedContent).toContain('****-****-****-0366')
      expect(result.redactedContent).not.toContain(testData.creditCards.visa)
    })
  })

  describe('SSN Detection', () => {
    it('should detect formatted SSN', async () => {
      const content = `SSN: ${testData.ssns.formatted}`
      const result = await scanner.scanContent(content)
      
      expect(result.hasViolations).toBe(true)
      expect(result.matches[0].pattern.type).toBe('SSN')
      expect(result.riskScore).toBeGreaterThan(80)
    })

    it('should redact SSN properly', async () => {
      const content = `Social Security: ${testData.ssns.formatted}`
      const result = await scanner.scanContent(content)
      
      expect(result.redactedContent).toContain('XXX-XX-XXXX')
    })
  })

  describe('Phone Number Detection', () => {
    it('should detect US phone numbers', async () => {
      const content = `Call me at ${testData.phones.us}`
      const result = await scanner.scanContent(content)
      
      expect(result.hasViolations).toBe(true)
      expect(result.matches[0].pattern.type).toBe('PHONE_NUMBER')
    })

    it('should detect UK phone numbers', async () => {
      const content = `UK office: ${testData.phones.uk}`
      const result = await scanner.scanContent(content)
      
      expect(result.hasViolations).toBe(true)
      expect(result.matches[0].pattern.type).toBe('PHONE_NUMBER')
    })
  })

  describe('Email Detection', () => {
    it('should detect email addresses', async () => {
      for (const email of testData.emails) {
        const content = `Contact: ${email}`
        const result = await scanner.scanContent(content)
        
        expect(result.hasViolations).toBe(true)
        expect(result.matches[0].pattern.type).toBe('EMAIL')
      }
    })

    it('should redact email addresses properly', async () => {
      const email = testData.emails[0]
      const content = `Email: ${email}`
      const result = await scanner.scanContent(content)
      
      expect(result.redactedContent).toContain('u***@example.com')
    })
  })

  describe('API Key Detection', () => {
    it('should detect JWT tokens', async () => {
      const content = `Authorization: Bearer ${testData.apiKeys[2]}`
      const result = await scanner.scanContent(content)
      
      expect(result.hasViolations).toBe(true)
      expect(result.matches[0].pattern.type).toBe('API_KEY')
      expect(result.matches[0].pattern.name).toBe('JWT Token')
    })

    it('should have high risk score for API keys', async () => {
      const content = `API_KEY=${testData.apiKeys[0]}`
      const result = await scanner.scanContent(content)
      
      expect(result.riskScore).toBeGreaterThan(70)
    })
  })

  describe('IP Address Detection', () => {
    it('should detect IP addresses', async () => {
      for (const ip of testData.ips) {
        const content = `Server IP: ${ip}`
        const result = await scanner.scanContent(content)
        
        expect(result.hasViolations).toBe(true)
        expect(result.matches[0].pattern.type).toBe('IP_ADDRESS')
      }
    })

    it('should redact IP addresses', async () => {
      const content = `Client IP: ${testData.ips[0]}`
      const result = await scanner.scanContent(content)
      
      expect(result.redactedContent).toContain('192.168.*.**')
    })
  })

  describe('Multiple Violations', () => {
    it('should detect multiple different violations', async () => {
      const content = `
        Customer details:
        Email: ${testData.emails[0]}
        Phone: ${testData.phones.us}
        Card: ${testData.creditCards.visa}
        SSN: ${testData.ssns.formatted}
      `
      
      const result = await scanner.scanContent(content)
      
      expect(result.hasViolations).toBe(true)
      expect(result.matches.length).toBeGreaterThanOrEqual(4)
      expect(result.riskScore).toBeGreaterThan(80)
      
      // Check all types are detected
      const types = result.matches.map(m => m.pattern.type)
      expect(types).toContain('EMAIL')
      expect(types).toContain('PHONE_NUMBER')
      expect(types).toContain('CREDIT_CARD')
      expect(types).toContain('SSN')
    })

    it('should provide appropriate recommendations for multiple violations', async () => {
      const content = `
        Card: ${testData.creditCards.visa}
        SSN: ${testData.ssns.formatted}
        API Key: ${testData.apiKeys[0]}
      `
      
      const result = await scanner.scanContent(content)
      
      expect(result.recommendations).toContain('Credit card numbers detected - ensure PCI-DSS compliance')
      expect(result.recommendations).toContain('Social Security Numbers detected - implement strong encryption')
      expect(result.recommendations).toContain('Credentials detected - rotate keys immediately')
    })
  })

  describe('Request Scanning', () => {
    it('should scan request URL parameters', async () => {
      const url = `https://example.com/api/user?email=${testData.emails[0]}&ssn=${testData.ssns.formatted}`
      const req = new NextRequest(url)
      
      const result = await scanner.scanRequest(req)
      
      expect(result.hasViolations).toBe(true)
      expect(result.matches.length).toBeGreaterThanOrEqual(2)
    })

    it('should handle POST requests with body content', async () => {
      const body = JSON.stringify({
        email: testData.emails[0],
        creditCard: testData.creditCards.visa
      })
      
      const req = new NextRequest('https://example.com/api/payment', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' }
      })
      
      const result = await scanner.scanRequest(req)
      
      expect(result.hasViolations).toBe(true)
    })
  })

  describe('File Scanning', () => {
    it('should scan file content for violations', async () => {
      const fileContent = `
        User Data Export
        ================
        Name: John Doe
        Email: ${testData.emails[0]}
        Phone: ${testData.phones.us}
        Credit Card: ${testData.creditCards.visa}
      `
      
      const result = await scanner.scanFile('/tmp/user_export.txt', fileContent)
      
      expect(result.hasViolations).toBe(true)
      expect(result.matches.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('Confidence Scoring', () => {
    it('should have high confidence for clear violations', async () => {
      const content = `Credit Card: ${testData.creditCards.visa}`
      const result = await scanner.scanContent(content)
      
      expect(result.matches[0].confidence).toBeGreaterThan(0.8)
    })

    it('should filter out low-confidence matches', async () => {
      // Create content that might trigger false positives
      const content = `ID: 1234567890123456` // Random number similar to card
      const result = await scanner.scanContent(content)
      
      // Should either have no matches or low confidence matches filtered out
      if (result.hasViolations) {
        expect(result.matches.every(m => m.confidence >= 0.7)).toBe(true)
      }
    })
  })

  describe('Performance', () => {
    it('should handle large content efficiently', async () => {
      // Generate large content with scattered violations
      let largeContent = 'Start of large document\n'
      for (let i = 0; i < 1000; i++) {
        largeContent += `Line ${i}: This is sample content line number ${i}\n`
        if (i % 100 === 0) {
          largeContent += `Email at line ${i}: user${i}@example.com\n`
        }
      }
      largeContent += `End with violation: ${testData.creditCards.visa}`
      
      const startTime = Date.now()
      const result = await scanner.scanContent(largeContent)
      const endTime = Date.now()
      
      expect(result.hasViolations).toBe(true)
      expect(endTime - startTime).toBeLessThan(5000) // Should complete in under 5 seconds
    })

    it('should handle concurrent scanning requests', async () => {
      const requests = []
      
      for (let i = 0; i < 10; i++) {
        const content = `Request ${i}: ${testData.emails[i % testData.emails.length]}`
        requests.push(scanner.scanContent(content))
      }
      
      const results = await Promise.all(requests)
      
      expect(results).toHaveLength(10)
      expect(results.every(r => r.hasViolations)).toBe(true)
    })
  })

  describe('Whitelisting', () => {
    it('should respect whitelist configuration', async () => {
      const scannerWithWhitelist = new DLPScanner({
        whitelist: ['example.com', 'test@safe-domain.com']
      })
      
      const content = `Safe email: test@example.com`
      const result = await scannerWithWhitelist.scanContent(content)
      
      // Should be whitelisted and not flagged as violation
      expect(result.hasViolations).toBe(false)
    })
  })

  describe('Custom Patterns', () => {
    it('should support custom patterns', async () => {
      const customScanner = new DLPScanner({
        customPatterns: [{
          id: 'custom-id',
          name: 'Employee ID',
          pattern: /EMP-\d{6}/g,
          type: 'CUSTOM',
          severity: 'MEDIUM',
          action: 'LOG',
          description: 'Employee ID pattern',
          complianceFlags: []
        }]
      })
      
      const content = `Employee ID: EMP-123456`
      const result = await customScanner.scanContent(content)
      
      expect(result.hasViolations).toBe(true)
      expect(result.matches[0].pattern.type).toBe('CUSTOM')
      expect(result.matches[0].pattern.name).toBe('Employee ID')
    })
  })

  describe('Compliance Reporting', () => {
    it('should generate compliance flags correctly', async () => {
      const content = `
        PII Data:
        Email: ${testData.emails[0]}
        SSN: ${testData.ssns.formatted}
        Credit Card: ${testData.creditCards.visa}
      `
      
      const result = await scanner.scanContent(content)
      
      // Check that compliance flags are properly assigned
      const complianceFlags = result.matches.flatMap(m => m.pattern.complianceFlags)
      expect(complianceFlags).toContain('GDPR')
      expect(complianceFlags).toContain('CCPA')
      expect(complianceFlags).toContain('PCI-DSS')
    })
  })

  describe('Error Handling', () => {
    it('should handle empty content gracefully', async () => {
      const result = await scanner.scanContent('')
      
      expect(result.hasViolations).toBe(false)
      expect(result.matches).toHaveLength(0)
      expect(result.riskScore).toBe(0)
    })

    it('should handle malformed requests gracefully', async () => {
      // Test with malformed URL
      const req = new NextRequest('not-a-url')
      const result = await scanner.scanRequest(req)
      
      expect(result).toBeDefined()
      expect(result.hasViolations).toBe(false)
    })

    it('should not throw errors on invalid content', async () => {
      const invalidContent = '\x00\x01\x02\x03' // Binary data
      
      expect(async () => {
        await scanner.scanContent(invalidContent)
      }).not.toThrow()
    })
  })

  describe('Risk Score Calculation', () => {
    it('should calculate risk scores appropriately', async () => {
      const lowRisk = `Email: ${testData.emails[0]}`
      const highRisk = `Card: ${testData.creditCards.visa} SSN: ${testData.ssns.formatted}`
      
      const lowResult = await scanner.scanContent(lowRisk)
      const highResult = await scanner.scanContent(highRisk)
      
      expect(lowResult.riskScore).toBeLessThan(highResult.riskScore)
      expect(highResult.riskScore).toBeGreaterThan(80)
    })
  })
})

// Integration tests for the DLP system
describe('DLP Integration Tests', () => {
  let scanner: DLPScanner

  beforeEach(() => {
    scanner = new DLPScanner({
      logAllMatches: false // Disable logging for tests
    })
  })

  it('should integrate with audit logging', async () => {
    const content = `Critical violation: ${testData.creditCards.visa}`
    const result = await scanner.scanContent(content)
    
    expect(result.hasViolations).toBe(true)
    expect(result.riskScore).toBeGreaterThan(80)
  })

  it('should handle real-world mixed content', async () => {
    const realWorldContent = `
      Customer Support Ticket #12345
      
      From: customer.service@company.com
      To: john.doe@email.com
      Subject: Payment Issue Resolution
      
      Dear John,
      
      We've resolved the issue with your payment ending in 0366.
      Your account has been credited and the transaction 
      reference is TXN-7891011.
      
      If you need further assistance, please call us at 
      (555) 123-4567 or visit our office at:
      
      123 Business Ave
      Suite 100
      City, State 12345
      
      Best regards,
      Customer Service Team
      
      Internal Note: Customer IP was 192.168.1.100
    `
    
    const result = await scanner.scanContent(realWorldContent)
    
    expect(result.hasViolations).toBe(true)
    expect(result.matches.length).toBeGreaterThan(0)
    
    // Should detect emails, phone numbers, and IPs
    const types = result.matches.map(m => m.pattern.type)
    expect(types).toContain('EMAIL')
    expect(types).toContain('PHONE_NUMBER')
    expect(types).toContain('IP_ADDRESS')
  })
})