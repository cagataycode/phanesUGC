/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import * as admin from 'firebase-admin';

// Mock firebase-admin
jest.mock('firebase-admin', () => {
  const verifyIdTokenMock = jest.fn();
  const docGetMock = jest.fn();
  const docSetMock = jest.fn();
  const batchSetMock = jest.fn();
  const batchCommitMock = jest.fn();

  const docMock = jest.fn(() => ({
    get: docGetMock,
    set: docSetMock,
  }));

  const collectionMock = jest.fn(() => ({
    doc: docMock,
  }));

  const batchMock = jest.fn(() => ({
    set: batchSetMock,
    commit: batchCommitMock,
  }));

  return {
    auth: jest.fn(() => ({
      verifyIdToken: verifyIdTokenMock,
    })),
    firestore: Object.assign(
      jest.fn(() => ({
        doc: docMock,
        collection: collectionMock,
        batch: batchMock,
        settings: jest.fn(),
      })),
      {
        FieldValue: {
          serverTimestamp: jest.fn(() => 'mock-timestamp'),
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

describe('Users / Me (e2e)', () => {
  let app: INestApplication<App>;
  let verifyIdTokenMock: jest.Mock;
  let docGetMock: jest.Mock;
  let batchSetMock: jest.Mock;
  let batchCommitMock: jest.Mock;

  beforeAll(() => {
    verifyIdTokenMock = admin.auth()['verifyIdToken'] as unknown as jest.Mock;
    const db = admin.firestore();
    docGetMock = db.doc('any')['get'] as unknown as jest.Mock;
    batchSetMock = db.batch()['set'] as unknown as jest.Mock;
    batchCommitMock = db.batch()['commit'] as unknown as jest.Mock;
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/v1/me (GET) - should provision a new user and workspace if they do not exist', async () => {
    const mockUid = 'new-user-123';
    const mockEmail = 'new@example.com';

    // 1. Mock valid token
    verifyIdTokenMock.mockResolvedValueOnce({
      uid: mockUid,
      email: mockEmail,
    });

    // 2. Mock Firestore user NOT existing
    docGetMock.mockResolvedValueOnce({
      exists: false,
    });

    // 3. Mock batch commit success
    batchCommitMock.mockResolvedValueOnce(null);

    const response = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(response.body.platform_ready).toBe(true);
    expect(response.body.profile.uid).toBe(mockUid);
    expect(response.body.platform_context.user_id).toBe(mockUid);

    // Verify provisioning logic was triggered
    expect(docGetMock).toHaveBeenCalled();
    expect(batchSetMock).toHaveBeenCalledTimes(3); // User, Business, Membership
    expect(batchCommitMock).toHaveBeenCalled();
  });

  it('/api/v1/me (GET) - should return existing user data if they already exist', async () => {
    const mockUid = 'existing-user-456';
    const mockEmail = 'existing@example.com';
    const mockBizId = 'biz-789';

    const existingUser = {
      uid: mockUid,
      email: mockEmail,
      defaultBusinessId: mockBizId,
    };

    // 1. Mock valid token
    verifyIdTokenMock.mockResolvedValueOnce({
      uid: mockUid,
      email: mockEmail,
    });

    // 2. Mock Firestore user EXISTING
    docGetMock.mockResolvedValueOnce({
      exists: true,
      data: () => existingUser,
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(response.body.profile.uid).toBe(mockUid);
    expect(response.body.platform_context.account_id).toBe(mockBizId);

    // Verify no provisioning was done
    expect(batchCommitMock).not.toHaveBeenCalled();
  });

  it('/api/v1/me (GET) - should return 401 if unauthorized', () => {
    return request(app.getHttpServer()).get('/api/v1/me').expect(401);
  });
});
