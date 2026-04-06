import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

/**
 * Context data stored in AsyncLocalStorage
 */
interface CorrelationContext {
  correlationId: string;
  jobId?: string;
  businessId?: string;
  userId?: string;
  stage?: string;
}

/**
 * CorrelationContextService - Manages correlation ID using AsyncLocalStorage
 *
 * Features:
 * - Automatic correlation ID propagation across async boundaries
 * - No need to pass correlationId through function parameters
 * - Thread-safe context isolation
 * - Supports nested contexts
 *
 * Usage:
 * // Set context (usually in interceptor or job initialization)
 * correlationContext.run({ correlationId: 'abc-123' }, () => {
 *   // All code here has access to correlation ID
 *   const id = correlationContext.getCorrelationId(); // 'abc-123'
 * });
 *
 * // Or use setContext for existing async context
 * correlationContext.setContext({ correlationId: 'abc-123' });
 * const id = correlationContext.getCorrelationId(); // 'abc-123'
 */
@Injectable()
export class CorrelationContextService {
  private readonly asyncLocalStorage =
    new AsyncLocalStorage<CorrelationContext>();

  /**
   * Run a function with a new correlation context
   * Creates a new async context that isolates the correlation ID
   */
  run<T>(context: CorrelationContext, fn: () => T): T {
    return this.asyncLocalStorage.run(context, fn);
  }

  /**
   * Run an async function with a new correlation context
   */
  async runAsync<T>(
    context: CorrelationContext,
    fn: () => Promise<T>,
  ): Promise<T> {
    return this.asyncLocalStorage.run(context, fn);
  }

  /**
   * Set context in the current async scope
   * Use this when you're already in an async context and want to update it
   */
  setContext(context: Partial<CorrelationContext>): void {
    const current = this.asyncLocalStorage.getStore();
    if (current) {
      // Merge with existing context
      Object.assign(current, context);
    }
  }

  /**
   * Get the current correlation ID
   * Returns 'unknown' if no context is set
   */
  getCorrelationId(): string {
    const store = this.asyncLocalStorage.getStore();
    return store?.correlationId || 'unknown';
  }

  /**
   * Get the current job ID
   */
  getJobId(): string | undefined {
    const store = this.asyncLocalStorage.getStore();
    return store?.jobId;
  }

  /**
   * Get the current business ID
   */
  getBusinessId(): string | undefined {
    const store = this.asyncLocalStorage.getStore();
    return store?.businessId;
  }

  /**
   * Get the current user ID
   */
  getUserId(): string | undefined {
    const store = this.asyncLocalStorage.getStore();
    return store?.userId;
  }

  /**
   * Get the current stage
   */
  getStage(): string | undefined {
    const store = this.asyncLocalStorage.getStore();
    return store?.stage;
  }

  /**
   * Get the full context
   */
  getContext(): CorrelationContext | undefined {
    return this.asyncLocalStorage.getStore();
  }

  /**
   * Check if context is set
   */
  hasContext(): boolean {
    return this.asyncLocalStorage.getStore() !== undefined;
  }
}
