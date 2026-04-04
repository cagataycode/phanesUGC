/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { CostTrackerService, ApiCallCost } from './cost-tracker.service';
import { FirestoreService } from '../firebase/firestore.service';
import { StructuredLoggerService } from '../monitoring/structured-logger.service';
import { PerformanceMonitorService } from '../monitoring/performance-monitor.service';
import { PRICING_CONFIG } from './pricing-config';

describe('CostTrackerService', () => {
  let service: CostTrackerService;
  let structuredLogger: jest.Mocked<StructuredLoggerService>;
  let performanceMonitor: jest.Mocked<PerformanceMonitorService>;

  // Mock Firestore with nested collection support
  const mockSubDocRef = {
    get: jest.fn(),
    set: jest.fn(),
    update: jest.fn(),
  };

  const mockSubCollectionRef = {
    doc: jest.fn(() => mockSubDocRef),
    get: jest.fn(),
  };

  const mockDocRef = {
    get: jest.fn(),
    update: jest.fn(),
    collection: jest.fn(() => mockSubCollectionRef), // Support nested collections
  };

  const mockCollectionRef = {
    doc: jest.fn(() => mockDocRef),
  };

  const mockFirestore = {
    collection: jest.fn(() => mockCollectionRef),
    runTransaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CostTrackerService,
        {
          provide: FirestoreService,
          useValue: {
            getFirestore: jest.fn(() => mockFirestore),
          },
        },
        {
          provide: StructuredLoggerService,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
          },
        },
        {
          provide: PerformanceMonitorService,
          useValue: {
            trackCount: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CostTrackerService>(CostTrackerService);
    structuredLogger = module.get(StructuredLoggerService);
    performanceMonitor = module.get(PerformanceMonitorService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('calculateVeoCost', () => {
    it('should calculate cost for fast quality', () => {
      const cost = service.calculateVeoCost(10, 'fast');
      expect(cost).toBe(10 * PRICING_CONFIG.veo.fast);
      expect(cost).toBe(1.5); // 10 * 0.15
    });

    it('should calculate cost for standard quality', () => {
      const cost = service.calculateVeoCost(10, 'standard');
      expect(cost).toBe(10 * PRICING_CONFIG.veo.standard);
      expect(cost).toBe(4.0); // 10 * 0.40
    });

    it('should default to fast quality', () => {
      const cost = service.calculateVeoCost(5);
      expect(cost).toBe(5 * PRICING_CONFIG.veo.fast);
      expect(cost).toBe(0.75); // 5 * 0.15
    });

    it('should handle fractional seconds', () => {
      const cost = service.calculateVeoCost(5.5, 'fast');
      expect(cost).toBe(5.5 * PRICING_CONFIG.veo.fast);
      expect(cost).toBe(0.825); // 5.5 * 0.15
    });
  });

  describe('calculateClaudeCost', () => {
    it('should calculate cost based on input and output tokens', () => {
      const inputTokens = 1000;
      const outputTokens = 500;
      const cost = service.calculateClaudeCost(inputTokens, outputTokens);

      const expectedCost =
        inputTokens * PRICING_CONFIG.claude.inputTokens +
        outputTokens * PRICING_CONFIG.claude.outputTokens;

      expect(cost).toBe(expectedCost);
      expect(cost).toBeCloseTo(0.0105, 4); // (1000 * 0.000003) + (500 * 0.000015)
    });

    it('should handle zero tokens', () => {
      const cost = service.calculateClaudeCost(0, 0);
      expect(cost).toBe(0);
    });

    it('should handle only input tokens', () => {
      const cost = service.calculateClaudeCost(1000, 0);
      expect(cost).toBe(1000 * PRICING_CONFIG.claude.inputTokens);
    });

    it('should handle only output tokens', () => {
      const cost = service.calculateClaudeCost(0, 500);
      expect(cost).toBe(500 * PRICING_CONFIG.claude.outputTokens);
    });
  });

  describe('calculateGeminiCost', () => {
    it('should calculate cost based on input and output tokens', () => {
      const inputTokens = 1000;
      const outputTokens = 500;
      const cost = service.calculateGeminiCost(inputTokens, outputTokens);

      const expectedCost =
        inputTokens * PRICING_CONFIG.gemini.inputTokens +
        outputTokens * PRICING_CONFIG.gemini.outputTokens;

      expect(cost).toBe(expectedCost);
      expect(cost).toBeCloseTo(0.00625, 5); // (1000 * 0.00000125) + (500 * 0.00001)
    });

    it('should handle zero tokens', () => {
      const cost = service.calculateGeminiCost(0, 0);
      expect(cost).toBe(0);
    });
  });

  describe('trackApiCall', () => {
    const jobId = 'test-job-123';
    const businessId = 'test-business-456';

    beforeEach(() => {
      // Mock the nested collection structure for agent_jobs
      mockSubDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          apiCalls: [],
        }),
      } as any);
      mockSubDocRef.update.mockResolvedValue(undefined as any);
      mockFirestore.runTransaction.mockImplementation((callback) => {
        const transaction = {
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ monthlyCosts: {} }),
          }),
          update: jest.fn(),
        };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        return Promise.resolve(callback(transaction));
      });
    });

    it('should track a Veo API call', async () => {
      const call: ApiCallCost = {
        service: 'veo',
        operation: 'generateVideo',
        durationSeconds: 10,
        cost: 1.5,
        timestamp: new Date(),
      };

      await service.trackApiCall(jobId, businessId, call);

      expect(mockSubDocRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          apiCalls: expect.arrayContaining([
            expect.objectContaining({
              service: 'veo',
              operation: 'generateVideo',
              durationSeconds: 10,
              cost: 1.5,
            }),
          ]),
          costBreakdown: expect.objectContaining({
            veoGeneration: 1.5,
            totalCost: 1.5,
          }),
        }),
      );

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(structuredLogger.log).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(performanceMonitor.trackCount).toHaveBeenCalledWith(
        'cost.veo',
        1.5,
        expect.any(Object),
      );
    });

    it('should track a Claude API call', async () => {
      const call: ApiCallCost = {
        service: 'claude',
        operation: 'generateText',
        inputTokens: 1000,
        outputTokens: 500,
        cost: 0.0105,
        timestamp: new Date(),
      };

      await service.trackApiCall(jobId, businessId, call);

      expect(mockDocRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          costBreakdown: expect.objectContaining({
            claudeCalls: 0.0105,
            totalCost: 0.0105,
          }),
        }),
      );
    });

    it('should track a Gemini API call', async () => {
      const call: ApiCallCost = {
        service: 'gemini',
        operation: 'generateText',
        inputTokens: 1000,
        outputTokens: 500,
        cost: 0.00625,
        timestamp: new Date(),
      };

      await service.trackApiCall(jobId, businessId, call);

      expect(mockDocRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          costBreakdown: expect.objectContaining({
            geminiCalls: 0.00625,
            totalCost: 0.00625,
          }),
        }),
      );
    });

    it('should accumulate multiple API calls', async () => {
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          apiCalls: [
            {
              service: 'claude',
              operation: 'generateBrief',
              inputTokens: 500,
              outputTokens: 200,
              cost: 0.005,
              timestamp: new Date(),
            },
          ],
        }),
      } as any);

      const call: ApiCallCost = {
        service: 'veo',
        operation: 'generateVideo',
        durationSeconds: 10,
        cost: 1.5,
        timestamp: new Date(),
      };

      await service.trackApiCall(jobId, businessId, call);

      expect(mockDocRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          apiCalls: expect.arrayContaining([
            expect.objectContaining({ service: 'claude' }),
            expect.objectContaining({ service: 'veo' }),
          ]),
          costBreakdown: expect.objectContaining({
            claudeCalls: 0.005,
            veoGeneration: 1.5,
            totalCost: 1.505,
          }),
        }),
      );
    });

    it('should skip tracking if job does not exist', async () => {
      mockSubDocRef.get.mockResolvedValue({
        exists: false,
      } as any);

      const call: ApiCallCost = {
        service: 'veo',
        operation: 'generateVideo',
        durationSeconds: 10,
        cost: 1.5,
        timestamp: new Date(),
      };

      await service.trackApiCall(jobId, businessId, call);

      expect(mockSubDocRef.update).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockSubDocRef.get.mockRejectedValue(new Error('Firestore error'));

      const call: ApiCallCost = {
        service: 'veo',
        operation: 'generateVideo',
        durationSeconds: 10,
        cost: 1.5,
        timestamp: new Date(),
      };

      await expect(
        service.trackApiCall(jobId, businessId, call),
      ).rejects.toThrow('Firestore error');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(structuredLogger.error).toHaveBeenCalled();
    });
  });

  describe('getJobCost', () => {
    const jobId = 'test-job-123';
    const businessId = 'test-business-456';

    it('should return cost breakdown for a job', async () => {
      const mockCostBreakdown = {
        veoGeneration: 1.5,
        claudeCalls: 0.01,
        geminiCalls: 0.005,
        totalCost: 1.515,
        currency: 'USD' as const,
      };

      mockSubDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          costBreakdown: mockCostBreakdown,
        }),
      } as any);

      const result = await service.getJobCost(jobId, businessId);

      expect(result).toEqual(mockCostBreakdown);
    });

    it('should return zero costs if no cost breakdown exists', async () => {
      mockSubDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({}),
      } as any);

      const result = await service.getJobCost(jobId, businessId);

      expect(result).toEqual({
        veoGeneration: 0,
        claudeCalls: 0,
        geminiCalls: 0,
        totalCost: 0,
        currency: 'USD',
      });
    });

    it('should throw error if job does not exist', async () => {
      mockSubDocRef.get.mockResolvedValue({
        exists: false,
      } as any);

      await expect(service.getJobCost(jobId, businessId)).rejects.toThrow(
        `Job ${jobId} not found`,
      );
    });
  });

  describe('getBusinessMonthlyCost', () => {
    const businessId = 'test-business-456';

    it('should return monthly cost for specified month', async () => {
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          monthlyCosts: {
            '2026-04': 123.45,
            '2026-03': 100.0,
          },
        }),
      } as any);

      const result = await service.getBusinessMonthlyCost(
        businessId,
        '2026-04',
      );

      expect(result).toBe(123.45);
    });

    it('should return 0 if month has no costs', async () => {
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          monthlyCosts: {},
        }),
      } as any);

      const result = await service.getBusinessMonthlyCost(
        businessId,
        '2026-04',
      );

      expect(result).toBe(0);
    });

    it('should return 0 if business does not exist', async () => {
      mockDocRef.get.mockResolvedValue({
        exists: false,
      } as any);

      const result = await service.getBusinessMonthlyCost(
        businessId,
        '2026-04',
      );

      expect(result).toBe(0);
    });

    it('should use current month if not specified', async () => {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({
          monthlyCosts: {
            [currentMonth]: 50.0,
          },
        }),
      } as any);

      const result = await service.getBusinessMonthlyCost(businessId);

      expect(result).toBe(50.0);
    });
  });
});
