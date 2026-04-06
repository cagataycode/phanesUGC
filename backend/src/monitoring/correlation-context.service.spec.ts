import { Test, TestingModule } from '@nestjs/testing';
import { CorrelationContextService } from './correlation-context.service';

describe('CorrelationContextService', () => {
  let service: CorrelationContextService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CorrelationContextService],
    }).compile();

    service = module.get<CorrelationContextService>(CorrelationContextService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('run', () => {
    it('should set and retrieve correlation ID in sync context', () => {
      const correlationId = 'test-correlation-id';

      service.run({ correlationId }, () => {
        expect(service.getCorrelationId()).toBe(correlationId);
      });
    });

    it('should return unknown when no context is set', () => {
      expect(service.getCorrelationId()).toBe('unknown');
    });

    it('should isolate contexts between different runs', () => {
      service.run({ correlationId: 'context-1' }, () => {
        expect(service.getCorrelationId()).toBe('context-1');
      });

      service.run({ correlationId: 'context-2' }, () => {
        expect(service.getCorrelationId()).toBe('context-2');
      });

      // Outside both contexts
      expect(service.getCorrelationId()).toBe('unknown');
    });

    it('should support nested contexts', () => {
      service.run({ correlationId: 'outer' }, () => {
        expect(service.getCorrelationId()).toBe('outer');

        service.run({ correlationId: 'inner' }, () => {
          expect(service.getCorrelationId()).toBe('inner');
        });

        // Back to outer context
        expect(service.getCorrelationId()).toBe('outer');
      });
    });
  });

  describe('runAsync', () => {
    it('should set and retrieve correlation ID in async context', async () => {
      const correlationId = 'async-correlation-id';

      await service.runAsync({ correlationId }, async () => {
        // Simulate async operation (minimal delay for CI)
        await new Promise((resolve) => setTimeout(resolve, 1));
        expect(service.getCorrelationId()).toBe(correlationId);
      });
    });

    it('should maintain context across multiple async operations', async () => {
      const correlationId = 'multi-async-id';

      await service.runAsync({ correlationId }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        expect(service.getCorrelationId()).toBe(correlationId);

        await new Promise((resolve) => setTimeout(resolve, 1));
        expect(service.getCorrelationId()).toBe(correlationId);
      });
    });

    it('should isolate async contexts', async () => {
      const promise1 = service.runAsync(
        { correlationId: 'async-1' },
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return service.getCorrelationId();
        },
      );

      const promise2 = service.runAsync(
        { correlationId: 'async-2' },
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 3));
          return service.getCorrelationId();
        },
      );

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toBe('async-1');
      expect(result2).toBe('async-2');
    });
  });

  describe('setContext', () => {
    it('should update context in existing async scope', () => {
      service.run({ correlationId: 'initial' }, () => {
        expect(service.getCorrelationId()).toBe('initial');

        service.setContext({ correlationId: 'updated' });
        expect(service.getCorrelationId()).toBe('updated');
      });
    });

    it('should merge context fields', () => {
      service.run({ correlationId: 'test-id' }, () => {
        service.setContext({ jobId: 'job-123', businessId: 'biz-456' });

        expect(service.getCorrelationId()).toBe('test-id');
        expect(service.getJobId()).toBe('job-123');
        expect(service.getBusinessId()).toBe('biz-456');
      });
    });

    it('should do nothing when no context exists', () => {
      // Should not throw
      service.setContext({ correlationId: 'test' });
      expect(service.getCorrelationId()).toBe('unknown');
    });
  });

  describe('context getters', () => {
    it('should retrieve all context fields', () => {
      const context = {
        correlationId: 'corr-123',
        jobId: 'job-456',
        businessId: 'biz-789',
        userId: 'user-abc',
        stage: 'processing',
      };

      service.run(context, () => {
        expect(service.getCorrelationId()).toBe('corr-123');
        expect(service.getJobId()).toBe('job-456');
        expect(service.getBusinessId()).toBe('biz-789');
        expect(service.getUserId()).toBe('user-abc');
        expect(service.getStage()).toBe('processing');
      });
    });

    it('should return undefined for unset fields', () => {
      service.run({ correlationId: 'test' }, () => {
        expect(service.getJobId()).toBeUndefined();
        expect(service.getBusinessId()).toBeUndefined();
        expect(service.getUserId()).toBeUndefined();
        expect(service.getStage()).toBeUndefined();
      });
    });

    it('should retrieve full context', () => {
      const context = {
        correlationId: 'test-id',
        jobId: 'job-123',
      };

      service.run(context, () => {
        const retrieved = service.getContext();
        expect(retrieved).toEqual(context);
      });
    });
  });

  describe('hasContext', () => {
    it('should return true when context is set', () => {
      service.run({ correlationId: 'test' }, () => {
        expect(service.hasContext()).toBe(true);
      });
    });

    it('should return false when no context is set', () => {
      expect(service.hasContext()).toBe(false);
    });
  });
});
