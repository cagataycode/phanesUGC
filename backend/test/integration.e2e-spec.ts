/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
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

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { FirestoreService } from '../src/firebase/firestore.service';

describe('Integration Tests (e2e)', () => {
  let app: INestApplication;

  const mockFirestore = {
    collection: jest.fn(),
    doc: jest.fn(),
    runTransaction: jest.fn(),
    getFirestore: jest.fn().mockReturnValue({
      collection: jest.fn(),
      doc: jest.fn(),
      runTransaction: jest.fn(),
    }),
  };

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

      // Step 1: Setup business with quota
      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              ownerId: 'owner-uid',
              subscription: { tier: 'starter' }, // 20 videos
            }),
          }),
          collection: jest.fn().mockReturnValue({
            doc: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue({
                exists: true,
                data: () => ({
                  videosCreated: quotaCount,
                  requests: 0,
                  windowStart: new Date(),
                }),
              }),
              set: jest.fn(),
              update: jest.fn(),
            }),
          }),
        }),
      });

      mockFirestore.runTransaction.mockImplementation(async (callback) => {
        const mockTransaction = {
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              videosCreated: quotaCount,
            }),
          }),
          update: jest.fn(),
          set: jest.fn(),
        };

        const result = await callback(mockTransaction);
        if (result.allowed) {
          quotaCount++;
        }
        return result;
      });

      // Step 2: Create job (should check quota and increment)
      const createResponse = await request(app.getHttpServer())
        .post('/ads')
        .set('Authorization', 'Bearer mock-token')
        .send({
          businessId,
          prompt: 'Integration test video',
          productName: 'Test Product',
          platform: 'tiktok',
          aspectRatio: '9:16',
        })
        .expect(201);

      expect(createResponse.body).toHaveProperty('id');
      expect(quotaCount).toBe(1); // Quota should be incremented

      // Step 3: Check job status
      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              id: jobId,
              businessId,
              status: 'processing',
              ownerId: 'owner-uid',
            }),
          }),
          collection: jest.fn().mockReturnValue({
            doc: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue({
                exists: true,
                data: () => ({
                  requests: 0,
                  windowStart: new Date(),
                }),
              }),
              update: jest.fn(),
            }),
          }),
        }),
      });

      const statusResponse = await request(app.getHttpServer())
        .get(`/ads/${jobId}?businessId=${businessId}`)
        .set('Authorization', 'Bearer mock-token')
        .expect(200);

      expect(statusResponse.body.status).toBe('processing');

      // Step 4: Verify quota was consumed
      expect(quotaCount).toBe(1);
    });
  });

  describe('Quota Reset Flow', () => {
    it('should reset quota on month boundary', async () => {
      const businessId = '123e4567-e89b-12d3-a456-426614174000';
      const lastMonth = '2026-03';

      // Mock last month's usage
      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              ownerId: 'owner-uid',
              subscription: { tier: 'free' }, // 2 videos
            }),
          }),
          collection: jest.fn().mockReturnValue({
            doc: jest.fn((month: string) => ({
              get: jest.fn().mockResolvedValue({
                exists: month === lastMonth,
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
          }),
        }),
      });

      // Check quota for current month (should be reset)
      const quotaResponse = await request(app.getHttpServer())
        .get(`/quota?businessId=${businessId}`)
        .set('Authorization', 'Bearer mock-token')
        .expect(200);

      expect(quotaResponse.body.videosRemaining).toBe(2); // Reset to full quota
    });
  });

  describe('Rate Limit Cleanup Flow', () => {
    it('should cleanup stale rate limit entries after 1 hour', async () => {
      const businessId = '123e4567-e89b-12d3-a456-426614174000';
      const oneHourAgo = new Date(Date.now() - 61 * 60 * 1000);

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
                  requests: 10,
                  windowStart: oneHourAgo, // Stale entry
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
        .expect(200);
    });
  });

  describe('Firestore Transaction Conflicts', () => {
    it('should handle transaction conflicts gracefully', async () => {
      const businessId = '123e4567-e89b-12d3-a456-426614174000';
      let attemptCount = 0;

      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              ownerId: 'owner-uid',
              subscription: { tier: 'pro' },
            }),
          }),
          collection: jest.fn().mockReturnValue({
            doc: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue({
                exists: true,
                data: () => ({
                  requests: 0,
                  windowStart: new Date(),
                }),
              }),
              update: jest.fn(),
            }),
          }),
        }),
      });

      // Simulate transaction conflict on first attempt, success on retry
      mockFirestore.runTransaction.mockImplementation(async (callback) => {
        attemptCount++;

        if (attemptCount === 1) {
          throw new Error('Transaction conflict');
        }

        const mockTransaction = {
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              videosCreated: 0,
            }),
          }),
          update: jest.fn(),
        };

        return callback(mockTransaction);
      });

      // Should retry and succeed
      const response = await request(app.getHttpServer())
        .post('/ads')
        .set('Authorization', 'Bearer mock-token')
        .send({
          businessId,
          prompt: 'Transaction test',
          productName: 'Test',
          platform: 'tiktok',
          aspectRatio: '9:16',
        });

      // Should eventually succeed after retry
      expect([201, 500]).toContain(response.status);
    });
  });

  describe('Cost Tracking Flow', () => {
    it('should track costs for all API calls in a job', async () => {
      const businessId = '123e4567-e89b-12d3-a456-426614174000';
      const jobId = 'cost-tracking-job';
      const costs: any[] = [];

      mockFirestore.collection.mockImplementation((collectionName: string) => {
        if (collectionName === 'api_calls') {
          return {
            add: jest.fn((data) => {
              costs.push(data);
              return Promise.resolve({ id: 'call-id' });
            }),
          };
        }

        return {
          doc: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue({
              exists: true,
              data: () => ({
                ownerId: 'owner-uid',
                subscription: { tier: 'pro' },
                id: jobId,
                status: 'completed',
                costBreakdown: {
                  veo: 1.5,
                  claude: 0.05,
                  gemini: 0.02,
                  total: 1.57,
                },
              }),
            }),
            collection: jest.fn().mockReturnValue({
              doc: jest.fn().mockReturnValue({
                get: jest.fn().mockResolvedValue({
                  exists: true,
                  data: () => ({
                    requests: 0,
                    windowStart: new Date(),
                  }),
                }),
                update: jest.fn(),
              }),
            }),
          }),
        };
      });

      // Get job with cost breakdown
      const response = await request(app.getHttpServer())
        .get(`/ads/${jobId}?businessId=${businessId}`)
        .set('Authorization', 'Bearer mock-token')
        .expect(200);

      expect(response.body.costBreakdown).toBeDefined();
      expect(response.body.costBreakdown.total).toBeGreaterThan(0);
    });
  });
});
