import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { StructuredLoggerService } from './structured-logger.service';
import { PerformanceMonitorService } from './performance-monitor.service';
import { ErrorTrackerService } from './error-tracker.service';
import { CorrelationContextService } from './correlation-context.service';
import { ErrorSeverity } from './types';

/**
 * Performance benchmarks for monitoring services
 * Measures overhead and performance characteristics
 */
describe('Monitoring Performance Benchmarks', () => {
  let structuredLogger: StructuredLoggerService;
  let performanceMonitor: PerformanceMonitorService;
  let errorTracker: ErrorTrackerService;
  let correlationContext: CorrelationContextService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env',
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
    performanceMonitor.clearMetrics();
    errorTracker.clearErrorCounts();
  });

  describe('Correlation ID Generation', () => {
    it('should generate correlation IDs quickly', () => {
      const iterations = 10000;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        structuredLogger.generateCorrelationId();
      }

      const duration = Date.now() - startTime;
      const avgTime = duration / iterations;

      console.log(
        `Generated ${iterations} correlation IDs in ${duration}ms (avg: ${avgTime.toFixed(4)}ms)`,
      );

      // Should be very fast (< 0.1ms per ID)
      expect(avgTime).toBeLessThan(0.1);
    });
  });

  describe('Structured Logging Performance', () => {
    it('should log messages with minimal overhead', () => {
      const iterations = 1000;
      const correlationId = structuredLogger.generateCorrelationId();
      const context = {
        correlationId,
        jobId: 'benchmark-job',
        businessId: 'benchmark-business',
      };

      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        structuredLogger.log(`Test message ${i}`, context);
      }

      const duration = Date.now() - startTime;
      const avgTime = duration / iterations;

      console.log(
        `Logged ${iterations} messages in ${duration}ms (avg: ${avgTime.toFixed(4)}ms)`,
      );

      // Should be fast (< 1ms per log)
      expect(avgTime).toBeLessThan(1);
    });

    it('should handle debug logging efficiently', () => {
      const iterations = 1000;
      const correlationId = structuredLogger.generateCorrelationId();
      const context = {
        correlationId,
        jobId: 'benchmark-job',
        businessId: 'benchmark-business',
      };

      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        structuredLogger.debug(`Debug message ${i}`, context);
      }

      const duration = Date.now() - startTime;
      const avgTime = duration / iterations;

      console.log(
        `Logged ${iterations} debug messages in ${duration}ms (avg: ${avgTime.toFixed(4)}ms)`,
      );

      expect(avgTime).toBeLessThan(1);
    });
  });

  describe('Performance Monitoring Overhead', () => {
    it('should track metrics with minimal overhead', () => {
      const iterations = 10000;
      const correlationId = structuredLogger.generateCorrelationId();
      const context = {
        correlationId,
        jobId: 'benchmark-job',
        businessId: 'benchmark-business',
      };

      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        performanceMonitor.trackCount('test-metric', 1, context);
      }

      const duration = Date.now() - startTime;
      const avgTime = duration / iterations;

      console.log(
        `Tracked ${iterations} metrics in ${duration}ms (avg: ${avgTime.toFixed(4)}ms)`,
      );

      // Should be very fast (< 0.1ms per metric)
      expect(avgTime).toBeLessThan(0.1);
    });

    it('should track latency efficiently', () => {
      const iterations = 1000;
      const correlationId = structuredLogger.generateCorrelationId();
      const context = {
        correlationId,
        jobId: 'benchmark-job',
        businessId: 'benchmark-business',
      };

      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        performanceMonitor.trackLatency(
          'test-service',
          'test-operation',
          Math.random() * 100,
          context,
          'success',
        );
      }

      const duration = Date.now() - startTime;
      const avgTime = duration / iterations;

      console.log(
        `Tracked ${iterations} latencies in ${duration}ms (avg: ${avgTime.toFixed(4)}ms)`,
      );

      expect(avgTime).toBeLessThan(1);
    });

    it('should handle timer operations efficiently', () => {
      const iterations = 1000;
      const correlationId = structuredLogger.generateCorrelationId();
      const context = {
        correlationId,
        jobId: 'benchmark-job',
        businessId: 'benchmark-business',
      };

      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        const stopTimer = performanceMonitor.startTimer(
          'test-operation',
          context,
        );
        stopTimer();
      }

      const duration = Date.now() - startTime;
      const avgTime = duration / iterations;

      console.log(
        `Executed ${iterations} timer operations in ${duration}ms (avg: ${avgTime.toFixed(4)}ms)`,
      );

      expect(avgTime).toBeLessThan(1);
    });
  });

  describe('Error Tracking Performance', () => {
    it('should report errors efficiently', () => {
      const iterations = 100;
      const correlationId = structuredLogger.generateCorrelationId();
      const context = {
        correlationId,
        jobId: 'benchmark-job',
        businessId: 'benchmark-business',
      };

      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        errorTracker.reportError(
          new Error(`Test error ${i}`),
          ErrorSeverity.LOW,
          context,
          correlationId,
        );
      }

      const duration = Date.now() - startTime;
      const avgTime = duration / iterations;

      console.log(
        `Reported ${iterations} errors in ${duration}ms (avg: ${avgTime.toFixed(4)}ms)`,
      );

      // Error reporting can be slower due to Cloud Error Reporting
      expect(avgTime).toBeLessThan(10);
    });
  });

  describe('AsyncLocalStorage Performance', () => {
    it('should have minimal overhead for context propagation', async () => {
      const iterations = 1000;

      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        await correlationContext.runAsync(
          { correlationId: `test-${i}` },
          () => {
            const id = correlationContext.getCorrelationId();
            expect(id).toBe(`test-${i}`);
          },
        );
      }

      const duration = Date.now() - startTime;
      const avgTime = duration / iterations;

      console.log(
        `Executed ${iterations} async context operations in ${duration}ms (avg: ${avgTime.toFixed(4)}ms)`,
      );

      // AsyncLocalStorage should be fast
      expect(avgTime).toBeLessThan(1);
    });

    it('should handle nested contexts efficiently', async () => {
      const iterations = 100;

      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        await correlationContext.runAsync(
          { correlationId: `outer-${i}` },
          async () => {
            await correlationContext.runAsync(
              { correlationId: `inner-${i}` },
              () => {
                const id = correlationContext.getCorrelationId();
                expect(id).toBe(`inner-${i}`);
              },
            );
          },
        );
      }

      const duration = Date.now() - startTime;
      const avgTime = duration / iterations;

      console.log(
        `Executed ${iterations} nested context operations in ${duration}ms (avg: ${avgTime.toFixed(4)}ms)`,
      );

      expect(avgTime).toBeLessThan(2);
    });
  });

  describe('End-to-End Monitoring Overhead', () => {
    it('should measure total monitoring overhead for a typical request', async () => {
      const iterations = 100;
      const correlationId = structuredLogger.generateCorrelationId();

      // Measure baseline (no monitoring)
      const baselineStart = Date.now();
      for (let i = 0; i < iterations; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
      const baselineDuration = Date.now() - baselineStart;

      // Measure with monitoring
      const monitoredStart = Date.now();
      for (let i = 0; i < iterations; i++) {
        await correlationContext.runAsync(
          { correlationId: `${correlationId}-${i}` },
          async () => {
            const context = {
              correlationId: correlationContext.getCorrelationId(),
              jobId: 'benchmark-job',
              businessId: 'benchmark-business',
            };

            structuredLogger.log('Request started', context);

            const timer = performanceMonitor.startTimer('request', context);

            await new Promise((resolve) => setTimeout(resolve, 1));

            performanceMonitor.trackCount('requests', 1, context);

            timer();

            structuredLogger.log('Request completed', context);
          },
        );
      }
      const monitoredDuration = Date.now() - monitoredStart;

      const overhead = monitoredDuration - baselineDuration;
      const overheadPercent = (overhead / baselineDuration) * 100;
      const avgOverhead = overhead / iterations;

      console.log(`\nMonitoring Overhead Analysis:`);
      console.log(`  Baseline: ${baselineDuration}ms`);
      console.log(`  With monitoring: ${monitoredDuration}ms`);
      console.log(
        `  Total overhead: ${overhead}ms (${overheadPercent.toFixed(2)}%)`,
      );
      console.log(`  Avg overhead per request: ${avgOverhead.toFixed(4)}ms`);

      // Monitoring overhead should be reasonable (< 50% of baseline)
      expect(overheadPercent).toBeLessThan(50);
    });
  });

  describe('Memory Usage', () => {
    it('should not accumulate memory with repeated operations', () => {
      const iterations = 10000;
      const correlationId = structuredLogger.generateCorrelationId();
      const context = {
        correlationId,
        jobId: 'benchmark-job',
        businessId: 'benchmark-business',
      };

      // Warm up
      for (let i = 0; i < 100; i++) {
        structuredLogger.log('Warmup', context);
        performanceMonitor.trackCount('warmup', 1, context);
      }

      const memBefore = process.memoryUsage().heapUsed;

      for (let i = 0; i < iterations; i++) {
        structuredLogger.log(`Message ${i}`, context);
        performanceMonitor.trackCount('test-metric', 1, context);
      }

      const memAfter = process.memoryUsage().heapUsed;
      const memIncrease = (memAfter - memBefore) / 1024 / 1024; // MB

      console.log(
        `Memory increase after ${iterations} operations: ${memIncrease.toFixed(2)}MB`,
      );

      // Memory increase should be reasonable (< 20MB for 10k operations with Cloud Logging)
      expect(memIncrease).toBeLessThan(20);
    });
  });
});
