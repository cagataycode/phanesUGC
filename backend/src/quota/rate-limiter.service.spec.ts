import { Test, TestingModule } from '@nestjs/testing';
import { RateLimiterService } from './rate-limiter.service';
import { FirestoreService } from '../firebase/firestore.service';
import { StructuredLoggerService } from '../monitoring/structured-logger.service';
import { SubscriptionTier } from './quota.service';

/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unused-vars */

describe('RateLimiterService', () => {
  let service: RateLimiterService;
  let firestoreService: jest.Mocked<FirestoreService>;
  let structuredLogger: jest.Mocked<StructuredLoggerService>;

  const mockBusinessId = 'business-123';

  beforeEach(async () => {
    const mockFirestore = {
      collection: jest.fn().mockReturnThis(),
      collectionGroup: jest.fn().mockReturnThis(),
      doc: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      get: jest.fn(),
      set: jest.fn(),
      update: jest.fn(),
      runTransaction: jest.fn(),
      batch: jest.fn(),
    };

    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimiterService,
        {
          provide: FirestoreService,
          useValue: mockFirestore,
        },
        {
          provide: StructuredLoggerService,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<RateLimiterService>(RateLimiterService);
    firestoreService = module.get(FirestoreService);
    structuredLogger = module.get(StructuredLoggerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkRateLimit', () => {
    it('should allow first request', async () => {
      const mockDoc = {
        exists: false,
      };

      firestoreService.get.mockResolvedValue(mockDoc as any);

      const status = await service.checkRateLimit(
        mockBusinessId,
        SubscriptionTier.FREE,
      );

      expect(status.allowed).toBe(true);
      expect(status.requestsRemaining).toBe(9); // 10 - 1
    });

    it('should allow request within rate limit', async () => {
      const now = new Date();
      const mockDoc = {
        exists: true,
        data: () => ({
          requests: [
            { timestamp: { toDate: () => new Date(now.getTime() - 30000) } },
            { timestamp: { toDate: () => new Date(now.getTime() - 20000) } },
          ],
        }),
      };

      firestoreService.get.mockResolvedValue(mockDoc as any);

      const status = await service.checkRateLimit(
        mockBusinessId,
        SubscriptionTier.FREE,
      );

      expect(status.allowed).toBe(true);
      expect(status.requestsRemaining).toBe(7); // 10 - 2 - 1
    });

    it('should deny request when rate limit exceeded', async () => {
      const now = new Date();
      const requests = Array.from({ length: 10 }, (_, i) => ({
        timestamp: { toDate: () => new Date(now.getTime() - i * 5000) },
      }));

      const mockDoc = {
        exists: true,
        data: () => ({
          requests,
        }),
      };

      firestoreService.get.mockResolvedValue(mockDoc as any);

      const status = await service.checkRateLimit(
        mockBusinessId,
        SubscriptionTier.FREE,
      );

      expect(status.allowed).toBe(false);
      expect(status.requestsRemaining).toBe(0);
      expect(status.retryAfter).toBeGreaterThan(0);
    });

    it('should filter out old requests', async () => {
      const now = new Date();
      const mockDoc = {
        exists: true,
        data: () => ({
          requests: [
            { timestamp: { toDate: () => new Date(now.getTime() - 70000) } }, // old
            { timestamp: { toDate: () => new Date(now.getTime() - 30000) } }, // recent
          ],
        }),
      };

      firestoreService.get.mockResolvedValue(mockDoc as any);

      const status = await service.checkRateLimit(
        mockBusinessId,
        SubscriptionTier.FREE,
      );

      expect(status.allowed).toBe(true);
      expect(status.requestsRemaining).toBe(8); // Only 1 recent request counted
    });
  });

  describe('checkConcurrentJobs', () => {
    it('should allow job if under concurrent limit', async () => {
      const mockSnapshot = {
        size: 0,
      };

      firestoreService.get.mockResolvedValue(mockSnapshot as any);

      const allowed = await service.checkConcurrentJobs(
        mockBusinessId,
        SubscriptionTier.FREE,
      );

      expect(allowed).toBe(true);
    });

    it('should deny job if at concurrent limit', async () => {
      const mockSnapshot = {
        size: 1, // FREE tier limit is 1
      };

      firestoreService.get.mockResolvedValue(mockSnapshot as any);

      const allowed = await service.checkConcurrentJobs(
        mockBusinessId,
        SubscriptionTier.FREE,
      );

      expect(allowed).toBe(false);
    });

    it('should allow more concurrent jobs for higher tiers', async () => {
      const mockSnapshot = {
        size: 3,
      };

      firestoreService.get.mockResolvedValue(mockSnapshot as any);

      const allowed = await service.checkConcurrentJobs(
        mockBusinessId,
        SubscriptionTier.PRO, // PRO tier limit is 5
      );

      expect(allowed).toBe(true);
    });
  });

  describe('recordRequest', () => {
    it('should create new rate limit document if not exists', async () => {
      const mockDoc = {
        exists: false,
      };

      const mockTransaction = {
        get: jest.fn().mockResolvedValue(mockDoc),
        set: jest.fn(),
        update: jest.fn(),
      };

      firestoreService.runTransaction.mockImplementation(
        async (callback: any) => {
          await callback(mockTransaction);
        },
      );

      await service.recordRequest(mockBusinessId);

      expect(mockTransaction.set).toHaveBeenCalled();
    });

    it('should update existing rate limit document', async () => {
      const now = new Date();
      const mockDoc = {
        exists: true,
        data: () => ({
          requests: [
            { timestamp: { toDate: () => new Date(now.getTime() - 30000) } },
          ],
        }),
      };

      const mockTransaction = {
        get: jest.fn().mockResolvedValue(mockDoc),
        set: jest.fn(),
        update: jest.fn(),
      };

      firestoreService.runTransaction.mockImplementation(
        async (callback: any) => {
          await callback(mockTransaction);
        },
      );

      await service.recordRequest(mockBusinessId);

      expect(mockTransaction.update).toHaveBeenCalled();
    });
  });

  describe('getRateLimitConfig', () => {
    it('should return correct config for FREE tier', () => {
      const config = service.getRateLimitConfig(SubscriptionTier.FREE);

      expect(config).toEqual({
        requestsPerMinute: 10,
        concurrentJobs: 1,
      });
    });

    it('should return correct config for ENTERPRISE tier', () => {
      const config = service.getRateLimitConfig(SubscriptionTier.ENTERPRISE);

      expect(config).toEqual({
        requestsPerMinute: 100,
        concurrentJobs: 10,
      });
    });
  });
});
