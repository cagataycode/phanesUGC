import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError, Observable } from 'rxjs';
import { PerformanceInterceptor } from './performance.interceptor';
import { StructuredLoggerService } from '../structured-logger.service';
import { PerformanceMonitorService } from '../performance-monitor.service';

/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

describe('PerformanceInterceptor', () => {
  let interceptor: PerformanceInterceptor;
  let structuredLogger: StructuredLoggerService;
  let performanceMonitor: PerformanceMonitorService;

  const mockStructuredLogger = {
    generateCorrelationId: jest.fn(),
  };

  const mockPerformanceMonitor = {
    trackLatency: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PerformanceInterceptor,
        {
          provide: StructuredLoggerService,
          useValue: mockStructuredLogger,
        },
        {
          provide: PerformanceMonitorService,
          useValue: mockPerformanceMonitor,
        },
      ],
    }).compile();

    interceptor = module.get<PerformanceInterceptor>(PerformanceInterceptor);
    structuredLogger = module.get<StructuredLoggerService>(
      StructuredLoggerService,
    );
    performanceMonitor = module.get<PerformanceMonitorService>(
      PerformanceMonitorService,
    );

    // Reset mocks
    jest.clearAllMocks();
    mockStructuredLogger.generateCorrelationId.mockReturnValue(
      'test-correlation-id',
    );
  });

  const createMockExecutionContext = (
    body: Record<string, unknown> = {},
    query: Record<string, unknown> = {},
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          body,
          query,
        }),
      }),
      getHandler: () => ({ name: 'testHandler' }),
      getClass: () => ({ name: 'TestController' }),
    } as ExecutionContext;
  };

  const createMockCallHandler = (
    result: unknown = { success: true },
  ): CallHandler => {
    return {
      handle: () => of(result),
    } as CallHandler;
  };

  describe('intercept', () => {
    it('should generate correlation ID', (done) => {
      const context = createMockExecutionContext();
      const next = createMockCallHandler();

      interceptor.intercept(context, next).subscribe(() => {
        expect(structuredLogger.generateCorrelationId).toHaveBeenCalled();
        done();
      });
    });

    it('should track latency on success', (done) => {
      const context = createMockExecutionContext();
      const next = createMockCallHandler();

      interceptor.intercept(context, next).subscribe(() => {
        expect(performanceMonitor.trackLatency).toHaveBeenCalledWith(
          'test-controller',
          'testHandler',
          expect.any(Number),
          {
            correlationId: 'test-correlation-id',
          },
          'success',
        );
        done();
      });
    });

    it('should track latency on failure', (done) => {
      const context = createMockExecutionContext();
      const error = new Error('Test error');
      const next = {
        handle: () => throwError(() => error),
      } as CallHandler;

      interceptor.intercept(context, next).subscribe({
        error: () => {
          expect(performanceMonitor.trackLatency).toHaveBeenCalledWith(
            'test-controller',
            'testHandler',
            expect.any(Number),
            {
              correlationId: 'test-correlation-id',
            },
            'failure',
          );
          done();
        },
      });
    });

    it('should extract businessId from body', (done) => {
      const context = createMockExecutionContext({
        businessId: 'business-123',
      });
      const next = createMockCallHandler();

      interceptor.intercept(context, next).subscribe(() => {
        expect(performanceMonitor.trackLatency).toHaveBeenCalledWith(
          'test-controller',
          'testHandler',
          expect.any(Number),
          {
            correlationId: 'test-correlation-id',
            businessId: 'business-123',
          },
          'success',
        );
        done();
      });
    });

    it('should extract businessId from query', (done) => {
      const context = createMockExecutionContext(
        {},
        { businessId: 'business-456' },
      );
      const next = createMockCallHandler();

      interceptor.intercept(context, next).subscribe(() => {
        expect(performanceMonitor.trackLatency).toHaveBeenCalledWith(
          'test-controller',
          'testHandler',
          expect.any(Number),
          {
            correlationId: 'test-correlation-id',
            businessId: 'business-456',
          },
          'success',
        );
        done();
      });
    });

    it('should extract platform from body', (done) => {
      const context = createMockExecutionContext({
        businessId: 'business-123',
        prompt_inputs: {
          platform: 'tiktok',
        },
      });
      const next = createMockCallHandler();

      interceptor.intercept(context, next).subscribe(() => {
        expect(performanceMonitor.trackLatency).toHaveBeenCalledWith(
          'test-controller',
          'testHandler',
          expect.any(Number),
          {
            correlationId: 'test-correlation-id',
            businessId: 'business-123',
            platform: 'tiktok',
          },
          'success',
        );
        done();
      });
    });

    it('should handle missing metadata gracefully', (done) => {
      const context = createMockExecutionContext();
      const next = createMockCallHandler();

      interceptor.intercept(context, next).subscribe(() => {
        expect(performanceMonitor.trackLatency).toHaveBeenCalledWith(
          'test-controller',
          'testHandler',
          expect.any(Number),
          {
            correlationId: 'test-correlation-id',
          },
          'success',
        );
        done();
      });
    });

    it('should measure actual latency', (done) => {
      const context = createMockExecutionContext();

      // Create a proper Observable that delays
      const delayedObservable = new Observable((subscriber) => {
        setTimeout(() => {
          subscriber.next({ success: true });
          subscriber.complete();
        }, 10);
      });

      const next = {
        handle: () => delayedObservable,
      } as CallHandler;

      interceptor.intercept(context, next).subscribe(() => {
        const latency = (performanceMonitor.trackLatency as jest.Mock).mock
          .calls[0][2];
        expect(latency).toBeGreaterThanOrEqual(10);
        done();
      });
    });

    it('should re-throw errors after tracking', (done) => {
      const context = createMockExecutionContext();
      const error = new Error('Test error');
      const next = {
        handle: () => throwError(() => error),
      } as CallHandler;

      interceptor.intercept(context, next).subscribe({
        error: (err) => {
          expect(err).toBe(error);
          done();
        },
      });
    });

    it('should normalize controller name', (done) => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            body: {},
            query: {},
          }),
        }),
        getHandler: () => ({ name: 'createJob' }),
        getClass: () => ({ name: 'AdsController' }),
      } as ExecutionContext;
      const next = createMockCallHandler();

      interceptor.intercept(context, next).subscribe(() => {
        expect(performanceMonitor.trackLatency).toHaveBeenCalledWith(
          'ads-controller',
          'createJob',
          expect.any(Number),
          expect.any(Object),
          'success',
        );
        done();
      });
    });
  });
});
