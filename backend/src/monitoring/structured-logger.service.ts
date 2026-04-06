import { Injectable, Logger, LogLevel } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logging } from '@google-cloud/logging';
import { v4 as uuidv4 } from 'uuid';
import { LogContext, LogEntry } from './types';
import { Env } from '../config/env';

/**
 * Type definitions for Google Cloud Logging SDK
 * These provide type safety for the loosely-typed SDK
 */
interface CloudLogEntry {
  severity: string;
  labels: Record<string, string>;
}

interface CloudLogWriter {
  entry(metadata: CloudLogEntry, data: unknown): unknown;
  write(entry: unknown): Promise<void>;
}

interface CloudLogging {
  log(name: string): CloudLogWriter;
}

/**
 * StructuredLoggerService - Provides structured JSON logging with correlation IDs
 *
 * Features:
 * - JSON-formatted logs for Cloud Logging
 * - Correlation ID propagation
 * - Context enrichment (userId, businessId, jobId, stage)
 * - API call logging
 * - LLM fallback logging
 */
@Injectable()
export class StructuredLoggerService {
  private readonly logger = new Logger(StructuredLoggerService.name);
  private readonly cloudLogging: CloudLogging;
  private readonly cloudLogger: CloudLogWriter;
  private readonly logLevel: LogLevel;
  private readonly enableStructuredLogging: boolean;

  constructor(private readonly configService: ConfigService<Env>) {
    // Get log level from config (defaults to 'log')
    const logLevelStr =
      this.configService.get('LOG_LEVEL', { infer: true }) || 'log';
    this.logLevel = logLevelStr as LogLevel;

    // Check if structured logging is enabled
    this.enableStructuredLogging =
      this.configService.get('ENABLE_STRUCTURED_LOGGING', { infer: true }) ===
      'true';

    // Only initialize Cloud Logging if structured logging is enabled
    if (this.enableStructuredLogging) {
      const projectId = this.configService.get('GCP_PROJECT_ID', {
        infer: true,
      });

      // Use Firebase service account credentials for Cloud Logging
      const privateKey = this.configService.get('FIREBASE_PRIVATE_KEY', {
        infer: true,
      });
      const clientEmail = this.configService.get('FIREBASE_CLIENT_EMAIL', {
        infer: true,
      });

      this.cloudLogging = new Logging({
        projectId,
        credentials: {
          client_email: clientEmail,
          private_key: privateKey,
        },
      }) as unknown as CloudLogging;
      this.cloudLogger = this.cloudLogging.log('backend-app');
    }

    this.logger.log(
      `StructuredLogger initialized with level: ${this.logLevel}, structured: ${this.enableStructuredLogging}`,
    );
  }

  /**
   * Generate a new correlation ID
   */
  generateCorrelationId(): string {
    return uuidv4();
  }

  /**
   * Log a message with context
   */
  log(message: string, context: LogContext): void {
    if (this.shouldLog('log')) {
      this.writeLog('info', message, context);
    }
  }

  /**
   * Log a debug message
   */
  debug(message: string, context: LogContext): void {
    if (this.shouldLog('debug')) {
      this.writeLog('debug', message, context);
    }
  }

  /**
   * Log a warning
   */
  warn(message: string, context: LogContext): void {
    if (this.shouldLog('warn')) {
      this.writeLog('warn', message, context);
    }
  }

  /**
   * Log an error with full context
   * Accepts Error or unknown (normalizes to Error internally)
   */
  error(message: string, error: unknown, context: LogContext): void {
    // Normalize error to Error instance
    const normalizedError =
      error instanceof Error
        ? error
        : new Error(typeof error === 'string' ? error : String(error));

    const errorContext: LogContext = {
      ...context,
      error: {
        message: normalizedError.message,
        stack: normalizedError.stack,
        name: normalizedError.name,
      },
    };

    this.writeLog('error', message, errorContext, {
      message: normalizedError.message,
      stack: normalizedError.stack,
      code: (normalizedError as { code?: string }).code,
    });
  }

  /**
   * Log an external API call
   */
  logApiCall(
    service: string,
    operation: string,
    latency: number,
    context: LogContext,
    status?: 'success' | 'failure',
  ): void {
    const apiContext: LogContext = {
      ...context,
      service,
      operation,
      latency,
      status: status || 'success',
    };

    this.log(
      `API call: ${service}.${operation} (${latency}ms) - ${status || 'success'}`,
      apiContext,
    );
  }

  /**
   * Log LLM fallback event
   */
  logFallback(
    from: string,
    to: string,
    reason: string,
    context: LogContext,
  ): void {
    const fallbackContext: LogContext = {
      ...context,
      fallbackFrom: from,
      fallbackTo: to,
      fallbackReason: reason,
    };

    this.warn(`LLM fallback: ${from} → ${to} (${reason})`, fallbackContext);
  }

  /**
   * Write log entry to Cloud Logging and console
   */
  private writeLog(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    context: LogContext,
    error?: { message: string; stack?: string; code?: string },
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      ...(error && { error }),
    };

    // Write to console (NestJS logger)
    const logMessage = this.enableStructuredLogging
      ? JSON.stringify(entry)
      : message;

    switch (level) {
      case 'debug':
        this.logger.debug(logMessage);
        break;
      case 'info':
        this.logger.log(logMessage);
        break;
      case 'warn':
        this.logger.warn(logMessage);
        break;
      case 'error':
        this.logger.error(logMessage);
        break;
    }

    // Write to Cloud Logging if enabled
    if (this.enableStructuredLogging) {
      this.writeToCloudLogging(entry);
    }
  }

  /**
   * Write log entry to Cloud Logging
   */
  private writeToCloudLogging(entry: LogEntry): void {
    // Guard: only write if Cloud Logging was initialized
    if (!this.cloudLogger) {
      return;
    }

    const metadata: CloudLogEntry = {
      severity: this.mapSeverity(entry.level),
      labels: {
        correlationId: entry.context.correlationId,
        ...(entry.context.stage && { stage: entry.context.stage }),
        ...(entry.context.userId && { userId: entry.context.userId }),
        ...(entry.context.businessId && {
          businessId: entry.context.businessId,
        }),
        ...(entry.context.jobId && { jobId: entry.context.jobId }),
      },
    };

    const cloudEntry = this.cloudLogger.entry(metadata, entry);

    // Fire and forget - don't await to avoid blocking
    void this.cloudLogger.write(cloudEntry).catch((error: unknown) => {
      // Fallback to console if Cloud Logging fails
      this.logger.error(
        `Failed to write to Cloud Logging: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }

  /**
   * Map log level to Cloud Logging severity
   */
  private mapSeverity(level: 'debug' | 'info' | 'warn' | 'error'): string {
    const severityMap = {
      debug: 'DEBUG',
      info: 'INFO',
      warn: 'WARNING',
      error: 'ERROR',
    };
    return severityMap[level];
  }

  /**
   * Check if log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'log', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const requestedLevelIndex = levels.indexOf(level);
    return requestedLevelIndex >= currentLevelIndex;
  }
}
