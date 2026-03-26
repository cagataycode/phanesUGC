/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Controller, Get, UseGuards } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthModule } from '../src/auth/auth.module';
import { FirebaseAuthGuard } from '../src/auth/firebase-auth.guard';
import { RolesGuard } from '../src/auth/roles.guard';
import { Roles } from '../src/auth/roles.decorator';
import { UserRole } from '../src/auth/roles.enum';
import { FirestoreService } from '../src/firebase/firestore.service';
import * as admin from 'firebase-admin';

// Create a dummy controller to test the RolesGuard
@Controller('test-roles')
@UseGuards(FirebaseAuthGuard, RolesGuard)
class TestRolesController {
  @Get('public')
  getPublic() {
    return { success: true, message: 'Public access' };
  }

  @Get('admin-only')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  getAdminOnly() {
    return { success: true, message: 'Admin access' };
  }

  @Get('member-only')
  @Roles(UserRole.MEMBER, UserRole.ADMIN, UserRole.OWNER)
  getMemberOnly() {
    return { success: true, message: 'Member access' };
  }
}

// Mock firebase-admin
jest.mock('firebase-admin', () => {
  const verifyIdTokenMock = jest.fn();
  const docGetMock = jest.fn();

  const docMock = jest.fn(() => ({
    get: docGetMock,
  }));

  return {
    auth: jest.fn(() => ({
      verifyIdToken: verifyIdTokenMock,
    })),
    firestore: Object.assign(
      jest.fn(() => ({
        doc: docMock,
      })),
      {
        FieldValue: {
          serverTimestamp: jest.fn(),
        },
      },
    ),
    credential: {
      cert: jest.fn(),
    },
    apps: [],
    initializeApp: jest.fn(),
  };
});

describe('RBAC RolesGuard (e2e)', () => {
  let app: INestApplication<App>;
  let verifyIdTokenMock: jest.Mock;
  let docGetMock: jest.Mock;

  beforeAll(() => {
    verifyIdTokenMock = admin.auth()['verifyIdToken'] as unknown as jest.Mock;
    const db = admin.firestore();
    docGetMock = db.doc('any')['get'] as unknown as jest.Mock;
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AuthModule],
      controllers: [TestRolesController],
    })
      .overrideProvider(FirestoreService)
      .useValue({
        getFirestore: jest.fn(() => admin.firestore()),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  const validToken = { uid: 'user-123', email: 'user@example.com' };

  it('should allow access to unprotected routes even if businessId is missing', () => {
    verifyIdTokenMock.mockResolvedValueOnce(validToken);

    return request(app.getHttpServer())
      .get('/test-roles/public')
      .set('Authorization', 'Bearer valid-token')
      .expect(200)
      .expect((res: { body: { success: boolean } }) => {
        expect(res.body.success).toBe(true);
      });
  });

  it('should deny access if businessId is missing on a protected route (403)', () => {
    verifyIdTokenMock.mockResolvedValueOnce(validToken);

    return (
      request(app.getHttpServer())
        .get('/test-roles/admin-only')
        .set('Authorization', 'Bearer valid-token')
        // Intentionally missing 'x-business-id' header
        .expect(403)
        .expect((res: { body: { message: string } }) => {
          expect(res.body.message).toEqual(
            'Business ID is required for role-based access',
          );
        })
    );
  });

  it('should deny access if user is not a member of the business (403)', async () => {
    verifyIdTokenMock.mockResolvedValueOnce(validToken);

    // Mock membership document NOT existing
    docGetMock.mockResolvedValueOnce({
      exists: false,
    });

    const response = await request(app.getHttpServer())
      .get('/test-roles/admin-only')
      .set('Authorization', 'Bearer valid-token')
      .set('x-business-id', 'biz-456')
      .expect(403);

    expect(response.body.message).toEqual(
      'You are not a member of this business',
    );

    // Verify it checked the correct document path
    const db = admin.firestore();
    expect(db['doc']).toHaveBeenCalledWith(
      'businesses/biz-456/members/user-123',
    );
  });

  it('should deny access if user has insufficient permissions (403)', () => {
    verifyIdTokenMock.mockResolvedValueOnce(validToken);

    // Mock membership document EXISTING but with wrong role ('member' trying to access 'admin')
    docGetMock.mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: UserRole.MEMBER }),
    });

    return request(app.getHttpServer())
      .get('/test-roles/admin-only')
      .set('Authorization', 'Bearer valid-token')
      .set('x-business-id', 'biz-456')
      .expect(403)
      .expect((res: { body: { message: string } }) => {
        expect(res.body.message).toEqual('Insufficient permissions');
      });
  });

  it('should allow access if user has the correct role (200)', () => {
    verifyIdTokenMock.mockResolvedValueOnce(validToken);

    // Mock membership document EXISTING with correct role
    docGetMock.mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: UserRole.ADMIN }),
    });

    return request(app.getHttpServer())
      .get('/test-roles/admin-only')
      .set('Authorization', 'Bearer valid-token')
      .set('x-business-id', 'biz-456')
      .expect(200)
      .expect((res: { body: { success: boolean } }) => {
        expect(res.body.success).toBe(true);
      });
  });

  it('should resolve businessId from query parameters', () => {
    verifyIdTokenMock.mockResolvedValueOnce(validToken);

    docGetMock.mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: UserRole.OWNER }),
    });

    return request(app.getHttpServer())
      .get('/test-roles/admin-only?businessId=biz-query-789')
      .set('Authorization', 'Bearer valid-token')
      .expect(200)
      .expect((res: { body: { success: boolean } }) => {
        expect(res.body.success).toBe(true);
        const db = admin.firestore();
        expect(db['doc']).toHaveBeenCalledWith(
          'businesses/biz-query-789/members/user-123',
        );
      });
  });
});
