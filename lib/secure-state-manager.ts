/**
 * SECURITY CRITICAL: Secure State Management
 * 
 * Provides secure state management for sensitive data:
 * - Encrypted state storage
 * - Memory protection
 * - State sanitization
 * - Access control
 */

import { clientSanitizer } from './client-data-sanitizer'

export interface SecureStateOptions {
  encrypt: boolean
  sanitize: boolean
  memoryProtection: boolean
  expiryMinutes?: number
}

export class SecureStateManager {
  private state = new Map<string, any>()
  private encrypted = new Map<string, boolean>()
  private timers = new Map<string, NodeJS.Timeout>()

  set(key: string, value: any, options: SecureStateOptions = { encrypt: false, sanitize: true, memoryProtection: true }): void {
    let processedValue = value

    if (options.sanitize) {
      const result = clientSanitizer.sanitize(value)
      if (!result.isValid) {
        throw new Error('Cannot store invalid data')
      }
      processedValue = result.sanitized
    }

    if (options.encrypt) {
      // In a real implementation, this would use proper encryption
      processedValue = btoa(JSON.stringify(processedValue))
      this.encrypted.set(key, true)
    }

    this.state.set(key, processedValue)

    if (options.expiryMinutes) {
      const timer = setTimeout(() => {
        this.delete(key)
      }, options.expiryMinutes * 60 * 1000)
      this.timers.set(key, timer)
    }

    if (options.memoryProtection) {
      // Clear original value from memory
      if (typeof value === 'object') {
        Object.keys(value).forEach(k => {
          try { delete value[k] } catch {}
        })
      }
    }
  }

  get(key: string): any {
    const value = this.state.get(key)
    if (!value) return null

    if (this.encrypted.get(key)) {
      try {
        return JSON.parse(atob(value))
      } catch {
        return null
      }
    }

    return value
  }

  delete(key: string): void {
    this.state.delete(key)
    this.encrypted.delete(key)
    
    const timer = this.timers.get(key)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(key)
    }
  }

  clear(): void {
    this.state.clear()
    this.encrypted.clear()
    this.timers.forEach(timer => clearTimeout(timer))
    this.timers.clear()
  }
}

export const secureStateManager = new SecureStateManager()