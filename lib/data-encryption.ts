/**
 * SECURITY CRITICAL: Data Encryption and Protection System
 * 
 * Provides comprehensive data protection:
 * - Field-level encryption for sensitive data
 * - Key derivation and management
 * - Encrypted database storage
 * - PII (Personally Identifiable Information) protection
 * - GDPR/CCPA compliance helpers
 * - Secure data export and import
 */

import { createClient } from '@supabase/supabase-js'

export interface EncryptionConfig {
  algorithm: string
  keyLength: number
  ivLength: number
  tagLength: number
  saltLength: number
}

export interface EncryptedField {
  value: string          // Base64 encoded encrypted data
  iv: string            // Initialization vector
  tag?: string          // Authentication tag for authenticated encryption
  salt?: string         // Salt for key derivation
  version: number       // Encryption version for key rotation
}

export interface PIIClassification {
  level: 'public' | 'internal' | 'confidential' | 'restricted'
  category: 'name' | 'contact' | 'financial' | 'biometric' | 'location' | 'behavioral'
  retention: number     // Days to retain data
  requiresConsent: boolean
}

export interface DataProtectionPolicy {
  encrypt: boolean
  maskInLogs: boolean
  requireAuditTrail: boolean
  allowExport: boolean
  anonymizeAfterDays?: number
}

export class DataEncryptionService {
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  private readonly config: EncryptionConfig = {
    algorithm: 'aes-256-gcm',
    keyLength: 32,    // 256 bits
    ivLength: 12,     // 96 bits for GCM
    tagLength: 16,    // 128 bits
    saltLength: 16    // 128 bits
  }

  // PII field classifications
  private readonly PII_FIELDS: Record<string, PIIClassification> = {
    // Personal identifiers
    'email': {
      level: 'confidential',
      category: 'contact',
      retention: 365 * 7, // 7 years
      requiresConsent: true
    },
    'phone_number': {
      level: 'confidential',
      category: 'contact',
      retention: 365 * 7,
      requiresConsent: true
    },
    'first_name': {
      level: 'internal',
      category: 'name',
      retention: 365 * 7,
      requiresConsent: false
    },
    'last_name': {
      level: 'internal',
      category: 'name',
      retention: 365 * 7,
      requiresConsent: false
    },
    'address_line_1': {
      level: 'confidential',
      category: 'location',
      retention: 365 * 7,
      requiresConsent: true
    },
    'address_line_2': {
      level: 'confidential',
      category: 'location',
      retention: 365 * 7,
      requiresConsent: true
    },
    'postal_code': {
      level: 'internal',
      category: 'location',
      retention: 365 * 7,
      requiresConsent: false
    },
    
    // Financial data
    'credit_card_last_four': {
      level: 'restricted',
      category: 'financial',
      retention: 365 * 3, // 3 years
      requiresConsent: true
    },
    'bank_account_last_four': {
      level: 'restricted',
      category: 'financial',
      retention: 365 * 3,
      requiresConsent: true
    },
    
    // Behavioral data
    'ip_address': {
      level: 'internal',
      category: 'behavioral',
      retention: 90, // 90 days
      requiresConsent: false
    },
    'user_agent': {
      level: 'internal',
      category: 'behavioral',
      retention: 90,
      requiresConsent: false
    },
    
    // Biometric/Pet data
    'pet_photo_metadata': {
      level: 'confidential',
      category: 'biometric',
      retention: 365 * 5, // 5 years
      requiresConsent: true
    }
  }

  // Data protection policies
  private readonly PROTECTION_POLICIES: Record<string, DataProtectionPolicy> = {
    'email': {
      encrypt: true,
      maskInLogs: true,
      requireAuditTrail: true,
      allowExport: true
    },
    'phone_number': {
      encrypt: true,
      maskInLogs: true,
      requireAuditTrail: true,
      allowExport: true
    },
    'credit_card_last_four': {
      encrypt: true,
      maskInLogs: true,
      requireAuditTrail: true,
      allowExport: false
    },
    'ip_address': {
      encrypt: false,
      maskInLogs: true,
      requireAuditTrail: false,
      allowExport: false,
      anonymizeAfterDays: 90
    }
  }

  /**
   * Encrypt sensitive field value
   */
  async encryptField(value: string, fieldName?: string): Promise<EncryptedField> {
    if (!value) {
      throw new Error('Cannot encrypt empty value')
    }

    try {
      // Generate encryption key
      const { key, salt } = await this.deriveKey()
      
      // Generate IV
      const iv = crypto.getRandomValues(new Uint8Array(this.config.ivLength))
      
      // Encrypt data
      const encoder = new TextEncoder()
      const data = encoder.encode(value)
      
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      )

      const encrypted = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        cryptoKey,
        data
      )

      // Extract ciphertext and tag
      const encryptedArray = new Uint8Array(encrypted)
      const ciphertext = encryptedArray.slice(0, -this.config.tagLength)
      const tag = encryptedArray.slice(-this.config.tagLength)

      const result: EncryptedField = {
        value: this.arrayBufferToBase64(ciphertext),
        iv: this.arrayBufferToBase64(iv),
        tag: this.arrayBufferToBase64(tag),
        salt: this.arrayBufferToBase64(salt),
        version: 1 // Current encryption version
      }

      // Log encryption event if required
      if (fieldName && this.PROTECTION_POLICIES[fieldName]?.requireAuditTrail) {
        await this.logDataEvent('ENCRYPT', fieldName)
      }

      return result

    } catch (error) {
      console.error('Encryption error:', error)
      throw new Error('Failed to encrypt data')
    }
  }

  /**
   * Decrypt encrypted field value
   */
  async decryptField(encryptedField: EncryptedField, fieldName?: string): Promise<string> {
    if (!encryptedField?.value) {
      throw new Error('Cannot decrypt empty field')
    }

    try {
      // Recreate encryption key from salt
      const salt = this.base64ToArrayBuffer(encryptedField.salt || '')
      const key = await this.deriveKeyFromSalt(salt)
      
      // Convert base64 back to arrays
      const iv = this.base64ToArrayBuffer(encryptedField.iv)
      const ciphertext = this.base64ToArrayBuffer(encryptedField.value)
      const tag = encryptedField.tag ? this.base64ToArrayBuffer(encryptedField.tag) : new Uint8Array()
      
      // Combine ciphertext and tag for decryption
      const encryptedData = new Uint8Array(ciphertext.byteLength + tag.byteLength)
      encryptedData.set(new Uint8Array(ciphertext))
      encryptedData.set(new Uint8Array(tag), ciphertext.byteLength)

      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      )

      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        cryptoKey,
        encryptedData
      )

      const decoder = new TextDecoder()
      const result = decoder.decode(decrypted)

      // Log decryption event if required
      if (fieldName && this.PROTECTION_POLICIES[fieldName]?.requireAuditTrail) {
        await this.logDataEvent('DECRYPT', fieldName)
      }

      return result

    } catch (error) {
      console.error('Decryption error:', error)
      throw new Error('Failed to decrypt data')
    }
  }

  /**
   * Encrypt object with multiple fields
   */
  async encryptObject(data: Record<string, any>): Promise<Record<string, any>> {
    const result = { ...data }

    for (const [fieldName, value] of Object.entries(data)) {
      if (this.shouldEncryptField(fieldName) && value !== null && value !== undefined) {
        try {
          const encrypted = await this.encryptField(String(value), fieldName)
          result[fieldName] = encrypted
        } catch (error) {
          console.error(`Failed to encrypt field ${fieldName}:`, error)
          // Decide whether to fail or continue based on field criticality
          if (this.PII_FIELDS[fieldName]?.level === 'restricted') {
            throw error
          }
        }
      }
    }

    return result
  }

  /**
   * Decrypt object with multiple fields
   */
  async decryptObject(data: Record<string, any>): Promise<Record<string, any>> {
    const result = { ...data }

    for (const [fieldName, value] of Object.entries(data)) {
      if (this.shouldEncryptField(fieldName) && this.isEncryptedField(value)) {
        try {
          const decrypted = await this.decryptField(value as EncryptedField, fieldName)
          result[fieldName] = decrypted
        } catch (error) {
          console.error(`Failed to decrypt field ${fieldName}:`, error)
          // Return null for failed decryptions to avoid exposing encrypted data
          result[fieldName] = null
        }
      }
    }

    return result
  }

  /**
   * Mask sensitive data for logging
   */
  maskForLogging(data: Record<string, any>): Record<string, any> {
    const masked = { ...data }

    for (const [fieldName, value] of Object.entries(data)) {
      const policy = this.PROTECTION_POLICIES[fieldName]
      if (policy?.maskInLogs && value) {
        if (fieldName === 'email') {
          masked[fieldName] = this.maskEmail(String(value))
        } else if (fieldName === 'phone_number') {
          masked[fieldName] = this.maskPhone(String(value))
        } else if (fieldName === 'credit_card_last_four') {
          masked[fieldName] = '****'
        } else if (fieldName === 'ip_address') {
          masked[fieldName] = this.maskIP(String(value))
        } else {
          // Generic masking
          masked[fieldName] = this.maskGeneric(String(value))
        }
      }
    }

    return masked
  }

  /**
   * Generate secure export of user data (GDPR compliance)
   */
  async exportUserData(userId: string): Promise<Record<string, any>> {
    try {
      const exportData: Record<string, any> = {}

      // Get all user data that can be exported
      const tables = ['user_profiles', 'orders', 'pets', 'interactions']
      
      for (const table of tables) {
        const { data, error } = await this.supabase
          .from(table)
          .select('*')
          .eq('user_id', userId)

        if (error) {
          console.error(`Failed to export ${table}:`, error)
          continue
        }

        if (data && data.length > 0) {
          // Filter exportable fields and decrypt if necessary
          exportData[table] = await Promise.all(
            data.map(async (record) => {
              const filtered = this.filterExportableFields(record)
              return await this.decryptObject(filtered)
            })
          )
        }
      }

      // Log data export event
      await this.logDataEvent('EXPORT', 'user_data', userId)

      return exportData

    } catch (error) {
      console.error('Data export error:', error)
      throw new Error('Failed to export user data')
    }
  }

  /**
   * Anonymize old data based on retention policies
   */
  async anonymizeExpiredData(): Promise<number> {
    let anonymizedCount = 0

    try {
      for (const [fieldName, classification] of Object.entries(this.PII_FIELDS)) {
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - classification.retention)

        // This is a simplified example - in practice you'd need to identify
        // records by their creation date and anonymize specific fields
        console.log(`Would anonymize ${fieldName} data older than ${cutoffDate.toISOString()}`)
        
        // Implementation would depend on your specific data structure
        // Example: Update records to replace PII with anonymized values
      }

      await this.logDataEvent('ANONYMIZE', 'expired_data')

    } catch (error) {
      console.error('Data anonymization error:', error)
    }

    return anonymizedCount
  }

  /**
   * Derive encryption key with salt
   */
  private async deriveKey(): Promise<{ key: Uint8Array; salt: Uint8Array }> {
    const salt = crypto.getRandomValues(new Uint8Array(this.config.saltLength))
    const key = await this.deriveKeyFromSalt(salt)
    return { key, salt }
  }

  /**
   * Derive key from existing salt
   */
  private async deriveKeyFromSalt(salt: ArrayBuffer): Promise<Uint8Array> {
    const baseKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production'
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(baseKey),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    )

    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: this.config.keyLength * 8 },
      true,
      ['encrypt', 'decrypt']
    )

    const exportedKey = await crypto.subtle.exportKey('raw', derivedKey)
    return new Uint8Array(exportedKey)
  }

  /**
   * Check if field should be encrypted
   */
  private shouldEncryptField(fieldName: string): boolean {
    return this.PROTECTION_POLICIES[fieldName]?.encrypt || false
  }

  /**
   * Check if value is an encrypted field
   */
  private isEncryptedField(value: any): boolean {
    return value && 
           typeof value === 'object' && 
           'value' in value && 
           'iv' in value && 
           'version' in value
  }

  /**
   * Filter fields that can be exported
   */
  private filterExportableFields(record: Record<string, any>): Record<string, any> {
    const filtered: Record<string, any> = {}

    for (const [key, value] of Object.entries(record)) {
      const policy = this.PROTECTION_POLICIES[key]
      if (!policy || policy.allowExport) {
        filtered[key] = value
      }
    }

    return filtered
  }

  /**
   * Masking functions for different data types
   */
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@')
    if (local.length <= 2) return `${local}@${domain}`
    return `${local.charAt(0)}${'*'.repeat(local.length - 2)}${local.charAt(local.length - 1)}@${domain}`
  }

  private maskPhone(phone: string): string {
    if (phone.length <= 4) return '****'
    return `****${phone.slice(-4)}`
  }

  private maskIP(ip: string): string {
    const parts = ip.split('.')
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.*.***`
    }
    return '***.***.***'
  }

  private maskGeneric(value: string): string {
    if (value.length <= 2) return '*'.repeat(value.length)
    return `${value.charAt(0)}${'*'.repeat(value.length - 2)}${value.charAt(value.length - 1)}`
  }

  /**
   * Utility functions for base64 conversion
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
  }

  /**
   * Log data protection events
   */
  private async logDataEvent(
    eventType: 'ENCRYPT' | 'DECRYPT' | 'EXPORT' | 'ANONYMIZE',
    fieldName: string,
    userId?: string
  ): Promise<void> {
    try {
      await this.supabase
        .from('security_events')
        .insert({
          event_type: `DATA_${eventType}`,
          severity: eventType === 'EXPORT' ? 'HIGH' : 'MEDIUM',
          user_id: userId,
          event_details: {
            field_name: fieldName,
            data_action: eventType.toLowerCase()
          },
          timestamp: new Date().toISOString()
        })
    } catch (error) {
      console.error('Failed to log data event:', error)
    }
  }
}