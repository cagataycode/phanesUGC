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
import { LogContext } from '../types';

/**
 * PerformanceInterceptor - Automatically tracks performance for all requests
 *
 * Features:
 * - Generates correlation ID for each request
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
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startTime = Date.now();
    const correlationId = this.structuredLogger.generateCorrelationId();

    // Extract request metadata
    const request = context.switchToHttp().getRequest<{
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

    // Extract businessId from body or query
    const businessId =
      request.body?.businessId ||
      request.body?.business_id ||
      request.query?.businessId;

    // Extract platform from body if available
    const platform = request.body?.prompt_inputs?.platform;

    // Build context
    const baseContext: LogContext = {
      correlationId,
      ...(businessId && { businessId: String(businessId) }),
    };

    return next.handle().pipe(
      tap(() => {
        // Success case
        const latency = Date.now() - startTime;
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
      }),
      catchError((error: Error) => {
        // Failure case
        const latency = Date.now() - startTime;
        this.performanceMonitor.trackLatency(
          `${controllerName}-controller`,
          handlerName,
          latency,
          baseContext,
          'failure',
        );
        return throwError(() => error);
      }),
    );
  }
}
