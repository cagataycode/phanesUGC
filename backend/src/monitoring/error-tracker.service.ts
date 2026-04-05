import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErrorReporting } from '@google-cloud/error-reporting';
import { AppError, ErrorSeverity } from './types';
import { Env } from '../config/env';

/**
 * ErrorTrackerService - Tracks and reports errors to Google Cloud Error Reporting
 *
 * Features:
 * - Error severity classification
 * - Error grouping
 * - Alert triggering
 * - Integration with Cloud Error Reporting
 */
@Injectable()
export class ErrorTrackerService {
  private readonly logger = new Logger(ErrorTrackerService.name);
  private readonly errorReporting: ErrorReporting | null;
  private readonly alertEmail: string;
  private readonly errorCounts: Map<string, number> = new Map();
  private readonly errorCountsCleanup: Map<string, NodeJS.Timeout> = new Map();
  private readonly ERROR_COUNT_TTL_MS = 60 * 60 * 1000; // 1 hour
  private readonly errorReportingEnabled: boolean;

  constructor(private readonly configService: ConfigService<Env>) {
    // Initialize Cloud Error Reporting only if credentials are available
    const projectId = this.configService.get('GCP_PROJECT_ID', { infer: true });
    const enableErrorReporting =
      this.configService.get('ENABLE_ERROR_REPORTING', { infer: true }) !==
      'false';

    this.errorReportingEnabled = enableErrorReporting && !!projectId;

    if (this.errorReportingEnabled) {
      try {
        const serviceContext = {
          service: 'phanes-backend',
          version: process.env.npm_package_version || '1.0.0',
        };

        this.errorReporting = new ErrorReporting({
          projectId,
          serviceContext,
          reportMode: 'production',
        });

        this.logger.log(
          `ErrorTracker initialized with Cloud Error Reporting for project: ${projectId}`,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to initialize Cloud Error Reporting: ${error instanceof Error ? error.message : String(error)}. Continuing with local logging only.`,
        );
        this.errorReporting = null;
        this.errorReportingEnabled = false;
      }
    } else {
      this.errorReporting = null;
      this.logger.log(
        'ErrorTracker initialized without Cloud Error Reporting (local logging only)',
      );
    }

    this.alertEmail =
      this.configService.get('ALERT_EMAIL', { infer: true }) || '';
  }

  /**
   * Cleanup method called when service is destroyed
   */
  onModuleDestroy(): void {
    // Clear all pending timeouts
    this.errorCountsCleanup.forEach((timeout) => {
      clearTimeout(timeout);
    });
    this.errorCountsCleanup.clear();
    this.errorCounts.clear();
  }

  /**
   * Report an error with context
   */
  reportError(
    error: Error,
    severity: ErrorSeverity,
    context: Record<string, unknown>,
    correlationId: string,
  ): void {
    const appError: AppError = {
      code: (error as { code?: string }).code || 'UNKNOWN_ERROR',
      message: error.message,
      severity,
      context,
      timestamp: new Date(),
      correlationId,
    };

    // Log error
    this.logger.error(
      `[${severity}] ${error.message}`,
      error.stack,
      JSON.stringify(context),
    );

    // Report to Cloud Error Reporting
    this.reportToCloudErrorReporting(error, appError);

    // Track error count for alerting
    this.trackErrorCount(appError);

    // Check if alert should be triggered
    if (this.shouldAlert(severity)) {
      this.triggerAlert(appError);
    }
  }

  /**
   * Report error to Cloud Error Reporting
   */
  private reportToCloudErrorReporting(error: Error, appError: AppError): void {
    // Skip if Error Reporting is not enabled
    if (!this.errorReportingEnabled || !this.errorReporting) {
      return;
    }

    try {
      // Add context to error for better grouping
      const errorWithContext = new Error(error.message) as Error & {
        context: Record<string, unknown>;
        correlationId: string;
        severity: ErrorSeverity;
      };
      errorWithContext.stack = error.stack;

      errorWithContext.context = appError.context;

      errorWithContext.correlationId = appError.correlationId;

      errorWithContext.severity = appError.severity;

      this.errorReporting.report(errorWithContext);
    } catch (reportError) {
      this.logger.error(
        `Failed to report to Cloud Error Reporting: ${reportError instanceof Error ? reportError.message : String(reportError)}`,
      );
    }
  }

  /**
   * Track error count for alerting
   * Prevents memory leaks by clearing existing timeouts before setting new ones
   */
  private trackErrorCount(appError: AppError): void {
    const key = `${appError.severity}:${appError.code}`;

    // Clear existing timeout if present
    const existingTimeout = this.errorCountsCleanup.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Update count
    const currentCount = this.errorCounts.get(key) || 0;
    this.errorCounts.set(key, currentCount + 1);

    // Set new timeout and track it
    const timeout = setTimeout(() => {
      this.errorCounts.delete(key);
      this.errorCountsCleanup.delete(key);
    }, this.ERROR_COUNT_TTL_MS);

    this.errorCountsCleanup.set(key, timeout);
  }

  /**
   * Check if alert should be triggered based on severity
   */
  private shouldAlert(severity: ErrorSeverity): boolean {
    return (
      severity === ErrorSeverity.CRITICAL || severity === ErrorSeverity.HIGH
    );
  }

  /**
   * Trigger alert (email notification)
   */
  private triggerAlert(appError: AppError): void {
    if (!this.alertEmail) {
      this.logger.warn('Alert email not configured, skipping alert');
      return;
    }

    // Log alert (in production, this would send an email via SendGrid or Cloud Functions)
    this.logger.error(
      `🚨 ALERT: ${appError.severity} error - ${appError.message}`,
      JSON.stringify({
        code: appError.code,
        correlationId: appError.correlationId,
        context: appError.context,
        alertEmail: this.alertEmail,
      }),
    );

    // TODO: Implement actual email sending via SendGrid or Cloud Functions
    // For now, we rely on Cloud Error Reporting's built-in alerting
  }

  /**
   * Get error statistics
   */
  getErrorStats(): Record<
    string,
    { count: number; severity: ErrorSeverity; code: string }
  > {
    const stats: Record<
      string,
      { count: number; severity: ErrorSeverity; code: string }
    > = {};

    this.errorCounts.forEach((count, key) => {
      const [severity, code] = key.split(':');
      stats[key] = {
        count,
        severity: severity as ErrorSeverity,
        code,
      };
    });

    return stats;
  }

  /**
   * Clear error counts (for testing)
   */
  clearErrorCounts(): void {
    // Clear all timeouts first
    this.errorCountsCleanup.forEach((timeout) => {
      clearTimeout(timeout);
    });
    this.errorCountsCleanup.clear();
    this.errorCounts.clear();
  }
}
