import { Controller, Get, Post, Body } from '@nestjs/common';
import { StructuredLoggerService } from './structured-logger.service';
import { PerformanceMonitorService } from './performance-monitor.service';
import { ErrorTrackerService } from './error-tracker.service';
import { ErrorSeverity } from './types';

/**
 * Test controller for manually testing monitoring services
 * Remove this file after testing or disable in production
 */
@Controller('api/v1/monitoring-test')
export class MonitoringTestController {
  constructor(
    private readonly logger: StructuredLoggerService,
    private readonly performance: PerformanceMonitorService,
    private readonly errorTracker: ErrorTrackerService,
  ) {}

  @Get('health')
  health() {
    return { status: 'ok', message: 'Monitoring test controller is running' };
  }

  @Post('test-logging')
  testLogging(@Body() body: { message?: string }) {
    const correlationId = this.logger.generateCorrelationId();
    const context = {
      correlationId,
      userId: 'test-user-123',
      businessId: 'test-business-456',
      stage: 'test-stage',
    };

    // Test different log levels
    this.logger.debug(body.message || 'Debug test message', context);
    this.logger.log(body.message || 'Info test message', context);
    this.logger.warn(body.message || 'Warning test message', context);

    // Test API call logging
    this.logger.logApiCall(
      'test-service',
      'test-operation',
      1234,
      context,
      'success',
    );

    // Test fallback logging
    this.logger.logFallback('claude', 'gemini', 'Testing fallback', context);

    return {
      success: true,
      correlationId,
      message:
        'Logs sent to Cloud Logging. Check GCP Console > Logging > Logs Explorer',
      filter: `labels.correlationId="${correlationId}"`,
    };
  }

  @Post('test-performance')
  testPerformance() {
    const correlationId = this.logger.generateCorrelationId();
    const context = {
      correlationId,
      userId: 'test-user-123',
    };

    // Test latency tracking
    this.performance.trackLatency(
      'test-api',
      'test-call',
      500,
      context,
      'success',
    );

    // Test count tracking
    this.performance.trackCount('test_metric', 1, context, {
      platform: 'test',
    });

    // Test timer
    const stopTimer = this.performance.startTimer('test-operation', context);
    // Simulate some work
    for (let i = 0; i < 1000000; i++) {
      // busy wait
    }
    stopTimer();

    const metrics = this.performance.getMetrics();

    return {
      success: true,
      correlationId,
      metrics,
      message: 'Performance metrics logged. Check GCP Console > Logging',
    };
  }

  @Post('test-error-tracking')
  testErrorTracking(@Body() body: { severity?: string; message?: string }) {
    const correlationId = this.logger.generateCorrelationId();
    const context = {
      userId: 'test-user-123',
      jobId: 'test-job-456',
      testData: 'some context',
    };

    const severityMap: Record<string, ErrorSeverity> = {
      low: ErrorSeverity.LOW,
      medium: ErrorSeverity.MEDIUM,
      high: ErrorSeverity.HIGH,
      critical: ErrorSeverity.CRITICAL,
    };

    const severity =
      severityMap[body.severity || 'medium'] || ErrorSeverity.MEDIUM;
    const error = new Error(
      body.message || 'Test error from monitoring controller',
    );

    this.errorTracker.reportError(error, severity, context, correlationId);

    const stats = this.errorTracker.getErrorStats();

    return {
      success: true,
      correlationId,
      severity,
      stats,
      message:
        'Error reported to Cloud Error Reporting. Check GCP Console > Error Reporting',
      link: 'https://console.cloud.google.com/errors',
    };
  }

  @Get('test-all')
  async testAll() {
    const correlationId = this.logger.generateCorrelationId();
    const context = {
      correlationId,
      userId: 'test-user-123',
      businessId: 'test-business-456',
      stage: 'integration-test',
    };

    // 1. Log messages
    this.logger.log('Starting integration test', context);

    // 2. Track performance
    const timer = this.performance.startTimer('integration-test', context);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 100));
    this.performance.trackLatency(
      'mock-api',
      'test-call',
      100,
      context,
      'success',
    );

    // 3. Track metrics
    this.performance.trackCount('integration_test_run', 1, context);

    // 4. Report a low-severity error (won't trigger alert)
    const testError = new Error('Test error - integration test');
    this.errorTracker.reportError(
      testError,
      ErrorSeverity.LOW,
      { testType: 'integration' },
      correlationId,
    );

    timer();

    this.logger.log('Integration test completed', context);

    return {
      success: true,
      correlationId,
      message:
        'Integration test completed. Check GCP Console for logs and errors.',
      links: {
        logs: `https://console.cloud.google.com/logs/query;query=labels.correlationId%3D%22${correlationId}%22`,
        errors: 'https://console.cloud.google.com/errors',
      },
    };
  }
}
