/**
 * ADAPTIVE BATCH SPEED CONTROLLER
 *
 * Intelligently adjusts batch processing speed based on:
 * - API success/failure rates
 * - Response times
 * - Error types (rate limiting, timeouts, server errors)
 * - Queue depth and processing pressure
 */

export interface BatchSpeedMetrics {
  successRate: number;        // 0.0 to 1.0
  averageResponseTime: number; // milliseconds
  errorRate: number;          // 0.0 to 1.0
  rateLimitHits: number;      // count of 429 errors
  timeouts: number;           // count of timeout errors
  serverErrors: number;       // count of 5xx errors
  queueDepth: number;         // items pending processing
}

export interface BatchSpeedConfig {
  minDelayMs: number;         // Minimum delay between items
  maxDelayMs: number;         // Maximum delay between items
  baseDelayMs: number;        // Starting delay
  successThreshold: number;   // Success rate to trigger speed up (e.g., 0.9)
  errorThreshold: number;     // Error rate to trigger slow down (e.g., 0.1)
  adjustmentFactor: number;   // How much to adjust by (e.g., 1.5)
  windowSize: number;         // Number of recent operations to consider
}

export interface BatchSpeedRecommendation {
  delayMs: number;
  parallelism: number;        // How many parallel requests to allow
  reasoning: string;
  confidence: number;         // 0.0 to 1.0
  adjustmentType: 'speed_up' | 'slow_down' | 'maintain' | 'emergency_brake';
}

export class AdaptiveBatchSpeedController {
  private config: BatchSpeedConfig;
  private recentResults: Array<{
    success: boolean;
    responseTimeMs: number;
    errorType?: 'rate_limit' | 'timeout' | 'server_error' | 'client_error';
    timestamp: number;
  }> = [];

  private currentDelayMs: number;
  private currentParallelism: number = 1;

  constructor(config?: Partial<BatchSpeedConfig>) {
    this.config = {
      minDelayMs: 500,           // 0.5s minimum
      maxDelayMs: 10000,         // 10s maximum
      baseDelayMs: 1500,         // 1.5s starting point
      successThreshold: 0.85,     // 85% success rate
      errorThreshold: 0.15,       // 15% error rate
      adjustmentFactor: 1.3,      // 30% adjustment steps
      windowSize: 20,             // Consider last 20 operations
      ...config
    };

    this.currentDelayMs = this.config.baseDelayMs;
  }

  /**
   * Record the result of a batch operation
   */
  recordResult(success: boolean, responseTimeMs: number, errorType?: string) {
    const timestamp = Date.now();

    // Map error types
    let mappedErrorType: 'rate_limit' | 'timeout' | 'server_error' | 'client_error' | undefined;
    if (errorType) {
      if (errorType.includes('429') || errorType.toLowerCase().includes('rate limit')) {
        mappedErrorType = 'rate_limit';
      } else if (errorType.toLowerCase().includes('timeout')) {
        mappedErrorType = 'timeout';
      } else if (errorType.includes('5')) {
        mappedErrorType = 'server_error';
      } else {
        mappedErrorType = 'client_error';
      }
    }

    this.recentResults.push({
      success,
      responseTimeMs,
      errorType: mappedErrorType,
      timestamp
    });

    // Keep only recent results within window
    if (this.recentResults.length > this.config.windowSize) {
      this.recentResults = this.recentResults.slice(-this.config.windowSize);
    }

    console.log(`📊 Speed Controller: Recorded ${success ? 'SUCCESS' : 'FAILURE'} (${responseTimeMs}ms) - Window: ${this.recentResults.length} results`);
  }

  /**
   * Get current metrics from recent operations
   */
  private getMetrics(): BatchSpeedMetrics {
    if (this.recentResults.length === 0) {
      return {
        successRate: 1.0,
        averageResponseTime: 0,
        errorRate: 0.0,
        rateLimitHits: 0,
        timeouts: 0,
        serverErrors: 0,
        queueDepth: 0
      };
    }

    const successes = this.recentResults.filter(r => r.success).length;
    const failures = this.recentResults.length - successes;
    const totalResponseTime = this.recentResults.reduce((sum, r) => sum + r.responseTimeMs, 0);

    const rateLimitHits = this.recentResults.filter(r => r.errorType === 'rate_limit').length;
    const timeouts = this.recentResults.filter(r => r.errorType === 'timeout').length;
    const serverErrors = this.recentResults.filter(r => r.errorType === 'server_error').length;

    return {
      successRate: successes / this.recentResults.length,
      averageResponseTime: totalResponseTime / this.recentResults.length,
      errorRate: failures / this.recentResults.length,
      rateLimitHits,
      timeouts,
      serverErrors,
      queueDepth: 0 // This would come from external queue monitoring
    };
  }

  /**
   * Get recommendation for next batch operation speed
   */
  getSpeedRecommendation(): BatchSpeedRecommendation {
    const metrics = this.getMetrics();

    // Emergency brake conditions
    if (metrics.rateLimitHits >= 3 && this.recentResults.length >= 5) {
      this.currentDelayMs = Math.min(this.currentDelayMs * 2, this.config.maxDelayMs);
      this.currentParallelism = 1;
      return {
        delayMs: this.currentDelayMs,
        parallelism: this.currentParallelism,
        reasoning: `Emergency brake: ${metrics.rateLimitHits} rate limit hits detected`,
        confidence: 0.95,
        adjustmentType: 'emergency_brake'
      };
    }

    // Very high error rate - slow down significantly
    if (metrics.errorRate > this.config.errorThreshold * 2) {
      this.currentDelayMs = Math.min(this.currentDelayMs * this.config.adjustmentFactor, this.config.maxDelayMs);
      this.currentParallelism = 1;
      return {
        delayMs: this.currentDelayMs,
        parallelism: this.currentParallelism,
        reasoning: `High error rate: ${(metrics.errorRate * 100).toFixed(1)}% - slowing down`,
        confidence: 0.8,
        adjustmentType: 'slow_down'
      };
    }

    // High success rate and low response times - speed up
    if (metrics.successRate > this.config.successThreshold &&
        metrics.averageResponseTime < 30000 && // Less than 30s average
        metrics.rateLimitHits === 0) {

      this.currentDelayMs = Math.max(this.currentDelayMs / this.config.adjustmentFactor, this.config.minDelayMs);

      // Consider parallel processing for very good performance
      if (metrics.successRate > 0.95 && metrics.averageResponseTime < 20000) {
        this.currentParallelism = Math.min(this.currentParallelism + 1, 3); // Max 3 parallel
      }

      return {
        delayMs: this.currentDelayMs,
        parallelism: this.currentParallelism,
        reasoning: `High success rate: ${(metrics.successRate * 100).toFixed(1)}% - speeding up`,
        confidence: 0.7,
        adjustmentType: 'speed_up'
      };
    }

    // Moderate error rate - slow down slightly
    if (metrics.errorRate > this.config.errorThreshold) {
      this.currentDelayMs = Math.min(this.currentDelayMs * 1.1, this.config.maxDelayMs);
      this.currentParallelism = Math.max(this.currentParallelism - 1, 1);
      return {
        delayMs: this.currentDelayMs,
        parallelism: this.currentParallelism,
        reasoning: `Moderate error rate: ${(metrics.errorRate * 100).toFixed(1)}% - slight slowdown`,
        confidence: 0.6,
        adjustmentType: 'slow_down'
      };
    }

    // Everything looks stable - maintain current speed
    return {
      delayMs: this.currentDelayMs,
      parallelism: this.currentParallelism,
      reasoning: `Stable performance: ${(metrics.successRate * 100).toFixed(1)}% success rate - maintaining speed`,
      confidence: 0.5,
      adjustmentType: 'maintain'
    };
  }

  /**
   * Get current status for monitoring dashboard
   */
  getStatus() {
    const metrics = this.getMetrics();
    const recommendation = this.getSpeedRecommendation();

    return {
      metrics,
      currentDelayMs: this.currentDelayMs,
      currentParallelism: this.currentParallelism,
      recommendation,
      recentResultsCount: this.recentResults.length,
      windowUtilization: (this.recentResults.length / this.config.windowSize) * 100
    };
  }

  /**
   * Reset the controller (e.g., for new batch job)
   */
  reset() {
    this.recentResults = [];
    this.currentDelayMs = this.config.baseDelayMs;
    this.currentParallelism = 1;
    console.log('🔄 Speed Controller: Reset to defaults');
  }

  /**
   * Manual override for emergency situations
   */
  setEmergencyMode(enable: boolean) {
    if (enable) {
      this.currentDelayMs = this.config.maxDelayMs;
      this.currentParallelism = 1;
      console.log('🚨 Speed Controller: Emergency mode ENABLED');
    } else {
      this.currentDelayMs = this.config.baseDelayMs;
      console.log('✅ Speed Controller: Emergency mode DISABLED');
    }
  }
}