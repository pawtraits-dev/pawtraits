/**
 * SECURITY CRITICAL: DOM-based XSS Protection
 * 
 * Provides real-time DOM monitoring and protection against:
 * - DOM-based XSS attacks
 * - Dynamic script injection
 * - Attribute manipulation attacks
 * - Event handler injection
 * - HTML injection via innerHTML
 * - URL-based DOM manipulation
 */

export class DOMXSSProtector {
  private observer: MutationObserver | null = null
  private isActive = false
  private violations: DOMViolation[] = []
  
  private dangerousPatterns = [
    /javascript:/gi,
    /data:text\/html/gi,
    /vbscript:/gi,
    /on\w+\s*=/gi,
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^>]*>/gi,
    /eval\s*\(/gi,
    /setTimeout\s*\(/gi,
    /setInterval\s*\(/gi
  ]

  startProtection(): void {
    if (this.isActive || typeof window === 'undefined') return

    this.observer = new MutationObserver((mutations) => {
      mutations.forEach(this.processMutation.bind(this))
    })

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      characterData: true
    })

    this.isActive = true
    this.protectExistingDOM()
  }

  private processMutation(mutation: MutationRecord): void {
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          this.scanElement(node as Element)
        }
      })
    }

    if (mutation.type === 'attributes') {
      this.scanAttribute(mutation.target as Element, mutation.attributeName!)
    }
  }

  private scanElement(element: Element): void {
    // Check dangerous tags
    const tagName = element.tagName.toLowerCase()
    if (['script', 'iframe', 'object', 'embed'].includes(tagName)) {
      this.handleViolation({
        type: 'DANGEROUS_TAG',
        element,
        description: `Dangerous tag detected: ${tagName}`
      })
      return
    }

    // Scan all attributes
    Array.from(element.attributes).forEach(attr => {
      this.scanAttribute(element, attr.name)
    })

    // Scan text content
    if (element.innerHTML) {
      this.scanContent(element.innerHTML, element)
    }
  }

  private scanAttribute(element: Element, attributeName: string): void {
    const value = element.getAttribute(attributeName) || ''
    
    // Check event handlers
    if (attributeName.startsWith('on')) {
      this.handleViolation({
        type: 'EVENT_HANDLER',
        element,
        description: `Event handler attribute: ${attributeName}`,
        value
      })
      element.removeAttribute(attributeName)
      return
    }

    // Check dangerous URLs
    if (['href', 'src', 'action'].includes(attributeName)) {
      if (this.isDangerousURL(value)) {
        this.handleViolation({
          type: 'DANGEROUS_URL',
          element,
          description: `Dangerous URL in ${attributeName}`,
          value
        })
        element.removeAttribute(attributeName)
      }
    }
  }

  private scanContent(content: string, element: Element): void {
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(content)) {
        this.handleViolation({
          type: 'SCRIPT_INJECTION',
          element,
          description: 'Suspicious script content detected',
          value: content.substring(0, 100)
        })
        element.innerHTML = '[CONTENT BLOCKED: XSS Detected]'
        break
      }
    }
  }

  private isDangerousURL(url: string): boolean {
    const dangerous = [
      /^javascript:/i,
      /^data:text\/html/i,
      /^vbscript:/i
    ]
    return dangerous.some(pattern => pattern.test(url))
  }

  private handleViolation(violation: Omit<DOMViolation, 'timestamp' | 'id'>): void {
    const fullViolation: DOMViolation = {
      ...violation,
      id: `dom_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date()
    }

    this.violations.push(fullViolation)
    
    // Report to security endpoint
    this.reportViolation(fullViolation)
    
    console.warn('DOM XSS Violation:', fullViolation)
  }

  private async reportViolation(violation: DOMViolation): Promise<void> {
    try {
      await fetch('/api/security/dom-violations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          violation: {
            ...violation,
            element: violation.element.tagName
          },
          url: window.location.href,
          userAgent: navigator.userAgent
        })
      })
    } catch (error) {
      console.error('Failed to report DOM violation:', error)
    }
  }

  private protectExistingDOM(): void {
    document.querySelectorAll('*').forEach(element => {
      this.scanElement(element)
    })
  }

  stopProtection(): void {
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }
    this.isActive = false
  }

  getViolations(): DOMViolation[] {
    return [...this.violations]
  }
}

interface DOMViolation {
  id: string
  timestamp: Date
  type: 'DANGEROUS_TAG' | 'EVENT_HANDLER' | 'DANGEROUS_URL' | 'SCRIPT_INJECTION'
  element: Element
  description: string
  value?: string
}

export const domProtector = new DOMXSSProtector()

// Auto-start protection when page loads
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    domProtector.startProtection()
  })
}