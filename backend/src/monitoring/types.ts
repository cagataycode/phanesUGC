/**
 * Context information for structured logging
 */
export interface LogContext {
  correlationId: string;
  stage?: string;
  userId?: string;
  businessId?: string;
  jobId?: string;
  [key: string]: unknown;
}

/**
 * Structured log entry
 */
export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context: LogContext;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

/**
 * Performance metric
 */
export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'count' | 'bytes';
  tags: Record<string, string>;
  timestamp: Date;
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  CRITICAL = 'critical', // System down
  HIGH = 'high', // Feature broken
  MEDIUM = 'medium', // Degraded performance
  LOW = 'low', // Minor issue
}

/**
 * Application error with context
 */
export interface AppError {
  code: string;
  message: string;
  severity: ErrorSeverity;
  context: Record<string, unknown>;
  timestamp: Date;
  correlationId: string;
}
