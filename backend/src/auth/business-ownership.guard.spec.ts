import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { BusinessOwnershipGuard } from './business-ownership.guard';
import { FirestoreService } from '../firebase/firestore.service';
import { AuthenticatedRequest } from './firebase-auth.guard';

/* eslint-disable @typescript-eslint/no-unsafe-assignment */

describe('BusinessOwnershipGuard', () => {
  let guard: BusinessOwnershipGuard;

  const mockFirestore = {
    doc: jest.fn(),
  };

  const mockDocRef = {
    get: jest.fn(),
  };

  const mockDocSnap = {
    exists: true,
    data: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessOwnershipGuard,
        {
          provide: FirestoreService,
          useValue: {
            getFirestore: jest.fn(() => mockFirestore),
          },
        },
      ],
    }).compile();

    guard = module.get<BusinessOwnershipGuard>(BusinessOwnershipGuard);
    firestoreService = module.get(FirestoreService);

    // Reset mocks
    jest.clearAllMocks();
    mockFirestore.doc.mockReturnValue(mockDocRef);
    mockDocRef.get.mockResolvedValue(mockDocSnap);
  });

  const createMockExecutionContext = (
    request: Partial<AuthenticatedRequest>,
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: jest.fn(),
        getNext: jest.fn(),
      }),
      getClass: jest.fn(),
      getHandler: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    } as ExecutionContext;
  };

  describe('canActivate', () => {
    it('should allow access when user is a member of the business', async () => {
      const context = createMockExecutionContext({
        user: { uid: 'user-123' } as unknown as any,
        query: { businessId: 'business-456' },
        params: {},
        body: {},
        headers: {},
      } as AuthenticatedRequest);

      mockDocSnap.exists = true;

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockFirestore.doc).toHaveBeenCalledWith(
        'businesses/business-456/members/user-123',
      );
      expect(mockDocRef.get).toHaveBeenCalled();
    });

    it('should deny access when user is not a member', async () => {
      const context = createMockExecutionContext({
        user: { uid: 'user-123' } as unknown as any,
        query: { businessId: 'business-456' },
        params: {},
        body: {},
        headers: {},
      } as AuthenticatedRequest);

      mockDocSnap.exists = false;

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Access denied: You are not a member of this business',
      );
    });

    it('should throw ForbiddenException when no user is authenticated', async () => {
      const context = createMockExecutionContext({
        user: undefined,
        query: { businessId: 'business-456' },
        params: {},
        body: {},
        headers: {},
      } as AuthenticatedRequest);

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Authentication required',
      );
    });

    it('should throw ForbiddenException when no businessId is provided', async () => {
      const context = createMockExecutionContext({
        user: { uid: 'user-123' } as any,
        query: {},
        params: {},
        body: {},
        headers: {},
      } as AuthenticatedRequest);

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Business ID is required',
      );
    });

    it('should extract businessId from headers', async () => {
      const context = createMockExecutionContext({
        user: { uid: 'user-123' } as unknown as any,
        headers: { 'x-business-id': 'business-from-header' },
        query: {},
        params: {},
        body: {},
      } as AuthenticatedRequest);

      mockDocSnap.exists = true;

      await guard.canActivate(context);

      expect(mockFirestore.doc).toHaveBeenCalledWith(
        'businesses/business-from-header/members/user-123',
      );
    });

    it('should extract businessId from query params', async () => {
      const context = createMockExecutionContext({
        user: { uid: 'user-123' } as unknown as any,
        query: { businessId: 'business-from-query' },
        params: {},
        body: {},
        headers: {},
      } as AuthenticatedRequest);

      mockDocSnap.exists = true;

      await guard.canActivate(context);

      expect(mockFirestore.doc).toHaveBeenCalledWith(
        'businesses/business-from-query/members/user-123',
      );
    });

    it('should extract businessId from route params', async () => {
      const context = createMockExecutionContext({
        user: { uid: 'user-123' } as unknown as any,
        params: { businessId: 'business-from-params' },
        query: {},
        body: {},
        headers: {},
      } as AuthenticatedRequest);

      mockDocSnap.exists = true;

      await guard.canActivate(context);

      expect(mockFirestore.doc).toHaveBeenCalledWith(
        'businesses/business-from-params/members/user-123',
      );
    });

    it('should extract businessId from request body', async () => {
      const context = createMockExecutionContext({
        user: { uid: 'user-123' } as unknown as any,
        body: { businessId: 'business-from-body' },
        query: {},
        params: {},
        headers: {},
      } as AuthenticatedRequest);

      mockDocSnap.exists = true;

      await guard.canActivate(context);

      expect(mockFirestore.doc).toHaveBeenCalledWith(
        'businesses/business-from-body/members/user-123',
      );
    });

    it('should prioritize header over query params', async () => {
      const context = createMockExecutionContext({
        user: { uid: 'user-123' } as unknown as any,
        headers: { 'x-business-id': 'business-from-header' },
        query: { businessId: 'business-from-query' },
        params: {},
        body: {},
      } as AuthenticatedRequest);

      mockDocSnap.exists = true;

      await guard.canActivate(context);

      expect(mockFirestore.doc).toHaveBeenCalledWith(
        'businesses/business-from-header/members/user-123',
      );
    });

    it('should handle array businessId values', async () => {
      const context = createMockExecutionContext({
        user: { uid: 'user-123' } as unknown as any,
        query: {
          businessId: ['business-1', 'business-2'] as unknown as string,
        },
        params: {},
        body: {},
        headers: {},
      } as AuthenticatedRequest);

      mockDocSnap.exists = true;

      await guard.canActivate(context);

      // Should use first element of array
      expect(mockFirestore.doc).toHaveBeenCalledWith(
        'businesses/business-1/members/user-123',
      );
    });

    it('should deny access on Firestore error (fail closed)', async () => {
      const context = createMockExecutionContext({
        user: { uid: 'user-123' } as unknown as any,
        query: { businessId: 'business-456' },
        params: {},
        body: {},
        headers: {},
      } as AuthenticatedRequest);

      mockDocRef.get.mockRejectedValue(new Error('Firestore error'));

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
