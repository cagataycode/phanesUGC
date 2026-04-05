/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { FirestoreService } from '../src/firebase/firestore.service';

interface ResponseBody {
  message?: string;
  [key: string]: unknown;
}

describe('Security Tests (e2e)', () => {
  let app: INestApplication;

  // Mock Firestore
  const mockFirestore = {
    collection: jest.fn(),
    doc: jest.fn(),
    runTransaction: jest.fn(),
  };

  const mockCollectionRef = {
    doc: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    get: jest.fn(),
    add: jest.fn(),
  };

  const mockDocRef = {
    get: jest.fn(),
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    collection: jest.fn(),
  };

  const mockQuerySnapshot = {
    empty: false,
    size: 1,
    docs: [],
    forEach: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(FirestoreService)
      .useValue({
        getFirestore: () => mockFirestore,
        collection: jest.fn(() => mockCollectionRef),
      })
      .compile();

    app = moduleFixture.createNestApplication();

    // Enable validation pipe (same as main.ts)
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: false,
        },
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockFirestore.collection.mockReturnValue(mockCollectionRef);
    mockFirestore.doc.mockReturnValue(mockDocRef);
    mockCollectionRef.doc.mockReturnValue(mockDocRef);
    mockCollectionRef.where.mockReturnThis();
    mockCollectionRef.orderBy.mockReturnThis();
    mockCollectionRef.limit.mockReturnThis();
    mockCollectionRef.get.mockResolvedValue(mockQuerySnapshot);
    mockDocRef.collection.mockReturnValue(mockCollectionRef);
  });

  describe('IDOR Protection (BusinessOwnershipGuard)', () => {
    const validToken = 'valid-firebase-token';
    const userAId = 'user-a-uid';
    const businessAId = 'business-a-id';
    const businessBId = 'business-b-id';

    it('should deny access when user tries to access another business', async () => {
      // Mock: User A is NOT a member of Business B
      mockDocRef.get.mockResolvedValue({
        exists: false,
        data: () => null,
      });

      const response = (await request(app.getHttpServer())
        .get(`/api/ads?businessId=${businessBId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(403)) as unknown as { body: ResponseBody };

      expect(response.body.message).toContain(
        'Access denied: You are not a member of this business',
      );
    });

    it('should allow access when user is a member of the business', async () => {
      // Mock: User A IS a member of Business A
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({ role: 'owner', userId: userAId }),
      });

      // Mock the ads list response
      mockQuerySnapshot.docs = [];

      await request(app.getHttpServer())
        .get(`/api/ads?businessId=${businessAId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);
    });

    it('should reject request without businessId', async () => {
      await request(app.getHttpServer())
        .get('/api/ads')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(403);
    });

    it('should check membership for POST requests', async () => {
      // Mock: User is NOT a member
      mockDocRef.get.mockResolvedValue({
        exists: false,
        data: () => null,
      });

      const validPayload = {
        businessId: businessBId,
        productId: '123e4567-e89b-12d3-a456-426614174000',
        createdBy: userAId,
        prompt_inputs: {
          prompt: 'Test prompt',
          platform: 'tiktok',
          language: 'en',
        },
        veo_config: {
          aspect_ratio: '9:16',
          duration_sec: 8,
        },
      };

      await request(app.getHttpServer())
        .post('/api/ads')
        .set('Authorization', `Bearer ${validToken}`)
        .send(validPayload)
        .expect(403);
    });
  });

  describe('Input Validation', () => {
    const validToken = 'valid-firebase-token';
    const businessId = '123e4567-e89b-12d3-a456-426614174000';
    const productId = '123e4567-e89b-12d3-a456-426614174001';

    beforeEach(() => {
      // Mock: User is a member
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({ role: 'owner' }),
      });
    });

    it('should reject invalid UUID for businessId', async () => {
      const invalidPayload = {
        businessId: 'not-a-uuid',
        productId,
        createdBy: 'user-123',
        prompt_inputs: {
          prompt: 'Test',
          platform: 'tiktok',
          language: 'en',
        },
        veo_config: {
          aspect_ratio: '9:16',
          duration_sec: 8,
        },
      };

      const response = (await request(app.getHttpServer())
        .post('/api/ads')
        .set('Authorization', `Bearer ${validToken}`)
        .send(invalidPayload)
        .expect(400)) as unknown as { body: ResponseBody };

      expect(response.body.message).toContain(
        'Business ID must be a valid UUID',
      );
    });

    it('should reject prompt exceeding 2000 characters', async () => {
      const longPrompt = 'a'.repeat(2001);

      const invalidPayload = {
        businessId,
        productId,
        createdBy: 'user-123',
        prompt_inputs: {
          prompt: longPrompt,
          platform: 'tiktok',
          language: 'en',
        },
        veo_config: {
          aspect_ratio: '9:16',
          duration_sec: 8,
        },
      };

      const response = (await request(app.getHttpServer())
        .post('/api/ads')
        .set('Authorization', `Bearer ${validToken}`)
        .send(invalidPayload)
        .expect(400)) as unknown as { body: ResponseBody };

      expect(response.body.message).toContain(
        'Prompt must not exceed 2000 characters',
      );
    });

    it('should reject invalid platform enum', async () => {
      const invalidPayload = {
        businessId,
        productId,
        createdBy: 'user-123',
        prompt_inputs: {
          prompt: 'Test',
          platform: 'facebook', // Invalid
          language: 'en',
        },
        veo_config: {
          aspect_ratio: '9:16',
          duration_sec: 8,
        },
      };

      const response = (await request(app.getHttpServer())
        .post('/api/ads')
        .set('Authorization', `Bearer ${validToken}`)
        .send(invalidPayload)
        .expect(400)) as unknown as { body: ResponseBody };

      expect(response.body.message).toContain('Platform must be one of');
    });

    it('should reject invalid aspect ratio', async () => {
      const invalidPayload = {
        businessId,
        productId,
        createdBy: 'user-123',
        prompt_inputs: {
          prompt: 'Test',
          platform: 'tiktok',
          language: 'en',
        },
        veo_config: {
          aspect_ratio: '4:3', // Invalid
          duration_sec: 8,
        },
      };

      const response = (await request(app.getHttpServer())
        .post('/api/ads')
        .set('Authorization', `Bearer ${validToken}`)
        .send(invalidPayload)
        .expect(400)) as unknown as { body: ResponseBody };

      expect(response.body.message).toContain('Aspect ratio must be one of');
    });

    it('should reject duration outside valid range', async () => {
      const invalidPayload = {
        businessId,
        productId,
        createdBy: 'user-123',
        prompt_inputs: {
          prompt: 'Test',
          platform: 'tiktok',
          language: 'en',
        },
        veo_config: {
          aspect_ratio: '9:16',
          duration_sec: 15, // Too long
        },
      };

      const response = (await request(app.getHttpServer())
        .post('/api/ads')
        .set('Authorization', `Bearer ${validToken}`)
        .send(invalidPayload)
        .expect(400)) as unknown as { body: ResponseBody };

      expect(response.body.message).toContain('duration_sec');
    });

    it('should reject invalid URL format', async () => {
      const invalidPayload = {
        businessId,
        productId,
        createdBy: 'user-123',
        prompt_inputs: {
          prompt: 'Test',
          platform: 'tiktok',
          language: 'en',
          urls: ['not-a-url', 'also-not-a-url'],
        },
        veo_config: {
          aspect_ratio: '9:16',
          duration_sec: 8,
        },
      };

      const response = (await request(app.getHttpServer())
        .post('/api/ads')
        .set('Authorization', `Bearer ${validToken}`)
        .send(invalidPayload)
        .expect(400)) as unknown as { body: ResponseBody };

      expect(response.body.message).toContain('url');
    });

    it('should reject too many URLs', async () => {
      const tooManyUrls = Array(11)
        .fill(0)
        .map((_, i) => `https://example.com/${i}`);

      const invalidPayload = {
        businessId,
        productId,
        createdBy: 'user-123',
        prompt_inputs: {
          prompt: 'Test',
          platform: 'tiktok',
          language: 'en',
          urls: tooManyUrls,
        },
        veo_config: {
          aspect_ratio: '9:16',
          duration_sec: 8,
        },
      };

      const response = (await request(app.getHttpServer())
        .post('/api/ads')
        .set('Authorization', `Bearer ${validToken}`)
        .send(invalidPayload)
        .expect(400)) as unknown as { body: ResponseBody };

      expect(response.body.message).toContain('urls');
    });

    it('should strip unknown properties (whitelist)', async () => {
      const payloadWithExtra = {
        businessId,
        productId,
        createdBy: 'user-123',
        maliciousField: '<script>alert("xss")</script>', // Should be stripped
        prompt_inputs: {
          prompt: 'Test',
          platform: 'tiktok',
          language: 'en',
          anotherBadField: 'DROP TABLE users;', // Should be stripped
        },
        veo_config: {
          aspect_ratio: '9:16',
          duration_sec: 8,
        },
      };

      // Mock successful creation
      mockDocRef.set.mockResolvedValue(undefined);
      mockCollectionRef.add.mockResolvedValue({
        id: 'job-123',
      });

      // Should succeed because unknown fields are stripped
      await request(app.getHttpServer())
        .post('/api/ads')
        .set('Authorization', `Bearer ${validToken}`)
        .send(payloadWithExtra)
        .expect(201);
    });

    it('should accept valid payload', async () => {
      const validPayload = {
        businessId,
        productId,
        createdBy: 'user-123',
        prompt_inputs: {
          prompt: 'Create an engaging ad for my product',
          platform: 'tiktok',
          language: 'en',
          tone: 'energetic',
          target_audience: 'Young adults 18-25',
          cta: 'Shop now',
          product_info: {
            name: 'Amazing Product',
            description: 'The best product ever',
            benefits: ['Fast', 'Reliable', 'Affordable'],
          },
          urls: ['https://example.com/product'],
          subtitle_style: 'kinetic',
        },
        veo_config: {
          aspect_ratio: '9:16',
          duration_sec: 8,
          negative_prompt: 'blurry, low quality',
          person_generation: 'allow_all',
          enhance_prompt: true,
        },
      };

      // Mock successful creation
      mockDocRef.set.mockResolvedValue(undefined);
      mockCollectionRef.add.mockResolvedValue({
        id: 'job-123',
      });

      await request(app.getHttpServer())
        .post('/api/ads')
        .set('Authorization', `Bearer ${validToken}`)
        .send(validPayload)
        .expect(201);
    });
  });

  describe('XSS Prevention', () => {
    const validToken = 'valid-firebase-token';
    const businessId = '123e4567-e89b-12d3-a456-426614174000';
    const productId = '123e4567-e89b-12d3-a456-426614174001';

    beforeEach(() => {
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({ role: 'owner' }),
      });
    });

    it('should accept payload with HTML-like content (validation only checks length)', async () => {
      const xssPayload = {
        businessId,
        productId,
        createdBy: 'user-123',
        prompt_inputs: {
          prompt: '<script>alert("xss")</script>',
          platform: 'tiktok',
          language: 'en',
        },
        veo_config: {
          aspect_ratio: '9:16',
          duration_sec: 8,
        },
      };

      // Mock successful creation
      mockDocRef.set.mockResolvedValue(undefined);
      mockCollectionRef.add.mockResolvedValue({
        id: 'job-123',
      });

      // Should succeed - validation doesn't sanitize, just validates format
      // XSS prevention happens at rendering layer
      await request(app.getHttpServer())
        .post('/api/ads')
        .set('Authorization', `Bearer ${validToken}`)
        .send(xssPayload)
        .expect(201);
    });
  });

  describe('SQL Injection Prevention', () => {
    const validToken = 'valid-firebase-token';
    const businessId = '123e4567-e89b-12d3-a456-426614174000';
    const productId = '123e4567-e89b-12d3-a456-426614174001';

    beforeEach(() => {
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({ role: 'owner' }),
      });
    });

    it('should accept SQL-like strings in prompt (NoSQL database)', async () => {
      const sqlPayload = {
        businessId,
        productId,
        createdBy: 'user-123',
        prompt_inputs: {
          prompt: "'; DROP TABLE users; --",
          platform: 'tiktok',
          language: 'en',
        },
        veo_config: {
          aspect_ratio: '9:16',
          duration_sec: 8,
        },
      };

      // Mock successful creation
      mockDocRef.set.mockResolvedValue(undefined);
      mockCollectionRef.add.mockResolvedValue({
        id: 'job-123',
      });

      // Should succeed - Firestore is NoSQL, not vulnerable to SQL injection
      await request(app.getHttpServer())
        .post('/api/ads')
        .set('Authorization', `Bearer ${validToken}`)
        .send(sqlPayload)
        .expect(201);
    });
  });
});
