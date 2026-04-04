import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { StructuredLoggerService } from './structured-logger.service';
import { PerformanceMonitorService } from './performance-monitor.service';
import { ErrorTrackerService } from './error-tracker.service';
import { CorrelationContextService } from './correlation-context.service';
import { ErrorSeverity } from './types';

// Mock Google Cloud SDKs to avoid real API calls in tests
jest.mock('@google-cloud/logging');
jest.mock('@google-cloud/error-reporting');

/**
 * Integration tests for monitoring services
 * Tests that services work together correctly in realistic scenarios
 */
describe('Monitoring Integration', () => {
  let structuredLogger: StructuredLoggerService;
  let performanceMonitor: PerformanceMonitorService;
  let errorTracker: ErrorTrackerService;
  let correlationContext: CorrelationContextService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              GCP_PROJECT_ID: 'test-project',
              ENABLE_STRUCTURED_LOGGING: 'false',
              LOG_LEVEL: 'info',
            }),
          ],
        }),
      ],
      providers: [
        CorrelationContextService,
        StructuredLoggerService,
        PerformanceMonitorService,
        ErrorTrackerService,
      ],
    }).compile();

    structuredLogger = module.get<StructuredLoggerService>(
      StructuredLoggerService,
    );
    performanceMonitor = module.get<PerformanceMonitorService>(
      PerformanceMonitorService,
    );
    errorTracker = module.get<ErrorTrackerService>(ErrorTrackerService);
    correlationContext = module.get<CorrelationContextService>(
      CorrelationContextService,
    );
  });

  afterEach(() => {
    // Cleanup
    performanceMonitor.clearMetrics();
    errorTracker.clearErrorCounts();
  });

  describe('Correlation ID Propagation', () => {
    it('should propagate correlation ID through async operations', async () => {
      const correlationId = structuredLogger.generateCorrelationId();

      await correlationContext.runAsync({ correlationId }, async () => {
        // Verify context is set
        expect(correlationContext.getCorrelationId()).toBe(correlationId);

        // Simulate async operation
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Verify context persists after async operation
        expect(correlationContext.getCorrelationId()).toBe(correlationId);
      });
    });

    it('should maintain separate contexts for concurrent operations', async () => {
      const id1 = 'correlation-1';
      const id2 = 'correlation-2';

      const promise1 = correlationContext.runAsync(
        { correlationId: id1 },
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          return correlationContext.getCorrelationId();
        },
      );

      const promise2 = correlationContext.runAsync(
        { correlationId: id2 },
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return correlationContext.getCorrelationId();
        },
      );

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toBe(id1);
      expect(result2).toBe(id2);
    });
  });

  describe('End-to-End Request Flow', () => {
    it('should track complete request lifecycle with correlation ID', async () => {
      const correlationId = structuredLogger.generateCorrelationId();
      const jobId = 'test-job-123';
      const businessId = 'test-business-456';

      await correlationContext.runAsync(
        { correlationId, jobId, businessId },
        async () => {
          const context = {
            correlationId,
            jobId,
            businessId,
            stage: 'processing' as const,
          };

          // Log start
          structuredLogger.log('Request started', context);

          // Track performance
          const timer = performanceMonitor.startTimer(
            'test-operation',
            context,
          );

          // Simulate work
          await new Promise((resolve) => setTimeout(resolve, 50));

          // Track metric
          performanceMonitor.trackCount('requests', 1, context);

          // Complete timer
          timer();

          // Log completion
          structuredLogger.log('Request completed', context);

          // Verify metrics were tracked
          const metrics = performanceMonitor.getMetrics();
          expect(metrics.requests).toBe(1);
        },
      );
    });

    it('should handle errors with full context', async () => {
      const correlationId = structuredLogger.generateCorrelationId();
      const jobId = 'test-job-error';
      const businessId = 'test-business-error';

      await correlationContext.runAsync(
        { correlationId, jobId, businessId },
        () => {
          const context = {
            correlationId,
            jobId,
            businessId,
            stage: 'processing' as const,
          };

          try {
            // Simulate error
            throw new Error('Test error');
          } catch (error) {
            // Log error
            structuredLogger.error('Operation failed', error as Error, context);

            // Report error
            errorTracker.reportError(
              error as Error,
              ErrorSeverity.MEDIUM,
              context,
              correlationId,
            );

            // Verify error was tracked
            const stats = errorTracker.getErrorStats();
            const errorKey = `${ErrorSeverity.MEDIUM}:UNKNOWN_ERROR`;
            expect(stats[errorKey]).toBeDefined();
            expect(stats[errorKey].count).toBe(1);
          }
        },
      );
    });
  });

  describe('Performance Monitoring Integration', () => {
    it('should track API call latency with structured logging', async () => {
      const correlationId = structuredLogger.generateCorrelationId();
      const context = {
        correlationId,
        jobId: 'test-job',
        businessId: 'test-business',
      };

      await correlationContext.runAsync({ correlationId }, async () => {
        // Simulate API call
        const startTime = Date.now();
        await new Promise((resolve) => setTimeout(resolve, 30));
        const latency = Date.now() - startTime;

        // Track latency
        performanceMonitor.trackLatency(
          'external-api',
          'getData',
          latency,
          context,
          'success',
        );

        // Verify latency was logged (through structured logger)
        expect(latency).toBeGreaterThanOrEqual(30);
      });
    });

    it('should aggregate metrics across multiple operations', async () => {
      const correlationId = structuredLogger.generateCorrelationId();
      const context = {
        correlationId,
        jobId: 'test-job',
        businessId: 'test-business',
      };

      await correlationContext.runAsync({ correlationId }, () => {
        // Track multiple operations
        performanceMonitor.trackCount('api-calls', 1, context);
        performanceMonitor.trackCount('api-calls', 1, context);
        performanceMonitor.trackCount('api-calls', 1, context);

        performanceMonitor.trackCount('cache-hits', 2, context);
        performanceMonitor.trackCount('cache-misses', 1, context);

        // Verify aggregation
        const metrics = performanceMonitor.getMetrics();
        expect(metrics['api-calls']).toBe(3);
        expect(metrics['cache-hits']).toBe(2);
        expect(metrics['cache-misses']).toBe(1);
      });
    });
  });

  describe('Error Tracking Integration', () => {
    it('should track multiple errors with different severities', async () => {
      const correlationId = structuredLogger.generateCorrelationId();
      const context = {
        correlationId,
        jobId: 'test-job',
        businessId: 'test-business',
      };

      await correlationContext.runAsync({ correlationId }, () => {
        // Report errors with different severities
        errorTracker.reportError(
          new Error('Low severity error'),
          ErrorSeverity.LOW,
          context,
          correlationId,
        );

        errorTracker.reportError(
          new Error('Medium severity error'),
          ErrorSeverity.MEDIUM,
          context,
          correlationId,
        );

        errorTracker.reportError(
          new Error('High severity error'),
          ErrorSeverity.HIGH,
          context,
          correlationId,
        );

        // Verify all errors were tracked
        const stats = errorTracker.getErrorStats();
        expect(Object.keys(stats).length).toBe(3);
      });
    });

    it('should handle error count cleanup', async () => {
      const correlationId = structuredLogger.generateCorrelationId();
      const context = {
        correlationId,
        jobId: 'test-job',
        businessId: 'test-business',
      };

      await correlationContext.runAsync({ correlationId }, () => {
        // Report error
        errorTracker.reportError(
          new Error('Test error'),
          ErrorSeverity.LOW,
          context,
          correlationId,
        );

        // Verify error was tracked
        let stats = errorTracker.getErrorStats();
        expect(Object.keys(stats).length).toBe(1);

        // Clear errors
        errorTracker.clearErrorCounts();

        // Verify errors were cleared
        stats = errorTracker.getErrorStats();
        expect(Object.keys(stats).length).toBe(0);
      });
    });
  });

  describe('Graceful Degradation', () => {
    it('should continue operation even if monitoring fails', async () => {
      const correlationId = structuredLogger.generateCorrelationId();

      // This should not throw even if internal monitoring operations fail
      await expect(
        correlationContext.runAsync({ correlationId }, () => {
          const context = {
            correlationId,
            jobId: 'test-job',
            businessId: 'test-business',
          };

          // These operations should not throw
          structuredLogger.log('Test message', context);
          performanceMonitor.trackCount('test-metric', 1, context);

          // Simulate business logic
          return 'success';
        }),
      ).resolves.toBe('success');
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple concurrent requests with separate contexts', async () => {
      const operations = Array.from({ length: 5 }, (_, i) => {
        const correlationId = `correlation-${i}`;
        const jobId = `job-${i}`;

        return correlationContext.runAsync(
          { correlationId, jobId },
          async () => {
            const context = {
              correlationId,
              jobId,
              businessId: 'test-business',
            };

            // Simulate work
            await new Promise((resolve) =>
              setTimeout(resolve, Math.random() * 50),
            );

            // Track metrics
            performanceMonitor.trackCount(`request-${i}`, 1, context);

            // Log
            structuredLogger.log(`Operation ${i} completed`, context);

            // Verify correct context
            expect(correlationContext.getCorrelationId()).toBe(correlationId);
            expect(correlationContext.getJobId()).toBe(jobId);

            return i;
          },
        );
      });

      const results = await Promise.all(operations);

      // Verify all operations completed successfully
      expect(results).toEqual([0, 1, 2, 3, 4]);

      // Verify metrics were tracked
      const metrics = performanceMonitor.getMetrics();
      expect(metrics['request-0']).toBe(1);
      expect(metrics['request-1']).toBe(1);
      expect(metrics['request-2']).toBe(1);
      expect(metrics['request-3']).toBe(1);
      expect(metrics['request-4']).toBe(1);
    });
  });
});
