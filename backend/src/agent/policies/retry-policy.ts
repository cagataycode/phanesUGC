/**
 * RetryPolicy - Implements retry logic with exponential backoff
 *
 * Provides automatic retry for transient failures with configurable
 * retry count, delay, and backoff multiplier.
 */

import { Logger } from '@nestjs/common';

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[]; // Error message patterns
  globalRetryBudget?: number; // Max retries across all stages in a job
}

export interface RetryContext {
  jobId: string;
  stage: string;
  getCurrentRetryCount?: () => Promise<number>; // Function to get current job-wide retry count
  onRetryAttempt?: (attemptNumber: number, error: unknown) => Promise<void>; // Callback before each retry
}

export class RetryPolicy {
  private readonly logger = new Logger(RetryPolicy.name);

  constructor(private readonly config: RetryConfig) {}

  /**
   * Execute function with retry logic
   * Returns result on success, throws on final failure
   */
  async execute<T>(fn: () => Promise<T>, context: RetryContext): Promise<T> {
    let lastError: unknown;
    let attempt = 0;

    while (attempt <= this.config.maxRetries) {
      try {
        if (attempt > 0) {
          // Check global retry budget before retrying
          if (
            this.config.globalRetryBudget !== undefined &&
            context.getCurrentRetryCount
          ) {
            const currentRetryCount = await context.getCurrentRetryCount();
            if (currentRetryCount >= this.config.globalRetryBudget) {
              this.logger.error(
                `Global retry budget (${this.config.globalRetryBudget}) exceeded for job ${context.jobId}. Current retries: ${currentRetryCount}`,
              );
              throw new Error(
                `Global retry budget exceeded (${currentRetryCount}/${this.config.globalRetryBudget})`,
              );
            }
          }

          const delay = this.calculateDelay(attempt);
          this.logger.log(
            `Retry attempt ${attempt}/${this.config.maxRetries} for job ${context.jobId} stage ${context.stage} after ${delay}ms`,
          );
          await this.sleep(delay);

          // Increment retry count before retrying (for state persistence)
          if (context.onRetryAttempt) {
            await context.onRetryAttempt(attempt, lastError);
          }
        }

        return await fn();
      } catch (error) {
        lastError = error;

        if (!this.isRetryable(error)) {
          this.logger.warn(
            `Non-retryable error for job ${context.jobId} stage ${context.stage}: ${this.getErrorMessage(error)}`,
          );
          throw error;
        }

        if (attempt >= this.config.maxRetries) {
          this.logger.error(
            `Max retries (${this.config.maxRetries}) exceeded for job ${context.jobId} stage ${context.stage}`,
          );
          throw error;
        }

        this.logger.warn(
          `Retryable error for job ${context.jobId} stage ${context.stage}: ${this.getErrorMessage(error)}`,
        );
        attempt++;
      }
    }

    // Should never reach here, but TypeScript needs it
    throw lastError;
  }

  /**
   * Check if error is retryable based on error message patterns
   */
  isRetryable(error: unknown): boolean {
    const message = this.getErrorMessage(error);

    // Check against configured retryable error patterns
    for (const pattern of this.config.retryableErrors) {
      if (message.toLowerCase().includes(pattern.toLowerCase())) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate delay for retry attempt with exponential backoff
   */
  calculateDelay(attemptNumber: number): number {
    return (
      this.config.initialDelayMs *
      Math.pow(this.config.backoffMultiplier, attemptNumber - 1)
    );
  }

  /**
   * Extract error message from unknown error
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
