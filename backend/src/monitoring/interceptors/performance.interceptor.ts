import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { StructuredLoggerService } from '../structured-logger.service';
import { PerformanceMonitorService } from '../performance-monitor.service';
import { CorrelationContextService } from '../correlation-context.service';
import { LogContext } from '../types';

/**
 * PerformanceInterceptor - Automatically tracks performance for all requests
 *
 * Features:
 * - Generates correlation ID for each request (or accepts from x-correlation-id header)
 * - Sets correlation context using AsyncLocalStorage
 * - Tracks request latency
 * - Logs success/failure status
 * - Extracts metadata from request (businessId, platform, etc.)
 *
 * Usage:
 * @UseInterceptors(PerformanceInterceptor)
 * class MyController { ... }
 */
@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  constructor(
    private readonly structuredLogger: StructuredLoggerService,
    private readonly performanceMonitor: PerformanceMonitorService,
    private readonly correlationContext: CorrelationContextService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startTime = Date.now();

    // Extract request metadata
    const request = context.switchToHttp().getRequest<{
      headers?: { 'x-correlation-id'?: string };
      body?: {
        businessId?: string;
        business_id?: string;
        prompt_inputs?: { platform?: string };
      };
      query?: { businessId?: string };
    }>();
    const handler = context.getHandler();
    const controller = context.getClass();

    const controllerName = controller.name
      .replace('Controller', '')
      .toLowerCase();
    const handlerName = handler.name;

    // Get or generate correlation ID
    const correlationId =
      request.headers?.['x-correlation-id'] ||
      this.structuredLogger.generateCorrelationId();

    // Extract businessId from body or query
    const businessId =
      request.body?.businessId ||
      request.body?.business_id ||
      request.query?.businessId;

    // Extract platform from body if available
    const platform = request.body?.prompt_inputs?.platform;

    // Set correlation context for this request
    return new Observable((subscriber) => {
      void this.correlationContext.runAsync(
        {
          correlationId,
          ...(businessId && { businessId: String(businessId) }),
        },
        async () => {
          return new Promise<void>((resolve, reject) => {
            next
              .handle()
              .pipe(
                tap(() => {
                  // Success case
                  const latency = Date.now() - startTime;
                  const baseContext: LogContext = {
                    correlationId,
                    ...(businessId && { businessId: String(businessId) }),
                  };

                  this.performanceMonitor.trackLatency(
                    `${controllerName}-controller`,
                    handlerName,
                    latency,
                    {
                      ...baseContext,
                      ...(platform && { platform }),
                    },
                    'success',
                  );
                  resolve();
                }),
                catchError((error: Error) => {
                  // Failure case
                  const latency = Date.now() - startTime;
                  const baseContext: LogContext = {
                    correlationId,
                    ...(businessId && { businessId: String(businessId) }),
                  };

                  this.performanceMonitor.trackLatency(
                    `${controllerName}-controller`,
                    handlerName,
                    latency,
                    baseContext,
                    'failure',
                  );
                  reject(error);
                  return throwError(() => error);
                }),
              )
              .subscribe({
                next: (value) => subscriber.next(value),
                error: (err) => subscriber.error(err),
                complete: () => subscriber.complete(),
              });
          });
        },
      );
    });
  }
}
