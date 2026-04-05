import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { FirestoreService } from '../firebase/firestore.service';

interface RequestWithUser {
  user?: { uid: string };
  headers?: { 'x-business-id'?: string | string[] };
  params?: { businessId?: string };
  query?: { businessId?: string };
  body?: { businessId?: string };
}

/**
 * Guard to prevent IDOR (Insecure Direct Object References) attacks.
 * Verifies that the authenticated user is a member of the business they're trying to access.
 */
@Injectable()
export class BusinessOwnershipGuard implements CanActivate {
  constructor(private readonly firestore: FirestoreService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Extract businessId from header, params, or query (NOT body to prevent IDOR)
    // Body businessId is validated by DTO but not used for authorization
    let businessId =
      request.headers?.['x-business-id'] ||
      request.params?.businessId ||
      request.query?.businessId;

    // Normalize array values (query params and headers can be arrays)
    if (Array.isArray(businessId)) {
      businessId = businessId[0];
    }

    if (!businessId || typeof businessId !== 'string') {
      throw new ForbiddenException('Business ID required');
    }

    // Verify all provided businessId sources match (prevent IDOR via mismatched IDs)
    // Normalize each source to string before comparing (headers/query can be arrays)
    const sources = [
      request.headers?.['x-business-id'],
      request.params?.businessId,
      request.query?.businessId,
    ]
      .filter((id) => id !== undefined)
      .map((id) => (Array.isArray(id) ? id[0] : id));

    if (sources.length > 1 && !sources.every((id) => id === businessId)) {
      throw new ForbiddenException(
        'Business ID mismatch across request sources',
      );
    }

    // Check if user is a member of the business
    const memberDoc = await this.firestore
      .collection('businesses')
      .doc(businessId)
      .collection('members')
      .doc(user.uid)
      .get();

    if (!memberDoc.exists) {
      throw new ForbiddenException(
        'Access denied: You are not a member of this business',
      );
    }

    return true;
  }
}
