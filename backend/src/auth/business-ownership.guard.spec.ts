/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/unbound-method */
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { BusinessOwnershipGuard } from './business-ownership.guard';
import { FirestoreService } from '../firebase/firestore.service';

describe('BusinessOwnershipGuard', () => {
  let guard: BusinessOwnershipGuard;
  let firestoreService: jest.Mocked<FirestoreService>;

  const mockDocRef = {
    get: jest.fn(),
  };

  const mockCollectionRef = {
    doc: jest.fn(() => mockDocRef),
  };

  const mockSubCollectionRef = {
    doc: jest.fn(() => mockDocRef),
  };

  const mockBusinessDocRef = {
    collection: jest.fn(() => mockSubCollectionRef),
  };

  beforeEach(() => {
    firestoreService = {
      collection: jest.fn(() => mockCollectionRef),
    } as unknown as jest.Mocked<FirestoreService>;

    guard = new BusinessOwnershipGuard(firestoreService);

    jest.clearAllMocks();
    mockCollectionRef.doc.mockReturnValue(mockBusinessDocRef);
    mockBusinessDocRef.collection.mockReturnValue(mockSubCollectionRef);
    mockSubCollectionRef.doc.mockReturnValue(mockDocRef);
  });

  const createMockContext = (
    user: any,
    params: any = {},
    query: any = {},
    body: any = {},
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          params,
          query,
          body,
        }),
      }),
    } as ExecutionContext;
  };

  describe('canActivate', () => {
    it('should throw ForbiddenException if user is not authenticated', async () => {
      const context = createMockContext(null);

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('Authentication required'),
      );
    });

    it('should throw ForbiddenException if businessId is missing', async () => {
      const context = createMockContext({ uid: 'user-123' });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('Business ID required'),
      );
    });

    it('should throw ForbiddenException if user is not a member', async () => {
      const context = createMockContext(
        { uid: 'user-123' },
        {},
        { businessId: 'business-456' },
      );

      mockDocRef.get.mockResolvedValue({
        exists: false,
        data: () => null,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException(
          'Access denied: You are not a member of this business',
        ),
      );

      expect(firestoreService.collection).toHaveBeenCalledWith('businesses');
      expect(mockCollectionRef.doc).toHaveBeenCalledWith('business-456');
      expect(mockBusinessDocRef.collection).toHaveBeenCalledWith('members');
      expect(mockSubCollectionRef.doc).toHaveBeenCalledWith('user-123');
    });

    it('should allow access if user is a member', async () => {
      const context = createMockContext(
        { uid: 'user-123' },
        {},
        { businessId: 'business-456' },
      );

      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({ role: 'owner', userId: 'user-123' }),
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(firestoreService.collection).toHaveBeenCalledWith('businesses');
    });

    it('should extract businessId from params', async () => {
      const context = createMockContext(
        { uid: 'user-123' },
        { businessId: 'business-from-params' },
      );

      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({ role: 'admin' }),
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockCollectionRef.doc).toHaveBeenCalledWith(
        'business-from-params',
      );
    });

    it('should extract businessId from query', async () => {
      const context = createMockContext(
        { uid: 'user-123' },
        {},
        { businessId: 'business-from-query' },
      );

      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({ role: 'member' }),
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockCollectionRef.doc).toHaveBeenCalledWith('business-from-query');
    });

    it('should NOT extract businessId from body (IDOR prevention)', async () => {
      const context = createMockContext(
        { uid: 'user-123' },
        {},
        {},
        { businessId: 'business-from-body' },
      );

      // Body businessId should be ignored for authorization
      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('Business ID required'),
      );
    });

    it('should prioritize params over query when both match', async () => {
      const context = createMockContext(
        { uid: 'user-123' },
        { businessId: 'same-business-id' },
        { businessId: 'same-business-id' },
      );

      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({ role: 'owner' }),
      });

      await guard.canActivate(context);

      expect(mockCollectionRef.doc).toHaveBeenCalledWith('same-business-id');
    });

    it('should throw if businessId sources mismatch', async () => {
      const context = createMockContext(
        { uid: 'user-123' },
        { businessId: 'from-params' },
        { businessId: 'from-query-different' },
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('Business ID mismatch across request sources'),
      );
    });
  });
});
