import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { FirestoreService } from '../firebase/firestore.service';

interface RequestWithUser {
  user?: { uid: string };
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

    // Extract businessId from params, query, or body
    const businessId =
      request.params?.businessId ||
      request.query?.businessId ||
      request.body?.businessId;

    if (!businessId) {
      throw new ForbiddenException('Business ID required');
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
