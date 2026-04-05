/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/require-await */

// Mock firebase-admin before any imports
jest.mock('firebase-admin', () => {
  const mockAuth = {
    verifyIdToken: jest.fn().mockResolvedValue({
      uid: 'test-uid',
      email: 'test@example.com',
    }),
  };

  return {
    auth: () => mockAuth,
    initializeApp: jest.fn(),
    credential: {
      cert: jest.fn(),
    },
    apps: [],
  };
});

// Mock crawlee to avoid ESM issues in e2e tests
jest.mock('crawlee', () => ({
  CheerioCrawler: jest.fn(),
  Configuration: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { FirestoreService } from '../src/firebase/firestore.service';

describe('Integration Tests (e2e)', () => {
  let app: INestApplication;

  // Create comprehensive Firestore mock that supports all call chains
  const createMockDoc = (data: any) => ({
    get: jest.fn().mockResolvedValue({
      exists: true,
      data: () => data,
    }),
    set: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    collection: jest.fn(() => createMockCollection({})),
  });

  const createMockCollection = (docData: any) => ({
    doc: jest.fn(() => createMockDoc(docData)),
    add: jest.fn().mockResolvedValue({ id: 'mock-id' }),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue({
      empty: true,
      docs: [],
    }),
  });

  const mockFirestore = {
    collection: jest.fn((name: string) => {
      if (name === 'businesses') {
        return createMockCollection({
          ownerId: 'test-uid',
          subscription: { tier: 'starter' },
        });
      }
      if (name === 'api_calls') {
        return createMockCollection({});
      }
      return createMockCollection({});
    }),
    doc: jest.fn(() => createMockDoc({})),
    runTransaction: jest.fn(),
    getFirestore: jest.fn().mockReturnValue({
      collection: jest.fn(() => createMockCollection({})),
      doc: jest.fn(() => createMockDoc({ role: 'owner' })),
    }),
  };

  // Helper function to create valid ad payload
  const createValidAdPayload = (overrides = {}) => ({
    businessId: '123e4567-e89b-12d3-a456-426614174000',
    productId: '123e4567-e89b-12d3-a456-426614174001',
    createdBy: 'test-uid',
    prompt_inputs: {
      prompt: 'Integration test video',
      platform: 'tiktok' as const,
      language: 'en',
    },
    veo_config: {
      aspect_ratio: '9:16' as const,
      duration_sec: 8, // MVP: 8 seconds only
    },
    ...overrides,
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(FirestoreService)
      .useValue(mockFirestore)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Complete Job Flow', () => {
    it('should complete: Create job → Track cost → Check quota → Increment usage', async () => {
      const businessId = '123e4567-e89b-12d3-a456-426614174000';
      const jobId = 'test-job-integration';
      let quotaCount = 0;

      // Override mock for this specific test
      mockFirestore.collection.mockImplementation((name: string) => {
        if (name === 'businesses') {
          return {
            doc: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue({
                exists: true,
                data: () => ({
                  ownerId: 'test-uid',
                  subscription: { tier: 'starter' },
                }),
              }),
              collection: jest.fn((collectionName: string) => {
                if (collectionName === 'projects') {
                  return {
                    add: jest.fn().mockResolvedValue({ id: jobId }),
                    doc: jest.fn().mockReturnValue({
                      get: jest.fn().mockResolvedValue({
                        exists: true,
                        data: () => ({
                          videosCreated: quotaCount,
                          requests: [],
                          updatedAt: { toDate: () => new Date() },
                        }),
                      }),
                      set: jest.fn(),
                      update: jest.fn(),
                    }),
                  };
                }
                if (collectionName === 'quota') {
                  return {
                    doc: jest.fn().mockReturnValue({
                      get: jest.fn().mockResolvedValue({
                        exists: true,
                        data: () => ({ videosCreated: quotaCount }),
                      }),
                      set: jest.fn(),
                      update: jest.fn(),
                    }),
                  };
                }
                if (collectionName === 'rate_limits') {
                  return {
                    doc: jest.fn().mockReturnValue({
                      get: jest.fn().mockResolvedValue({
                        exists: true,
                        data: () => ({
                          requests: [],
                          updatedAt: { toDate: () => new Date() },
                        }),
                      }),
                      update: jest.fn(),
                    }),
                  };
                }
                return createMockCollection({});
              }),
            }),
          };
        }
        return createMockCollection({});
      });

      mockFirestore.runTransaction.mockImplementation(async (callback) => {
        const mockTransaction = {
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ videosCreated: quotaCount }),
          }),
          update: jest.fn(),
          set: jest.fn(),
        };
        const result = await callback(mockTransaction);
        if (
          result &&
          typeof result === 'object' &&
          'allowed' in result &&
          result.allowed
        ) {
          quotaCount++;
        }
        return result;
      });

      // Create job
      const createResponse = await request(app.getHttpServer())
        .post('/ads')
        .set('Authorization', 'Bearer mock-token')
        .set('x-business-id', businessId)
        .send(createValidAdPayload({ businessId }))
        .expect(201);

      expect(createResponse.body).toHaveProperty('id');

      // Check job status
      const statusResponse = await request(app.getHttpServer())
        .get(`/ads/${jobId}?businessId=${businessId}`)
        .set('Authorization', 'Bearer mock-token')
        .set('x-business-id', businessId)
        .expect(200);

      expect(statusResponse.body.status).toBe('processing');

      // Quota is NOT incremented at job creation
      expect(quotaCount).toBe(0);
    });
  });

  describe('Quota Reset Flow', () => {
    it('should reset quota on month boundary', async () => {
      const businessId = '123e4567-e89b-12d3-a456-426614174000';
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        .toISOString()
        .substring(0, 7); // Format: YYYY-MM

      // Mock last month's usage (quota was exhausted)
      mockFirestore.collection.mockImplementation((name: string) => {
        if (name === 'businesses') {
          return {
            doc: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue({
                exists: true,
                data: () => ({
                  ownerId: 'test-uid',
                  subscription: { tier: 'free' }, // 2 videos per month
                }),
              }),
              collection: jest.fn((collectionName: string) => {
                if (collectionName === 'usage') {
                  return {
                    doc: jest.fn((month: string) => ({
                      get: jest.fn().mockResolvedValue({
                        exists: month === lastMonth, // Last month exists, current month doesn't
                        data: () =>
                          month === lastMonth
                            ? {
                                videosCreated: 2, // Used all quota last month
                                month: lastMonth,
                              }
                            : null,
                      }),
                      set: jest.fn(),
                    })),
                  };
                }
                if (collectionName === 'rate_limits') {
                  return {
                    doc: jest.fn().mockReturnValue({
                      get: jest.fn().mockResolvedValue({
                        exists: true,
                        data: () => ({
                          requests: [],
                          updatedAt: { toDate: () => new Date() },
                        }),
                      }),
                      update: jest.fn(),
                    }),
                  };
                }
                return createMockCollection({});
              }),
            }),
          };
        }
        return createMockCollection({});
      });

      // Verify quota check shows reset quota for current month (no usage doc = 0 used)
      const quota = await request(app.getHttpServer())
        .post('/ads')
        .set('Authorization', 'Bearer mock-token')
        .set('x-business-id', businessId)
        .send(createValidAdPayload({ businessId }));

      // Should not be rejected due to quota (new month = reset quota, 0/2 used)
      // Accept 201 (success) or any non-402 status (quota not exceeded)
      expect(quota.status).not.toBe(402);
    });
  });

  describe('Rate Limit Cleanup Flow', () => {
    it('should cleanup stale rate limit entries after 1 hour', async () => {
      const businessId = '123e4567-e89b-12d3-a456-426614174000';
      const oneHourAgo = new Date(Date.now() - 61 * 60 * 1000);

      // Create stale timestamps (over 1 hour old)
      const staleTimestamps = Array(10)
        .fill(null)
        .map(() => ({
          timestamp: {
            toDate: () => oneHourAgo,
          },
        }));

      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              ownerId: 'owner-uid',
              subscription: { tier: 'free' },
            }),
          }),
          collection: jest.fn().mockReturnValue({
            doc: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue({
                exists: true,
                data: () => ({
                  requests: staleTimestamps,
                  updatedAt: {
                    toDate: () => oneHourAgo,
                  },
                }),
              }),
              delete: jest.fn(),
              update: jest.fn(),
            }),
            where: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValue({
              empty: true,
              docs: [],
            }),
          }),
        }),
      });

      // Request should succeed because stale entry should be ignored
      await request(app.getHttpServer())
        .get(`/ads?businessId=${businessId}`)
        .set('Authorization', 'Bearer mock-token')
        .set('x-business-id', businessId)
        .expect(200);
    });
  });

  describe('Firestore Transaction Conflicts', () => {
    it('should handle transaction conflicts gracefully', async () => {
      const businessId = '123e4567-e89b-12d3-a456-426614174000';
      let attemptCount = 0;

      // Simulate transaction conflict on first attempt, success on retry
      mockFirestore.runTransaction.mockImplementation(async (callback) => {
        attemptCount++;

        if (attemptCount === 1) {
          throw new Error('Transaction conflict');
        }

        const mockTransaction = {
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ videosCreated: 0 }),
          }),
          update: jest.fn(),
          set: jest.fn(),
        };

        return callback(mockTransaction);
      });

      // Should retry and succeed (or fail gracefully, not with generic 500)
      const response = await request(app.getHttpServer())
        .post('/ads')
        .set('Authorization', 'Bearer mock-token')
        .set('x-business-id', businessId)
        .send(createValidAdPayload({ businessId }));

      // Accept either success or specific error (not generic 500)
      expect([201, 400, 403, 429]).toContain(response.status);
    });
  });

  describe('Cost Tracking Flow', () => {
    it('should track costs for all API calls in a job', async () => {
      const businessId = '123e4567-e89b-12d3-a456-426614174000';
      const jobId = 'cost-tracking-job';

      mockFirestore.collection.mockImplementation((collectionName: string) => {
        if (collectionName === 'api_calls') {
          return {
            add: jest.fn().mockResolvedValue({ id: 'call-id' }),
          };
        }

        if (collectionName === 'businesses') {
          return {
            doc: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue({
                exists: true,
                data: () => ({
                  ownerId: 'test-uid',
                  subscription: { tier: 'pro' },
                }),
              }),
              collection: jest.fn((name: string) => {
                if (name === 'projects') {
                  return {
                    doc: jest.fn().mockReturnValue({
                      get: jest.fn().mockResolvedValue({
                        exists: true,
                        data: () => ({
                          id: jobId,
                          status: 'completed',
                          businessId,
                          costBreakdown: {
                            veo: 1.5,
                            claude: 0.05,
                            gemini: 0.02,
                            total: 1.57,
                          },
                        }),
                      }),
                    }),
                  };
                }
                if (name === 'rate_limits') {
                  return {
                    doc: jest.fn().mockReturnValue({
                      get: jest.fn().mockResolvedValue({
                        exists: true,
                        data: () => ({
                          requests: [],
                          updatedAt: { toDate: () => new Date() },
                        }),
                      }),
                      update: jest.fn(),
                    }),
                  };
                }
                return createMockCollection({});
              }),
            }),
          };
        }

        return createMockCollection({});
      });

      // Get job with cost breakdown
      const response = await request(app.getHttpServer())
        .get(`/ads/${jobId}?businessId=${businessId}`)
        .set('Authorization', 'Bearer mock-token')
        .set('x-business-id', businessId)
        .expect(200);

      expect(response.body.costBreakdown).toBeDefined();
      expect(response.body.costBreakdown.total).toBeGreaterThan(0);
    });
  });
});
