import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { lastValueFrom } from 'rxjs';
import { PerformanceInterceptor } from './performance.interceptor';
import { StructuredLoggerService } from '../structured-logger.service';
import { PerformanceMonitorService } from '../performance-monitor.service';
import { CorrelationContextService } from '../correlation-context.service';

/* eslint-disable @typescript-eslint/unbound-method */

describe('PerformanceInterceptor', () => {
  let interceptor: PerformanceInterceptor;
  let structuredLogger: StructuredLoggerService;
  let performanceMonitor: PerformanceMonitorService;
  let dateNowSpy: jest.SpyInstance;

  const mockStructuredLogger = {
    generateCorrelationId: jest.fn(),
  };

  const mockPerformanceMonitor = {
    trackLatency: jest.fn(),
  };

  const mockCorrelationContext = {
    setContext: jest.fn(),
    getCorrelationId: jest.fn(() => 'test-correlation-id'),
    run: jest.fn((context, callback: () => unknown) => {
      // Execute the callback immediately in the mock and return its result
      return callback();
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Mock Date.now() for deterministic latency
    dateNowSpy = jest.spyOn(Date, 'now');
    dateNowSpy.mockReturnValueOnce(1000); // startTime
    dateNowSpy.mockReturnValue(1100); // endTime (100ms later)

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
        {
          provide: CorrelationContextService,
          useValue: mockCorrelationContext,
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

    mockStructuredLogger.generateCorrelationId.mockReturnValue(
      'test-correlation-id',
    );
  });

  afterEach(() => {
    // Restore all spies to prevent cross-test bleed
    jest.restoreAllMocks();
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
    it('should generate correlation ID', async () => {
      const context = createMockExecutionContext();
      const next = createMockCallHandler();

      await lastValueFrom(interceptor.intercept(context, next));

      expect(structuredLogger.generateCorrelationId).toHaveBeenCalled();
    });

    it('should track latency on success', async () => {
      const context = createMockExecutionContext();
      const next = createMockCallHandler();

      await lastValueFrom(interceptor.intercept(context, next));

      expect(performanceMonitor.trackLatency).toHaveBeenCalledWith(
        'test-controller',
        'testHandler',
        100, // 1100 - 1000
        {
          correlationId: 'test-correlation-id',
        },
        'success',
      );
    });

    it('should track latency on failure', async () => {
      const context = createMockExecutionContext();
      const error = new Error('Test error');
      const next = {
        handle: () => throwError(() => error),
      } as CallHandler;

      await expect(
        lastValueFrom(interceptor.intercept(context, next)),
      ).rejects.toThrow(error);

      expect(performanceMonitor.trackLatency).toHaveBeenCalledWith(
        'test-controller',
        'testHandler',
        100,
        {
          correlationId: 'test-correlation-id',
        },
        'failure',
      );
    });

    it('should extract businessId from body', async () => {
      const context = createMockExecutionContext({
        businessId: 'business-123',
      });
      const next = createMockCallHandler();

      await lastValueFrom(interceptor.intercept(context, next));

      expect(performanceMonitor.trackLatency).toHaveBeenCalledWith(
        'test-controller',
        'testHandler',
        100,
        {
          correlationId: 'test-correlation-id',
          businessId: 'business-123',
        },
        'success',
      );
    });

    it('should extract businessId from query', async () => {
      const context = createMockExecutionContext(
        {},
        { businessId: 'business-456' },
      );
      const next = createMockCallHandler();

      await lastValueFrom(interceptor.intercept(context, next));

      expect(performanceMonitor.trackLatency).toHaveBeenCalledWith(
        'test-controller',
        'testHandler',
        100,
        {
          correlationId: 'test-correlation-id',
          businessId: 'business-456',
        },
        'success',
      );
    });

    it('should extract platform from body', async () => {
      const context = createMockExecutionContext({
        businessId: 'business-123',
        prompt_inputs: {
          platform: 'tiktok',
        },
      });
      const next = createMockCallHandler();

      await lastValueFrom(interceptor.intercept(context, next));

      expect(performanceMonitor.trackLatency).toHaveBeenCalledWith(
        'test-controller',
        'testHandler',
        100,
        {
          correlationId: 'test-correlation-id',
          businessId: 'business-123',
          platform: 'tiktok',
        },
        'success',
      );
    });

    it('should handle missing metadata gracefully', async () => {
      const context = createMockExecutionContext();
      const next = createMockCallHandler();

      await lastValueFrom(interceptor.intercept(context, next));

      expect(performanceMonitor.trackLatency).toHaveBeenCalledWith(
        'test-controller',
        'testHandler',
        100,
        {
          correlationId: 'test-correlation-id',
        },
        'success',
      );
    });

    it('should re-throw errors after tracking', async () => {
      const context = createMockExecutionContext();
      const error = new Error('Test error');
      const next = {
        handle: () => throwError(() => error),
      } as CallHandler;

      await expect(
        lastValueFrom(interceptor.intercept(context, next)),
      ).rejects.toThrow(error);
    });

    it('should normalize controller name', async () => {
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

      await lastValueFrom(interceptor.intercept(context, next));

      expect(performanceMonitor.trackLatency).toHaveBeenCalledWith(
        'ads-controller',
        'createJob',
        100,
        expect.any(Object),
        'success',
      );
    });
  });
});
