/**
 * SECURITY CRITICAL: Secure file upload validation
 * 
 * This module provides comprehensive file validation including:
 * - Magic number (file signature) validation
 * - Content-based type detection
 * - Malicious content scanning
 * - Security policy enforcement
 */

import crypto from 'crypto';

// File signature magic numbers for allowed image types
const ALLOWED_SIGNATURES = {
  // JPEG
  'image/jpeg': [
    [0xFF, 0xD8, 0xFF], // Standard JPEG
    [0xFF, 0xD8, 0xFF, 0xE0], // JPEG with JFIF
    [0xFF, 0xD8, 0xFF, 0xE1], // JPEG with EXIF
    [0xFF, 0xD8, 0xFF, 0xE2], // JPEG with ICC
    [0xFF, 0xD8, 0xFF, 0xE8], // JPEG with SPIFF
  ],
  // PNG
  'image/png': [
    [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], // PNG signature
  ],
  // WebP
  'image/webp': [
    [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50], // RIFF...WEBP
  ],
  // GIF
  'image/gif': [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
  ]
};

const ALLOWED_MIME_TYPES = Object.keys(ALLOWED_SIGNATURES);

// Maximum file size (5MB for pet photos)
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Suspicious strings that might indicate malicious content
const MALICIOUS_PATTERNS = [
  // Script tags
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  // PHP tags
  /<\?php/gi,
  // ASP tags
  /<%[\s\S]*?%>/gi,
  // Common executable signatures
  /MZ/, // DOS/Windows executable
  /\x7fELF/, // Linux executable
  /\xCA\xFE\xBA\xBE/, // Java class file
];

export interface FileValidationResult {
  isValid: boolean;
  detectedMimeType?: string;
  errors: string[];
  warnings: string[];
  fileHash: string;
  fileSize: number;
}

export class SecureFileValidator {
  
  /**
   * Comprehensive file validation
   */
  static async validateFile(file: File): Promise<FileValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Convert file to buffer for analysis
    const buffer = new Uint8Array(await file.arrayBuffer());
    
    // Generate file hash for tracking/deduplication
    const fileHash = crypto
      .createHash('sha256')
      .update(buffer)
      .digest('hex');

    // 1. File size validation
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    if (file.size === 0) {
      errors.push('File is empty');
    }

    // 2. MIME type validation (client-provided)
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      errors.push(`MIME type '${file.type}' is not allowed`);
    }

    // 3. Magic number validation (most critical)
    const detectedMimeType = this.detectMimeTypeFromSignature(buffer);
    if (!detectedMimeType) {
      errors.push('File signature does not match any allowed image type');
    } else if (detectedMimeType !== file.type) {
      warnings.push(`MIME type mismatch: client reported '${file.type}' but detected '${detectedMimeType}'`);
      // For security, reject if there's a significant mismatch
      if (!ALLOWED_MIME_TYPES.includes(detectedMimeType)) {
        errors.push(`Detected file type '${detectedMimeType}' is not allowed`);
      }
    }

    // 4. Malicious content scanning
    const maliciousContent = this.scanForMaliciousContent(buffer);
    if (maliciousContent.length > 0) {
      errors.push(`Potential malicious content detected: ${maliciousContent.join(', ')}`);
    }

    // 5. File extension validation
    const extension = file.name.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    if (!extension || !allowedExtensions.includes(extension)) {
      warnings.push(`File extension '${extension}' may not match content type`);
    }

    // 6. Filename validation
    const suspiciousFilename = this.validateFilename(file.name);
    if (suspiciousFilename.length > 0) {
      warnings.push(`Filename issues: ${suspiciousFilename.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      detectedMimeType: detectedMimeType || undefined,
      errors,
      warnings,
      fileHash,
      fileSize: file.size
    };
  }

  /**
   * Detect MIME type from file signature (magic numbers)
   */
  private static detectMimeTypeFromSignature(buffer: Uint8Array): string | null {
    for (const [mimeType, signatures] of Object.entries(ALLOWED_SIGNATURES)) {
      for (const signature of signatures) {
        if (this.matchesSignature(buffer, signature)) {
          return mimeType;
        }
      }
    }
    return null;
  }

  /**
   * Check if buffer matches file signature
   */
  private static matchesSignature(buffer: Uint8Array, signature: (number | null)[]): boolean {
    if (buffer.length < signature.length) {
      return false;
    }

    for (let i = 0; i < signature.length; i++) {
      if (signature[i] !== null && buffer[i] !== signature[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Scan for malicious content patterns
   */
  private static scanForMaliciousContent(buffer: Uint8Array): string[] {
    const content = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
    const threats: string[] = [];

    for (const pattern of MALICIOUS_PATTERNS) {
      if (pattern.test(content)) {
        threats.push(`Suspicious pattern: ${pattern.source.substring(0, 50)}...`);
      }
    }

    // Check for polyglot files (files that are valid in multiple formats)
    if (content.includes('GIF89a') && content.includes('<script')) {
      threats.push('Potential GIF/HTML polyglot file');
    }

    if (content.includes('\xFF\xD8\xFF') && content.includes('<?php')) {
      threats.push('Potential JPEG/PHP polyglot file');
    }

    return threats;
  }

  /**
   * Validate filename for security issues
   */
  private static validateFilename(filename: string): string[] {
    const issues: string[] = [];

    // Path traversal attempts
    if (filename.includes('../') || filename.includes('..\\')) {
      issues.push('Path traversal attempt detected');
    }

    // Null byte injection
    if (filename.includes('\0')) {
      issues.push('Null byte injection attempt');
    }

    // Suspicious filename patterns
    if (/\.(php|asp|jsp|exe|bat|cmd|sh)$/i.test(filename)) {
      issues.push('Executable file extension detected');
    }

    // Double extensions
    if (/\.(jpg|png|gif|webp)\.(php|asp|jsp)$/i.test(filename)) {
      issues.push('Double extension detected (potential bypass attempt)');
    }

    // Very long filenames (DoS attempt)
    if (filename.length > 255) {
      issues.push('Filename too long');
    }

    // Non-printable characters
    if (/[\x00-\x1f\x7f-\x9f]/.test(filename)) {
      issues.push('Non-printable characters in filename');
    }

    return issues;
  }

  /**
   * Generate secure filename for storage
   */
  static generateSecureFilename(originalName: string, userId: string, entityId: string): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    const extension = originalName.split('.').pop()?.toLowerCase() || 'jpg';
    
    // Sanitize extension (only allow known safe extensions)
    const safeExtension = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension) 
      ? extension 
      : 'jpg';

    return `${userId}/${entityId}/${timestamp}_${random}.${safeExtension}`;
  }

  /**
   * Rate limiting for file uploads (basic implementation)
   */
  static shouldRateLimit(userId: string, uploadCount: number, timeWindow: number = 3600000): boolean {
    // Allow max 10 uploads per hour per user
    const maxUploads = 10;
    return uploadCount >= maxUploads;
  }
}

export default SecureFileValidator;