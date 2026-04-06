import { Test, TestingModule } from '@nestjs/testing';
import { QuotaService, SubscriptionTier } from './quota.service';
import { FirestoreService } from '../firebase/firestore.service';
import { StructuredLoggerService } from '../monitoring/structured-logger.service';
import { CostTrackerService } from '../cost/cost-tracker.service';

/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/unbound-method */

describe('QuotaService', () => {
  let service: QuotaService;
  let firestoreService: jest.Mocked<FirestoreService>;
  let structuredLogger: jest.Mocked<StructuredLoggerService>;

  const mockBusinessId = 'business-123';

  beforeEach(async () => {
    const mockFirestore = {
      collection: jest.fn().mockReturnThis(),
      doc: jest.fn().mockReturnThis(),
      get: jest.fn(),
      set: jest.fn(),
      update: jest.fn(),
      runTransaction: jest.fn(),
    };

    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const mockCostTracker = {
      getBusinessMonthlyCost: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotaService,
        {
          provide: FirestoreService,
          useValue: mockFirestore,
        },
        {
          provide: StructuredLoggerService,
          useValue: mockLogger,
        },
        {
          provide: CostTrackerService,
          useValue: mockCostTracker,
        },
      ],
    }).compile();

    service = module.get<QuotaService>(QuotaService);
    firestoreService = module.get(FirestoreService);
    structuredLogger = module.get(StructuredLoggerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSubscriptionTier', () => {
    it('should return tier from business document', async () => {
      const mockDoc = {
        exists: true,
        data: () => ({
          subscription: {
            tier: SubscriptionTier.PRO,
          },
        }),
      };

      firestoreService.get.mockResolvedValue(mockDoc as any);

      const tier = await service.getSubscriptionTier(mockBusinessId);

      expect(tier).toBe(SubscriptionTier.PRO);
    });

    it('should return FREE tier if business not found', async () => {
      const mockDoc = {
        exists: false,
      };

      firestoreService.get.mockResolvedValue(mockDoc as any);

      const tier = await service.getSubscriptionTier(mockBusinessId);

      expect(tier).toBe(SubscriptionTier.FREE);
    });

    it('should return FREE tier if subscription status is not active', async () => {
      const mockDoc = {
        exists: true,
        data: () => ({
          subscription: {
            tier: SubscriptionTier.PRO,
            status: 'canceled',
          },
        }),
      };

      firestoreService.get.mockResolvedValue(mockDoc as any);

      const tier = await service.getSubscriptionTier(mockBusinessId);

      expect(tier).toBe(SubscriptionTier.FREE);
    });

    it('should return FREE tier if subscription status is past_due', async () => {
      const mockDoc = {
        exists: true,
        data: () => ({
          subscription: {
            tier: SubscriptionTier.STARTER,
            status: 'past_due',
          },
        }),
      };

      firestoreService.get.mockResolvedValue(mockDoc as any);

      const tier = await service.getSubscriptionTier(mockBusinessId);

      expect(tier).toBe(SubscriptionTier.FREE);
    });

    it('should return paid tier if subscription status is active', async () => {
      const mockDoc = {
        exists: true,
        data: () => ({
          subscription: {
            tier: SubscriptionTier.PRO,
            status: 'active',
          },
        }),
      };

      firestoreService.get.mockResolvedValue(mockDoc as any);

      const tier = await service.getSubscriptionTier(mockBusinessId);

      expect(tier).toBe(SubscriptionTier.PRO);
    });

    it('should return FREE tier on error', async () => {
      firestoreService.get.mockRejectedValue(new Error('Firestore error'));

      const tier = await service.getSubscriptionTier(mockBusinessId);

      expect(tier).toBe(SubscriptionTier.FREE);
    });
  });

  describe('getTierLimits', () => {
    it('should return correct limits for FREE tier', () => {
      const limits = service.getTierLimits(SubscriptionTier.FREE);

      expect(limits).toEqual({
        monthlyVideos: 2,
        monthlyCostLimit: 5.0,
        concurrentJobs: 1,
        maxVideoDuration: 5,
        prioritySupport: false,
      });
    });

    it('should return correct limits for PRO tier', () => {
      const limits = service.getTierLimits(SubscriptionTier.PRO);

      expect(limits).toEqual({
        monthlyVideos: 40,
        monthlyCostLimit: 200.0,
        concurrentJobs: 5,
        maxVideoDuration: 10,
        prioritySupport: true,
      });
    });

    it('should return unlimited limits for ENTERPRISE tier', () => {
      const limits = service.getTierLimits(SubscriptionTier.ENTERPRISE);

      expect(limits.monthlyVideos).toBe(-1); // Unlimited
      expect(limits.monthlyCostLimit).toBe(-1); // Unlimited
      expect(limits.concurrentJobs).toBe(10);
    });
  });

  describe('checkQuota', () => {
    it('should return quota usage for business', async () => {
      const mockBusinessDoc = {
        exists: true,
        data: () => ({
          subscription: {
            tier: SubscriptionTier.STARTER,
          },
        }),
      };

      const mockUsageDoc = {
        exists: true,
        data: () => ({
          videosCreated: 5,
        }),
      };

      firestoreService.get
        .mockResolvedValueOnce(mockBusinessDoc as any)
        .mockResolvedValueOnce(mockUsageDoc as any);

      const quota = await service.checkQuota(mockBusinessId);

      expect(quota.videosCreated).toBe(5);
      expect(quota.videosRemaining).toBe(15); // 20 - 5
      expect(quota.tier).toBe(SubscriptionTier.STARTER);
      expect(quota.resetDate).toBeInstanceOf(Date);
    });

    it('should return full quota if no usage exists', async () => {
      const mockBusinessDoc = {
        exists: true,
        data: () => ({
          subscription: {
            tier: SubscriptionTier.FREE,
          },
        }),
      };

      const mockUsageDoc = {
        exists: false,
      };

      firestoreService.get
        .mockResolvedValueOnce(mockBusinessDoc as any)
        .mockResolvedValueOnce(mockUsageDoc as any);

      const quota = await service.checkQuota(mockBusinessId);

      expect(quota.videosCreated).toBe(0);
      expect(quota.videosRemaining).toBe(2);
    });

    it('should return unlimited quota for ENTERPRISE tier', async () => {
      const mockBusinessDoc = {
        exists: true,
        data: () => ({
          subscription: {
            tier: SubscriptionTier.ENTERPRISE,
          },
        }),
      };

      const mockUsageDoc = {
        exists: true,
        data: () => ({
          videosCreated: 100,
        }),
      };

      firestoreService.get
        .mockResolvedValueOnce(mockBusinessDoc as any)
        .mockResolvedValueOnce(mockUsageDoc as any);

      const quota = await service.checkQuota(mockBusinessId);

      expect(quota.videosRemaining).toBe(-1); // Unlimited
      expect(quota.tier).toBe(SubscriptionTier.ENTERPRISE);
    });
  });

  describe('canCreateJob', () => {
    it('should return true if quota available', async () => {
      const mockBusinessDoc = {
        exists: true,
        data: () => ({
          subscription: {
            tier: SubscriptionTier.FREE,
          },
        }),
      };

      const mockUsageDoc = {
        exists: true,
        data: () => ({
          videosCreated: 1,
        }),
      };

      firestoreService.get
        .mockResolvedValueOnce(mockBusinessDoc as any)
        .mockResolvedValueOnce(mockUsageDoc as any);

      const canCreate = await service.canCreateJob(mockBusinessId);

      expect(canCreate).toBe(true);
    });

    it('should return false if quota exceeded', async () => {
      const mockBusinessDoc = {
        exists: true,
        data: () => ({
          subscription: {
            tier: SubscriptionTier.FREE,
          },
        }),
      };

      const mockUsageDoc = {
        exists: true,
        data: () => ({
          videosCreated: 2,
        }),
      };

      firestoreService.get
        .mockResolvedValueOnce(mockBusinessDoc as any)
        .mockResolvedValueOnce(mockUsageDoc as any);

      const canCreate = await service.canCreateJob(mockBusinessId);

      expect(canCreate).toBe(false);
    });

    it('should return true for ENTERPRISE tier (unlimited)', async () => {
      const mockBusinessDoc = {
        exists: true,
        data: () => ({
          subscription: {
            tier: SubscriptionTier.ENTERPRISE,
          },
        }),
      };

      const mockUsageDoc = {
        exists: true,
        data: () => ({
          videosCreated: 1000, // Any amount - unlimited
        }),
      };

      firestoreService.get
        .mockResolvedValueOnce(mockBusinessDoc as any)
        .mockResolvedValueOnce(mockUsageDoc as any);

      const canCreate = await service.canCreateJob(mockBusinessId);

      expect(canCreate).toBe(true); // Unlimited
    });
  });

  describe('incrementUsage', () => {
    it('should create new usage document if not exists', async () => {
      const mockUsageDoc = {
        exists: false,
      };

      const mockTransaction = {
        get: jest.fn().mockResolvedValue(mockUsageDoc),
        set: jest.fn(),
        update: jest.fn(),
      };

      firestoreService.runTransaction.mockImplementation(
        async (callback: any) => {
          await callback(mockTransaction);
        },
      );

      await service.incrementUsage(mockBusinessId);

      expect(mockTransaction.set).toHaveBeenCalled();
      expect(structuredLogger.log).toHaveBeenCalledWith(
        'Quota usage incremented',
        expect.any(Object),
      );
    });

    it('should increment existing usage counter', async () => {
      const mockUsageDoc = {
        exists: true,
        data: () => ({
          videosCreated: 5,
        }),
      };

      const mockTransaction = {
        get: jest.fn().mockResolvedValue(mockUsageDoc),
        set: jest.fn(),
        update: jest.fn(),
      };

      firestoreService.runTransaction.mockImplementation(
        async (callback: any) => {
          await callback(mockTransaction);
        },
      );

      await service.incrementUsage(mockBusinessId);

      expect(mockTransaction.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          videosCreated: 6,
        }),
      );
    });
  });
});
