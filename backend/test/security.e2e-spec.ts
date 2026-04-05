/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/require-await */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { FirestoreService } from '../src/firebase/firestore.service';

describe('Security Tests (e2e)', () => {
  let app: INestApplication;

  // Mock Firestore
  const mockFirestore = {
    collection: jest.fn(),
    doc: jest.fn(),
    runTransaction: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(FirestoreService)
      .useValue(mockFirestore)
      .compile();

    app = moduleFixture.createNestApplication();

    // Enable validation pipe (same as production)
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('IDOR Protection', () => {
    it('should prevent User A from accessing User B jobs', async () => {
      // Mock: User A tries to access User B's business
      const userAToken = 'mock-token-user-a';
      const userBBusinessId = 'business-user-b';

      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              ownerId: 'user-b-uid',
              members: [],
            }),
          }),
        }),
      });

      const response = await request(app.getHttpServer())
        .get(`/ads?businessId=${userBBusinessId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(403);

      expect(response.body.message).toContain('Access denied');
    });

    it('should allow business owner to access their jobs', async () => {
      const ownerToken = 'mock-token-owner';
      const businessId = 'business-owner';

      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              ownerId: 'owner-uid',
              members: [],
            }),
          }),
          collection: jest.fn().mockReturnValue({
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

      await request(app.getHttpServer())
        .get(`/ads?businessId=${businessId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
    });

    it('should allow business member to access jobs', async () => {
      const memberToken = 'mock-token-member';
      const businessId = 'business-with-members';

      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              ownerId: 'owner-uid',
              members: ['member-uid'],
            }),
          }),
          collection: jest.fn().mockReturnValue({
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

      await request(app.getHttpServer())
        .get(`/ads?businessId=${businessId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
    });
  });

  describe('Input Validation', () => {
    it('should reject invalid UUID for businessId', async () => {
      const response = await request(app.getHttpServer())
        .post('/ads')
        .set('Authorization', 'Bearer mock-token')
        .send({
          businessId: 'not-a-uuid',
          prompt: 'Test prompt',
          productName: 'Test Product',
          platform: 'tiktok',
          aspectRatio: '9:16',
        })
        .expect(400);

      expect(response.body.message).toContain('businessId');
    });

    it('should reject prompt exceeding max length', async () => {
      const longPrompt = 'a'.repeat(2001);

      const response = await request(app.getHttpServer())
        .post('/ads')
        .set('Authorization', 'Bearer mock-token')
        .send({
          businessId: '123e4567-e89b-12d3-a456-426614174000',
          prompt: longPrompt,
          productName: 'Test Product',
          platform: 'tiktok',
          aspectRatio: '9:16',
        })
        .expect(400);

      expect(response.body.message).toContain('prompt');
    });

    it('should reject invalid platform enum', async () => {
      const response = await request(app.getHttpServer())
        .post('/ads')
        .set('Authorization', 'Bearer mock-token')
        .send({
          businessId: '123e4567-e89b-12d3-a456-426614174000',
          prompt: 'Test prompt',
          productName: 'Test Product',
          platform: 'invalid-platform',
          aspectRatio: '9:16',
        })
        .expect(400);

      expect(response.body.message).toContain('platform');
    });

    it('should strip unknown properties', async () => {
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
                exists: false,
              }),
            }),
          }),
        }),
      });

      mockFirestore.runTransaction.mockImplementation(async (callback) => {
        const mockTransaction = {
          get: jest.fn().mockResolvedValue({
            exists: false,
          }),
          set: jest.fn(),
          update: jest.fn(),
        };
        return callback(mockTransaction);
      });

      await request(app.getHttpServer())
        .post('/ads')
        .set('Authorization', 'Bearer mock-token')
        .send({
          businessId: '123e4567-e89b-12d3-a456-426614174000',
          prompt: 'Test prompt',
          productName: 'Test Product',
          platform: 'tiktok',
          aspectRatio: '9:16',
          maliciousField: 'should be stripped',
        })
        .expect(201);
    });

    it('should prevent SQL injection attempts', async () => {
      const response = await request(app.getHttpServer())
        .get('/ads')
        .query({ businessId: "'; DROP TABLE businesses--" })
        .set('Authorization', 'Bearer mock-token')
        .expect(400);

      expect(response.body.message).toContain('businessId');
    });
  });

  describe('Rate Limiting', () => {
    it('should block requests exceeding rate limit', async () => {
      const businessId = '123e4567-e89b-12d3-a456-426614174000';
      const token = 'Bearer mock-token';

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
                  requests: 10, // Already at limit
                  windowStart: new Date(),
                }),
              }),
              set: jest.fn(),
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

      const response = await request(app.getHttpServer())
        .get(`/ads?businessId=${businessId}`)
        .set('Authorization', token)
        .expect(429);

      expect(response.body.message).toContain('Rate limit exceeded');
      expect(response.headers['retry-after']).toBeDefined();
    });

    it('should include rate limit headers in response', async () => {
      const businessId = '123e4567-e89b-12d3-a456-426614174000';

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
                  requests: 5,
                  windowStart: new Date(),
                }),
              }),
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

      const response = await request(app.getHttpServer())
        .get(`/ads?businessId=${businessId}`)
        .set('Authorization', 'Bearer mock-token')
        .expect(200);

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });
  });

  describe('Race Condition Prevention', () => {
    it('should not exceed quota with concurrent requests', async () => {
      const businessId = '123e4567-e89b-12d3-a456-426614174000';
      let transactionCount = 0;

      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              ownerId: 'owner-uid',
              subscription: { tier: 'free' }, // 2 videos max
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

      // Simulate atomic transaction
      mockFirestore.runTransaction.mockImplementation(async (callback) => {
        const currentCount = transactionCount;

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
          transactionCount++;
        }

        return result;
      });

      // Make 3 concurrent requests (should only allow 2)
      const requests = Array(3)
        .fill(null)
        .map(() =>
          request(app.getHttpServer())
            .post('/ads')
            .set('Authorization', 'Bearer mock-token')
            .send({
              businessId,
              prompt: 'Test',
              productName: 'Test',
              platform: 'tiktok',
              aspectRatio: '9:16',
            }),
        );

      const responses = await Promise.all(requests);

      const successCount = responses.filter((r) => r.status === 201).length;
      const quotaExceededCount = responses.filter(
        (r) => r.status === 402,
      ).length;

      expect(successCount).toBeLessThanOrEqual(2);
      expect(quotaExceededCount).toBeGreaterThan(0);
    });
  });
});
