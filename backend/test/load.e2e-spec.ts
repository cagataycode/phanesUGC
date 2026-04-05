/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */

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

describe('Load Tests (e2e)', () => {
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

  describe('Concurrent Job Creation', () => {
    it('should handle 50 concurrent job creation requests', async () => {
      const businessId = '123e4567-e89b-12d3-a456-426614174000';
      let jobCount = 0;

      // Mock business with high quota
      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              ownerId: 'owner-uid',
              subscription: { tier: 'enterprise' }, // Unlimited
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

      mockFirestore.runTransaction.mockImplementation(async (callback) => {
        const mockTransaction = {
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              videosCreated: jobCount,
            }),
          }),
          update: jest.fn(),
        };

        const result = await callback(mockTransaction);
        if (result.allowed) {
          jobCount++;
        }
        return result;
      });

      const startTime = Date.now();

      // Create 50 concurrent requests
      const requests = Array(50)
        .fill(null)
        .map(() =>
          request(app.getHttpServer())
            .post('/ads')
            .set('Authorization', 'Bearer mock-token')
            .send({
              businessId,
              prompt: 'Load test',
              productName: 'Test Product',
              platform: 'tiktok',
              aspectRatio: '9:16',
            }),
        );

      const responses = await Promise.all(requests);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const successCount = responses.filter((r) => r.status === 201).length;
      const errorCount = responses.filter((r) => r.status >= 400).length;

      console.log(`Load Test Results:`);
      console.log(`  Total Requests: 50`);
      console.log(`  Successful: ${successCount}`);
      console.log(`  Errors: ${errorCount}`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Avg Response Time: ${duration / 50}ms`);

      // Assertions
      expect(successCount).toBeGreaterThan(0);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });

  describe('High Throughput Status Polling', () => {
    it('should handle 100 concurrent status check requests', async () => {
      const businessId = '123e4567-e89b-12d3-a456-426614174000';
      const jobId = 'test-job-123';

      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              ownerId: 'owner-uid',
              subscription: { tier: 'pro' },
              id: jobId,
              status: 'processing',
              businessId,
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

      const startTime = Date.now();

      // Create 100 concurrent status check requests
      const requests = Array(100)
        .fill(null)
        .map(() =>
          request(app.getHttpServer())
            .get(`/ads/${jobId}?businessId=${businessId}`)
            .set('Authorization', 'Bearer mock-token'),
        );

      const responses = await Promise.all(requests);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const successCount = responses.filter((r) => r.status === 200).length;
      const throughput = (successCount / duration) * 1000; // requests per second

      console.log(`Status Polling Load Test:`);
      console.log(`  Total Requests: 100`);
      console.log(`  Successful: ${successCount}`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Throughput: ${throughput.toFixed(2)} req/s`);

      expect(successCount).toBeGreaterThan(90); // At least 90% success rate
      expect(throughput).toBeGreaterThan(10); // At least 10 req/s
    });
  });

  describe('Rate Limiter Under Load', () => {
    it('should correctly enforce rate limits under high concurrency', async () => {
      const businessId = '123e4567-e89b-12d3-a456-426614174000';
      let requestCount = 0;

      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              ownerId: 'owner-uid',
              subscription: { tier: 'free' }, // 10 req/min limit
            }),
          }),
          collection: jest.fn().mockReturnValue({
            doc: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue({
                exists: true,
                data: () => ({
                  requests: requestCount,
                  windowStart: new Date(),
                }),
              }),
              update: jest.fn().mockImplementation(() => {
                requestCount++;
              }),
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

      // Make 20 concurrent requests (should block 10)
      const requests = Array(20)
        .fill(null)
        .map(() =>
          request(app.getHttpServer())
            .get(`/ads?businessId=${businessId}`)
            .set('Authorization', 'Bearer mock-token'),
        );

      const responses = await Promise.all(requests);

      const successCount = responses.filter((r) => r.status === 200).length;
      const rateLimitedCount = responses.filter((r) => r.status === 429).length;

      console.log(`Rate Limiter Load Test:`);
      console.log(`  Total Requests: 20`);
      console.log(`  Successful: ${successCount}`);
      console.log(`  Rate Limited: ${rateLimitedCount}`);

      expect(rateLimitedCount).toBeGreaterThan(0);
      expect(successCount).toBeLessThanOrEqual(10);
    });
  });

  describe('Quota Increment Under Concurrency', () => {
    it('should maintain quota accuracy with 20 concurrent increments', async () => {
      const businessId = '123e4567-e89b-12d3-a456-426614174000';
      let actualCount = 0;

      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              ownerId: 'owner-uid',
              subscription: { tier: 'enterprise' },
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

      // Simulate atomic transaction with proper locking
      mockFirestore.runTransaction.mockImplementation(async (callback) => {
        const currentCount = actualCount;

        const mockTransaction = {
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              videosCreated: currentCount,
            }),
          }),
          update: jest.fn(),
        };

        const result = await callback(mockTransaction);

        if (result.allowed) {
          actualCount++;
        }

        return result;
      });

      // Make 20 concurrent quota increment requests
      const requests = Array(20)
        .fill(null)
        .map(() =>
          request(app.getHttpServer())
            .post('/ads')
            .set('Authorization', 'Bearer mock-token')
            .send({
              businessId,
              prompt: 'Concurrency test',
              productName: 'Test',
              platform: 'tiktok',
              aspectRatio: '9:16',
            }),
        );

      await Promise.all(requests);

      console.log(`Quota Concurrency Test:`);
      console.log(`  Expected Increments: 20`);
      console.log(`  Actual Count: ${actualCount}`);

      // With atomic transactions, count should be accurate
      expect(actualCount).toBe(20);
    });
  });
});
