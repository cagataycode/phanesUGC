import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StructuredLoggerService } from './structured-logger.service';
import { LogContext } from './types';

// Mock @google-cloud/logging
jest.mock('@google-cloud/logging');

describe('StructuredLoggerService', () => {
  let service: StructuredLoggerService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        GCP_PROJECT_ID: 'test-project',
        LOG_LEVEL: 'debug',
        ENABLE_STRUCTURED_LOGGING: 'true',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StructuredLoggerService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<StructuredLoggerService>(StructuredLoggerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateCorrelationId', () => {
    it('should generate a valid UUID v4', () => {
      const correlationId = service.generateCorrelationId();
      expect(correlationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('should generate unique IDs', () => {
      const id1 = service.generateCorrelationId();
      const id2 = service.generateCorrelationId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('log', () => {
    it('should log a message with context', () => {
      const context: LogContext = {
        correlationId: 'test-correlation-id',
        stage: 'test-stage',
        userId: 'user-123',
      };

      // Should not throw
      expect(() => service.log('Test message', context)).not.toThrow();
    });
  });

  describe('error', () => {
    it('should log an error with full context', () => {
      const context: LogContext = {
        correlationId: 'test-correlation-id',
        jobId: 'job-123',
      };
      const error = new Error('Test error');

      // Should not throw
      expect(() =>
        service.error('Error occurred', error, context),
      ).not.toThrow();
    });
  });

  describe('logApiCall', () => {
    it('should log API call with latency', () => {
      const context: LogContext = {
        correlationId: 'test-correlation-id',
      };

      expect(() =>
        service.logApiCall('veo', 'generateVideo', 1500, context, 'success'),
      ).not.toThrow();
    });

    it('should log failed API call', () => {
      const context: LogContext = {
        correlationId: 'test-correlation-id',
      };

      expect(() =>
        service.logApiCall('claude', 'generateText', 500, context, 'failure'),
      ).not.toThrow();
    });
  });

  describe('logFallback', () => {
    it('should log LLM fallback event', () => {
      const context: LogContext = {
        correlationId: 'test-correlation-id',
        stage: 'brief-generation',
      };

      expect(() =>
        service.logFallback('claude', 'gemini', 'API timeout', context),
      ).not.toThrow();
    });
  });

  describe('debug', () => {
    it('should log debug message when log level is debug', () => {
      const context: LogContext = {
        correlationId: 'test-correlation-id',
      };

      expect(() => service.debug('Debug message', context)).not.toThrow();
    });
  });

  describe('warn', () => {
    it('should log warning message', () => {
      const context: LogContext = {
        correlationId: 'test-correlation-id',
      };

      expect(() => service.warn('Warning message', context)).not.toThrow();
    });
  });
});
