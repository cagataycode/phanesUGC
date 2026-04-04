import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ErrorTrackerService } from './error-tracker.service';
import { ErrorSeverity } from './types';

// Mock @google-cloud/error-reporting
jest.mock('@google-cloud/error-reporting');

describe('ErrorTrackerService', () => {
  let service: ErrorTrackerService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        GCP_PROJECT_ID: 'test-project',
        ALERT_EMAIL: 'test@example.com',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ErrorTrackerService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ErrorTrackerService>(ErrorTrackerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('reportError', () => {
    it('should report error with context', () => {
      const error = new Error('Test error');
      const context = {
        userId: 'user-123',
        jobId: 'job-456',
      };

      expect(() =>
        service.reportError(
          error,
          ErrorSeverity.MEDIUM,
          context,
          'test-correlation-id',
        ),
      ).not.toThrow();
    });

    it('should report critical error', () => {
      const error = new Error('Critical failure');
      const context = {
        stage: 'video-generation',
      };

      expect(() =>
        service.reportError(
          error,
          ErrorSeverity.CRITICAL,
          context,
          'test-correlation-id',
        ),
      ).not.toThrow();
    });

    it('should report error with code', () => {
      const error = new Error('API error') as Error & { code: string };
      error.code = 'API_TIMEOUT';
      const context = {
        service: 'veo',
      };

      expect(() =>
        service.reportError(
          error,
          ErrorSeverity.HIGH,
          context,
          'test-correlation-id',
        ),
      ).not.toThrow();
    });
  });

  describe('getErrorStats', () => {
    it('should return empty stats initially', () => {
      const stats = service.getErrorStats();
      expect(stats).toEqual({});
    });

    it('should track error counts', () => {
      const error = new Error('Test error');
      const context = { userId: 'user-123' };

      service.reportError(
        error,
        ErrorSeverity.MEDIUM,
        context,
        'correlation-1',
      );
      service.reportError(
        error,
        ErrorSeverity.MEDIUM,
        context,
        'correlation-2',
      );

      const stats = service.getErrorStats();
      const key = `${ErrorSeverity.MEDIUM}:UNKNOWN_ERROR`;
      expect(stats[key]).toBeDefined();
      expect(stats[key].count).toBe(2);
      expect(stats[key].severity).toBe(ErrorSeverity.MEDIUM);
    });

    it('should track different error types separately', () => {
      const error1 = new Error('Error 1') as Error & { code: string };
      error1.code = 'ERROR_TYPE_1';
      const error2 = new Error('Error 2') as Error & { code: string };
      error2.code = 'ERROR_TYPE_2';
      const context = {};

      service.reportError(error1, ErrorSeverity.LOW, context, 'correlation-1');
      service.reportError(error2, ErrorSeverity.HIGH, context, 'correlation-2');

      const stats = service.getErrorStats();
      expect(Object.keys(stats).length).toBe(2);
    });
  });

  describe('clearErrorCounts', () => {
    it('should clear all error counts', () => {
      const error = new Error('Test error');
      const context = {};

      service.reportError(
        error,
        ErrorSeverity.MEDIUM,
        context,
        'correlation-1',
      );
      expect(Object.keys(service.getErrorStats()).length).toBeGreaterThan(0);

      service.clearErrorCounts();
      expect(service.getErrorStats()).toEqual({});
    });
  });

  describe('error severity handling', () => {
    it('should handle LOW severity errors', () => {
      const error = new Error('Low severity error');
      const context = {};

      expect(() =>
        service.reportError(error, ErrorSeverity.LOW, context, 'correlation-1'),
      ).not.toThrow();
    });

    it('should handle MEDIUM severity errors', () => {
      const error = new Error('Medium severity error');
      const context = {};

      expect(() =>
        service.reportError(
          error,
          ErrorSeverity.MEDIUM,
          context,
          'correlation-1',
        ),
      ).not.toThrow();
    });

    it('should handle HIGH severity errors', () => {
      const error = new Error('High severity error');
      const context = {};

      expect(() =>
        service.reportError(
          error,
          ErrorSeverity.HIGH,
          context,
          'correlation-1',
        ),
      ).not.toThrow();
    });

    it('should handle CRITICAL severity errors', () => {
      const error = new Error('Critical severity error');
      const context = {};

      expect(() =>
        service.reportError(
          error,
          ErrorSeverity.CRITICAL,
          context,
          'correlation-1',
        ),
      ).not.toThrow();
    });
  });
});
