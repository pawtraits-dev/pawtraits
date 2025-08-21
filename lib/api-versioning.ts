/**
 * SECURITY CRITICAL: API Versioning and Deprecation Management
 * 
 * Provides comprehensive API lifecycle management:
 * - Semantic versioning support (v1, v2, etc.)
 * - Backward compatibility handling
 * - Deprecation warnings and sunset dates
 * - Breaking change notifications
 * - Client version tracking and analytics
 * - Automatic migration assistance
 */

import { NextRequest, NextResponse } from 'next/server'

export interface APIVersion {
  version: string
  isActive: boolean
  isDeprecated: boolean
  deprecationDate?: Date
  sunsetDate?: Date
  supportLevel: 'full' | 'maintenance' | 'security_only' | 'unsupported'
  breakingChanges: string[]
  migrationGuide?: string
  compatibilityNotes: string[]
}

export interface VersionConfig {
  currentVersion: string
  defaultVersion: string
  supportedVersions: APIVersion[]
  extractVersion: (req: NextRequest) => string | null
  onVersionDeprecated?: (version: string, req: NextRequest) => void
  onUnsupportedVersion?: (version: string, req: NextRequest) => void
}

export interface ClientVersionInfo {
  clientId: string
  versions: string[]
  lastSeen: Date
  userAgent: string
  ipAddress: string
  migrationStatus: 'not_started' | 'in_progress' | 'completed'
  notifications: VersionNotification[]
}

export interface VersionNotification {
  type: 'deprecation' | 'sunset' | 'breaking_change' | 'migration_available'
  message: string
  actionRequired: boolean
  deadline?: Date
  resources: string[]
  sentAt: Date
}

export interface VersionUsageStats {
  version: string
  requestCount: number
  uniqueClients: number
  errorRate: number
  avgResponseTime: number
  lastUsed: Date
}

export interface MigrationPath {
  fromVersion: string
  toVersion: string
  steps: MigrationStep[]
  estimatedEffort: 'low' | 'medium' | 'high'
  breakingChanges: string[]
  testingGuidance: string[]
}

export interface MigrationStep {
  title: string
  description: string
  type: 'required' | 'recommended' | 'optional'
  codeExamples?: Record<string, string> // language -> code
  validation?: string
}

export class APIVersioningService {
  private config: VersionConfig
  private clientVersions = new Map<string, ClientVersionInfo>()
  private usageStats = new Map<string, VersionUsageStats>()
  private migrationPaths: MigrationPath[] = []

  constructor(config: VersionConfig) {
    this.config = config
    this.initializeMigrationPaths()
  }

  /**
   * Handle versioned API request
   */
  async handleVersionedRequest(req: NextRequest): Promise<{
    version: string
    response?: NextResponse
    warnings: string[]
    deprecated: boolean
    requiresMigration: boolean
  }> {
    const result = {
      version: this.config.defaultVersion,
      response: undefined as NextResponse | undefined,
      warnings: [] as string[],
      deprecated: false,
      requiresMigration: false
    }

    try {
      // Extract version from request
      const requestedVersion = this.config.extractVersion(req) || this.config.defaultVersion
      result.version = requestedVersion

      // Validate version
      const versionInfo = this.config.supportedVersions.find(v => v.version === requestedVersion)
      
      if (!versionInfo) {
        // Unsupported version
        result.response = this.createUnsupportedVersionResponse(requestedVersion, req)
        this.config.onUnsupportedVersion?.(requestedVersion, req)
        return result
      }

      // Check if version is active
      if (!versionInfo.isActive) {
        result.response = this.createInactiveVersionResponse(requestedVersion, req)
        return result
      }

      // Handle deprecated versions
      if (versionInfo.isDeprecated) {
        result.deprecated = true
        result.requiresMigration = versionInfo.supportLevel === 'security_only'
        
        const deprecationWarning = this.generateDeprecationWarning(versionInfo)
        result.warnings.push(deprecationWarning)
        
        this.config.onVersionDeprecated?.(requestedVersion, req)
      }

      // Track client version usage
      await this.trackClientVersion(req, requestedVersion)

      // Add version headers to response (will be applied by caller)
      // Headers are returned in the warnings array for now
      result.warnings.push(`API-Version: ${requestedVersion}`)
      result.warnings.push(`API-Supported-Versions: ${this.getSupportedVersionsList()}`)
      
      if (versionInfo.isDeprecated && versionInfo.sunsetDate) {
        result.warnings.push(`API-Sunset: ${versionInfo.sunsetDate.toISOString()}`)
      }

      return result

    } catch (error) {
      console.error('API versioning error:', error)
      result.response = NextResponse.json(
        { error: 'Version handling failed' },
        { status: 500 }
      )
      return result
    }
  }

  /**
   * Get migration path between versions
   */
  getMigrationPath(fromVersion: string, toVersion: string): MigrationPath | null {
    return this.migrationPaths.find(
      path => path.fromVersion === fromVersion && path.toVersion === toVersion
    ) || null
  }

  /**
   * Generate migration guide for client
   */
  generateMigrationGuide(fromVersion: string, toVersion?: string): {
    recommendedPath: MigrationPath | null
    alternativePaths: MigrationPath[]
    estimatedTimeline: string
    criticalChanges: string[]
  } {
    const targetVersion = toVersion || this.config.currentVersion
    
    const recommendedPath = this.getMigrationPath(fromVersion, targetVersion)
    const alternativePaths = this.migrationPaths.filter(
      path => path.fromVersion === fromVersion && path.toVersion !== targetVersion
    )

    const criticalChanges: string[] = []
    
    // Collect breaking changes from all versions between from and to
    const fromVersionInfo = this.config.supportedVersions.find(v => v.version === fromVersion)
    const toVersionInfo = this.config.supportedVersions.find(v => v.version === targetVersion)
    
    if (fromVersionInfo && toVersionInfo) {
      criticalChanges.push(...fromVersionInfo.breakingChanges)
    }

    return {
      recommendedPath,
      alternativePaths,
      estimatedTimeline: recommendedPath?.estimatedEffort === 'low' ? '1-2 days' :
                        recommendedPath?.estimatedEffort === 'medium' ? '1-2 weeks' : '1+ months',
      criticalChanges
    }
  }

  /**
   * Get version usage statistics
   */
  getUsageStatistics(days: number = 30): {
    totalRequests: number
    versionDistribution: Record<string, number>
    deprecatedVersionUsage: Record<string, number>
    topClients: Array<{ clientId: string; requestCount: number; version: string }>
  } {
    const stats = {
      totalRequests: 0,
      versionDistribution: {} as Record<string, number>,
      deprecatedVersionUsage: {} as Record<string, number>,
      topClients: [] as Array<{ clientId: string; requestCount: number; version: string }>
    }

    // Calculate from stored usage stats
    for (const [version, versionStats] of this.usageStats) {
      stats.totalRequests += versionStats.requestCount
      stats.versionDistribution[version] = versionStats.requestCount

      const versionInfo = this.config.supportedVersions.find(v => v.version === version)
      if (versionInfo?.isDeprecated) {
        stats.deprecatedVersionUsage[version] = versionStats.requestCount
      }
    }

    // Get top clients (simplified - would need more detailed tracking in production)
    for (const [clientId, clientInfo] of this.clientVersions) {
      for (const version of clientInfo.versions) {
        const versionStats = this.usageStats.get(version)
        if (versionStats) {
          stats.topClients.push({
            clientId,
            requestCount: versionStats.requestCount,
            version
          })
        }
      }
    }

    // Sort and limit top clients
    stats.topClients.sort((a, b) => b.requestCount - a.requestCount)
    stats.topClients = stats.topClients.slice(0, 10)

    return stats
  }

  /**
   * Send deprecation notifications to clients
   */
  async sendDeprecationNotifications(version: string): Promise<number> {
    let notificationsSent = 0
    const versionInfo = this.config.supportedVersions.find(v => v.version === version)
    
    if (!versionInfo || !versionInfo.isDeprecated) {
      return 0
    }

    for (const [clientId, clientInfo] of this.clientVersions) {
      if (clientInfo.versions.includes(version)) {
        const notification: VersionNotification = {
          type: 'deprecation',
          message: this.generateDeprecationWarning(versionInfo),
          actionRequired: versionInfo.sunsetDate ? 
            new Date() > new Date(versionInfo.sunsetDate.getTime() - 90 * 24 * 60 * 60 * 1000) : // 90 days before sunset
            false,
          deadline: versionInfo.sunsetDate,
          resources: [
            `/docs/api/migration/${version}`,
            `/docs/api/changelog`,
            versionInfo.migrationGuide || ''
          ].filter(Boolean),
          sentAt: new Date()
        }

        clientInfo.notifications.push(notification)
        notificationsSent++

        // In a real implementation, you would send actual notifications
        // (email, webhook, in-app notification, etc.)
        console.log(`Deprecation notification sent to client ${clientId}`)
      }
    }

    return notificationsSent
  }

  /**
   * Add new API version
   */
  addVersion(version: APIVersion): void {
    const existingIndex = this.config.supportedVersions.findIndex(v => v.version === version.version)
    
    if (existingIndex >= 0) {
      this.config.supportedVersions[existingIndex] = version
    } else {
      this.config.supportedVersions.push(version)
    }

    // Sort versions (assuming semantic versioning)
    this.config.supportedVersions.sort((a, b) => this.compareVersions(b.version, a.version))
  }

  /**
   * Deprecate API version
   */
  deprecateVersion(
    version: string, 
    sunsetDate: Date, 
    migrationGuide?: string,
    breakingChanges: string[] = []
  ): boolean {
    const versionInfo = this.config.supportedVersions.find(v => v.version === version)
    
    if (!versionInfo) {
      return false
    }

    versionInfo.isDeprecated = true
    versionInfo.deprecationDate = new Date()
    versionInfo.sunsetDate = sunsetDate
    versionInfo.supportLevel = 'maintenance'
    versionInfo.migrationGuide = migrationGuide
    versionInfo.breakingChanges = [...versionInfo.breakingChanges, ...breakingChanges]

    // Automatically send notifications to clients using this version
    this.sendDeprecationNotifications(version)

    return true
  }

  /**
   * Private helper methods
   */
  private async trackClientVersion(req: NextRequest, version: string): Promise<void> {
    const clientId = this.generateClientId(req)
    const now = new Date()

    // Update client info
    if (!this.clientVersions.has(clientId)) {
      this.clientVersions.set(clientId, {
        clientId,
        versions: [version],
        lastSeen: now,
        userAgent: req.headers.get('user-agent') || 'unknown',
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        migrationStatus: 'not_started',
        notifications: []
      })
    } else {
      const clientInfo = this.clientVersions.get(clientId)!
      if (!clientInfo.versions.includes(version)) {
        clientInfo.versions.push(version)
      }
      clientInfo.lastSeen = now
    }

    // Update usage stats
    if (!this.usageStats.has(version)) {
      this.usageStats.set(version, {
        version,
        requestCount: 0,
        uniqueClients: 0,
        errorRate: 0,
        avgResponseTime: 0,
        lastUsed: now
      })
    }

    const stats = this.usageStats.get(version)!
    stats.requestCount++
    stats.lastUsed = now
    
    // Count unique clients for this version
    const clientsUsingVersion = Array.from(this.clientVersions.values())
      .filter(client => client.versions.includes(version))
    stats.uniqueClients = clientsUsingVersion.length
  }

  private generateClientId(req: NextRequest): string {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'
    
    // Simple hash for client identification (use proper hashing in production)
    const data = `${ip}|${userAgent}`
    let hash = 0
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return `client_${Math.abs(hash).toString(36)}`
  }

  private createUnsupportedVersionResponse(version: string, req: NextRequest): NextResponse {
    const supportedVersions = this.config.supportedVersions
      .filter(v => v.isActive)
      .map(v => v.version)

    return NextResponse.json(
      {
        error: 'Unsupported API version',
        message: `API version '${version}' is not supported`,
        supportedVersions,
        currentVersion: this.config.currentVersion,
        migrationGuide: `/docs/api/migration/${version}`
      },
      { 
        status: 400,
        headers: {
          'API-Version': this.config.currentVersion,
          'API-Supported-Versions': supportedVersions.join(', ')
        }
      }
    )
  }

  private createInactiveVersionResponse(version: string, req: NextRequest): NextResponse {
    return NextResponse.json(
      {
        error: 'API version inactive',
        message: `API version '${version}' is no longer active`,
        currentVersion: this.config.currentVersion,
        migrationRequired: true
      },
      { 
        status: 410, // Gone
        headers: {
          'API-Version': this.config.currentVersion
        }
      }
    )
  }

  private generateDeprecationWarning(versionInfo: APIVersion): string {
    let message = `API version ${versionInfo.version} is deprecated`
    
    if (versionInfo.deprecationDate) {
      message += ` as of ${versionInfo.deprecationDate.toISOString().split('T')[0]}`
    }
    
    if (versionInfo.sunsetDate) {
      const daysUntilSunset = Math.ceil(
        (versionInfo.sunsetDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      )
      message += `. This version will be retired in ${daysUntilSunset} days`
    }
    
    message += `. Please migrate to version ${this.config.currentVersion}`
    
    return message
  }

  private getSupportedVersionsList(): string {
    return this.config.supportedVersions
      .filter(v => v.isActive)
      .map(v => v.version)
      .join(', ')
  }

  private compareVersions(a: string, b: string): number {
    const aParts = a.replace(/^v/, '').split('.').map(Number)
    const bParts = b.replace(/^v/, '').split('.').map(Number)
    
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aPart = aParts[i] || 0
      const bPart = bParts[i] || 0
      
      if (aPart > bPart) return 1
      if (aPart < bPart) return -1
    }
    
    return 0
  }

  private initializeMigrationPaths(): void {
    // Initialize common migration paths
    this.migrationPaths = [
      {
        fromVersion: 'v1',
        toVersion: 'v2',
        estimatedEffort: 'medium',
        breakingChanges: [
          'Authentication now requires API keys',
          'Response format changed from XML to JSON',
          'Error codes restructured'
        ],
        testingGuidance: [
          'Update authentication integration tests',
          'Verify JSON response parsing',
          'Test error handling for new error codes'
        ],
        steps: [
          {
            title: 'Update Authentication',
            description: 'Replace basic auth with API key authentication',
            type: 'required',
            codeExamples: {
              'javascript': 'headers: { "Authorization": "Bearer your-api-key" }',
              'python': 'headers = {"Authorization": "Bearer your-api-key"}',
              'curl': 'curl -H "Authorization: Bearer your-api-key"'
            }
          },
          {
            title: 'Update Response Parsing',
            description: 'Change from XML to JSON response parsing',
            type: 'required',
            codeExamples: {
              'javascript': 'const data = await response.json()',
              'python': 'data = response.json()'
            }
          }
        ]
      }
    ]
  }

  /**
   * Create versioning middleware
   */
  static createVersioningMiddleware(config: VersionConfig) {
    const service = new APIVersioningService(config)
    
    return async (req: NextRequest) => {
      const result = await service.handleVersionedRequest(req)
      
      if (result.response) {
        return result.response
      }
      
      // Add version info to request for downstream handlers
      ;(req as any).apiVersion = result.version
      ;(req as any).apiVersionInfo = {
        deprecated: result.deprecated,
        requiresMigration: result.requiresMigration,
        warnings: result.warnings
      }
      
      return null // Continue to next handler
    }
  }

  /**
   * Common version extraction strategies
   */
  static versionExtractors = {
    header: (headerName: string = 'api-version') => (req: NextRequest) =>
      req.headers.get(headerName),
    
    queryParam: (paramName: string = 'version') => (req: NextRequest) => {
      const url = new URL(req.url)
      return url.searchParams.get(paramName)
    },
    
    urlPath: (pathIndex: number = 1) => (req: NextRequest) => {
      const pathname = new URL(req.url).pathname
      const segments = pathname.split('/').filter(Boolean)
      return segments[pathIndex]?.startsWith('v') ? segments[pathIndex] : null
    },
    
    acceptHeader: () => (req: NextRequest) => {
      const accept = req.headers.get('accept') || ''
      const match = accept.match(/application\/vnd\.yourapi\.v(\d+)\+json/)
      return match ? `v${match[1]}` : null
    }
  }
}