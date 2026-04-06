import { Injectable } from '@nestjs/common';
import { LogContext } from './types';
import { StructuredLoggerService } from './structured-logger.service';

/**
 * PerformanceMonitorService - Tracks performance metrics
 *
 * Features:
 * - Latency tracking
 * - Count tracking
 * - Timer utilities
 * - Metric aggregation
 *
 * Note: For backend services, we use Cloud Logging for metrics.
 * Firebase Performance Monitoring is for client-side apps only.
 */
@Injectable()
export class PerformanceMonitorService {
  private readonly metrics: Map<string, number> = new Map();

  constructor(private readonly structuredLogger: StructuredLoggerService) {}

  /**
   * Track latency for an operation (API call)
   */
  trackLatency(
    service: string,
    operation: string,
    latency: number,
    context: LogContext,
    status?: 'success' | 'failure',
  ): void {
    this.structuredLogger.logApiCall(
      service,
      operation,
      latency,
      context,
      status,
    );
  }

  /**
   * Track a count metric
   */
  trackCount(
    metric: string,
    value: number,
    context: LogContext,
    metadata?: Record<string, unknown>,
  ): void {
    // Aggregate metrics
    const currentValue = this.metrics.get(metric) || 0;
    this.metrics.set(metric, currentValue + value);

    // Log to structured logger
    const logContext: LogContext = {
      ...context,
      metric,
      value,
      ...metadata,
    };

    this.structuredLogger.log(`Metric: ${metric} = ${value}`, logContext);
  }

  /**
   * Start a timer and return a function to stop it
   */
  startTimer(
    operation: string,
    context: LogContext,
    metadata?: Record<string, unknown>,
  ): () => void {
    const startTime = Date.now();

    return () => {
      const duration = Date.now() - startTime;

      const logContext: LogContext = {
        ...context,
        operation,
        duration,
        ...metadata,
      };

      this.structuredLogger.log(
        `Operation: ${operation} completed in ${duration}ms`,
        logContext,
      );
    };
  }

  /**
   * Get all metrics (for testing/debugging)
   */
  getMetrics(): Record<string, number> {
    const result: Record<string, number> = {};
    this.metrics.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  /**
   * Clear metrics (for testing)
   */
  clearMetrics(): void {
    this.metrics.clear();
  }
}
