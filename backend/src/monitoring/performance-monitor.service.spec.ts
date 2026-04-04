import { Test, TestingModule } from '@nestjs/testing';
import { PerformanceMonitorService } from './performance-monitor.service';
import { StructuredLoggerService } from './structured-logger.service';
import { LogContext } from './types';

describe('PerformanceMonitorService', () => {
  let service: PerformanceMonitorService;
  let loggerService: StructuredLoggerService;

  const mockLoggerService = {
    log: jest.fn(),
    logApiCall: jest.fn(),
    generateCorrelationId: jest.fn(() => 'test-correlation-id'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PerformanceMonitorService,
        {
          provide: StructuredLoggerService,
          useValue: mockLoggerService,
        },
      ],
    }).compile();

    service = module.get<PerformanceMonitorService>(PerformanceMonitorService);
    loggerService = module.get<StructuredLoggerService>(
      StructuredLoggerService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('trackLatency', () => {
    it('should track latency for an operation', () => {
      const context: LogContext = {
        correlationId: 'test-correlation-id',
        stage: 'brief-generation',
      };

      service.trackLatency('claude', 'generateText', 1500, context, 'success');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(loggerService.logApiCall).toHaveBeenCalledWith(
        'claude',
        'generateText',
        1500,
        context,
        'success',
      );
    });

    it('should track failed operation', () => {
      const context: LogContext = {
        correlationId: 'test-correlation-id',
      };

      service.trackLatency('veo', 'generateVideo', 3000, context, 'failure');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(loggerService.logApiCall).toHaveBeenCalledWith(
        'veo',
        'generateVideo',
        3000,
        context,
        'failure',
      );
    });
  });

  describe('trackCount', () => {
    it('should track count for a metric', () => {
      const context: LogContext = {
        correlationId: 'test-correlation-id',
      };

      service.trackCount('llm_fallback', 1, context);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(loggerService.log).toHaveBeenCalledWith(
        'Metric: llm_fallback = 1',
        expect.objectContaining({
          correlationId: 'test-correlation-id',
          metric: 'llm_fallback',
          value: 1,
        }),
      );
    });

    it('should track count with metadata', () => {
      const context: LogContext = {
        correlationId: 'test-correlation-id',
        userId: 'user-123',
      };

      service.trackCount('video_generated', 1, context, {
        duration: 30,
        platform: 'tiktok',
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(loggerService.log).toHaveBeenCalledWith(
        'Metric: video_generated = 1',
        expect.objectContaining({
          correlationId: 'test-correlation-id',
          userId: 'user-123',
          metric: 'video_generated',
          value: 1,
          duration: 30,
          platform: 'tiktok',
        }),
      );
    });
  });

  describe('startTimer', () => {
    it('should start and stop a timer', () => {
      const context: LogContext = {
        correlationId: 'test-correlation-id',
      };

      const stopTimer = service.startTimer('test-operation', context);

      // Simulate some work
      const start = Date.now();
      while (Date.now() - start < 10) {
        // Wait 10ms
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const result = stopTimer();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(loggerService.log).toHaveBeenCalledWith(
        expect.stringContaining('Operation: test-operation completed in'),
        expect.objectContaining({
          correlationId: 'test-correlation-id',
          operation: 'test-operation',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          duration: expect.any(Number),
        }),
      );
    });

    it('should track timer with metadata', () => {
      const context: LogContext = {
        correlationId: 'test-correlation-id',
        stage: 'video-generation',
      };

      const stopTimer = service.startTimer('veo-generation', context, {
        prompt: 'test prompt',
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const result = stopTimer();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(loggerService.log).toHaveBeenCalledWith(
        expect.stringContaining('Operation: veo-generation completed in'),
        expect.objectContaining({
          correlationId: 'test-correlation-id',
          stage: 'video-generation',
          operation: 'veo-generation',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          duration: expect.any(Number),
          prompt: 'test prompt',
        }),
      );
    });
  });

  describe('getMetrics', () => {
    it('should return empty metrics initially', () => {
      const metrics = service.getMetrics();
      expect(metrics).toEqual({});
    });

    it('should return tracked metrics', () => {
      const context: LogContext = {
        correlationId: 'test-correlation-id',
      };

      service.trackCount('test_metric', 5, context);
      service.trackCount('test_metric', 3, context);

      const metrics = service.getMetrics();
      expect(metrics['test_metric']).toBe(8);
    });

    it('should track multiple different metrics', () => {
      const context: LogContext = {
        correlationId: 'test-correlation-id',
      };

      service.trackCount('metric_a', 10, context);
      service.trackCount('metric_b', 20, context);
      service.trackCount('metric_a', 5, context);

      const metrics = service.getMetrics();
      expect(metrics['metric_a']).toBe(15);
      expect(metrics['metric_b']).toBe(20);
    });
  });

  describe('clearMetrics', () => {
    it('should clear all metrics', () => {
      const context: LogContext = {
        correlationId: 'test-correlation-id',
      };

      service.trackCount('test_metric', 10, context);
      expect(service.getMetrics()['test_metric']).toBe(10);

      service.clearMetrics();
      expect(service.getMetrics()).toEqual({});
    });
  });
});
