jest.mock('firebase-admin', () => {
  const verifyIdTokenMock = jest.fn();
  return {
    auth: jest.fn(() => ({
      verifyIdToken: verifyIdTokenMock,
    })),
  };
});

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Controller, Get, UseGuards } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthModule } from '../src/auth/auth.module';
import { FirebaseAuthGuard } from '../src/auth/firebase-auth.guard';
import { GetUser } from '../src/auth/get-user.decorator';
import type { DecodedIdToken } from 'firebase-admin/auth';
import * as admin from 'firebase-admin';

// Interface for response bodies to fix unsafe member access lint errors
interface TestAuthResponse {
  message?: string;
  success?: boolean;
  user?: DecodedIdToken;
}

// Create a dummy controller to test the guard and decorator
@Controller('test-auth')
class TestAuthController {
  @Get('protected')
  @UseGuards(FirebaseAuthGuard)
  getProtectedData(@GetUser() user: DecodedIdToken) {
    return { success: true, user };
  }
}

describe('Authentication Layer (e2e)', () => {
  let app: INestApplication<App>;
  let verifyIdTokenMock: jest.Mock;

  beforeAll(() => {
    // Accessing through bracket notation to bypass unbound-method lint rule
    const authInstance = admin.auth();
    verifyIdTokenMock = authInstance['verifyIdToken'] as unknown as jest.Mock;
  });

  beforeEach(async () => {
    verifyIdTokenMock.mockClear();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AuthModule],
      controllers: [TestAuthController],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await app.close();
  });

  it('should reject request without authorization header (401)', () => {
    return request(app.getHttpServer())
      .get('/test-auth/protected')
      .expect(401)
      .expect((res: { body: TestAuthResponse }) => {
        expect(res.body.message).toEqual(
          'Missing or invalid authorization header',
        );
      });
  });

  it('should reject request with improperly formatted header (401)', () => {
    return request(app.getHttpServer())
      .get('/test-auth/protected')
      .set('Authorization', 'InvalidFormat TokenHere')
      .expect(401)
      .expect((res: { body: TestAuthResponse }) => {
        expect(res.body.message).toEqual(
          'Missing or invalid authorization header',
        );
      });
  });

  it('should reject request if token is invalid (401)', () => {
    // Mock verification to throw an error
    verifyIdTokenMock.mockRejectedValueOnce(new Error('Invalid token'));

    return request(app.getHttpServer())
      .get('/test-auth/protected')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401)
      .expect((res: { body: TestAuthResponse }) => {
        expect(res.body.message).toEqual('Unauthorized access');
      });
  });

  it('should allow request and extract user data if token is valid (200)', () => {
    const mockDecodedToken = {
      uid: 'user-123',
      email: 'test@example.com',
      aud: 'project-id',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      iss: 'https://securetoken.google.com/project-id',
      sub: 'user-123',
    } as DecodedIdToken;

    // Mock verification to succeed and return the token
    verifyIdTokenMock.mockResolvedValueOnce(mockDecodedToken);

    return request(app.getHttpServer())
      .get('/test-auth/protected')
      .set('Authorization', 'Bearer valid-token')
      .expect(200)
      .expect((res: { body: TestAuthResponse }) => {
        expect(res.body.success).toBe(true);
        expect(res.body.user).toEqual(mockDecodedToken);
      });
  });
});
