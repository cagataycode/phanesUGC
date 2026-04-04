import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { FirestoreService } from '../firebase/firestore.service';
import { AuthenticatedRequest } from './firebase-auth.guard';

/**
 * Guard that verifies the authenticated user has access to the requested business.
 * This prevents IDOR (Insecure Direct Object Reference) vulnerabilities by ensuring
 * users can only access businesses they are members of.
 *
 * The guard extracts businessId from:
 * 1. Request headers (x-business-id)
 * 2. Query parameters (businessId)
 * 3. Route parameters (businessId)
 * 4. Request body (businessId)
 *
 * @example
 * ```typescript
 * @Controller('ads')
 * @UseGuards(FirebaseAuthGuard, BusinessOwnershipGuard)
 * export class AdsController { ... }
 * ```
 */
@Injectable()
export class BusinessOwnershipGuard implements CanActivate {
  private readonly logger = new Logger(BusinessOwnershipGuard.name);

  constructor(private readonly firestore: FirestoreService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      this.logger.warn('No authenticated user found in request');
      throw new ForbiddenException('Authentication required');
    }

    // Extract businessId from multiple possible sources
    const businessId = this.extractBusinessId(request);

    if (!businessId) {
      this.logger.warn(`No businessId found in request for user ${user.uid}`);
      throw new ForbiddenException('Business ID is required');
    }

    // Verify user is a member of the business
    const isMember = await this.checkMembership(businessId, user.uid);

    if (!isMember) {
      this.logger.warn(
        `User ${user.uid} attempted to access business ${businessId} without membership`,
      );
      throw new ForbiddenException(
        'Access denied: You are not a member of this business',
      );
    }

    this.logger.debug(`User ${user.uid} authorized for business ${businessId}`);
    return true;
  }

  /**
   * Extract businessId from request in order of precedence:
   * 1. Headers (x-business-id)
   * 2. Query parameters (businessId)
   * 3. Route parameters (businessId)
   * 4. Request body (businessId)
   */
  private extractBusinessId(request: AuthenticatedRequest): string | null {
    // Check header
    const headerBusinessId = request.headers['x-business-id'];
    if (headerBusinessId) {
      const headerValue = Array.isArray(headerBusinessId)
        ? headerBusinessId[0]
        : String(headerBusinessId);
      return headerValue;
    }

    // Check query params
    const queryBusinessId = request.query.businessId;
    if (queryBusinessId && typeof queryBusinessId === 'string') {
      return queryBusinessId;
    }
    if (
      queryBusinessId &&
      Array.isArray(queryBusinessId) &&
      queryBusinessId[0] &&
      typeof queryBusinessId[0] === 'string'
    ) {
      return queryBusinessId[0];
    }

    // Check route params
    const paramBusinessId = request.params.businessId;
    if (paramBusinessId && typeof paramBusinessId === 'string') {
      return paramBusinessId;
    }
    if (
      paramBusinessId &&
      Array.isArray(paramBusinessId) &&
      paramBusinessId[0] &&
      typeof paramBusinessId[0] === 'string'
    ) {
      return paramBusinessId[0];
    }

    // Check body
    const bodyBusinessId = (request.body as { businessId?: string } | undefined)
      ?.businessId;
    if (bodyBusinessId) {
      return String(bodyBusinessId);
    }

    return null;
  }

  /**
   * Check if user is a member of the business by querying Firestore.
   * Uses the businesses/{businessId}/members/{userId} document.
   */
  private async checkMembership(
    businessId: string,
    userId: string,
  ): Promise<boolean> {
    try {
      const db = this.firestore.getFirestore();
      const membershipRef = db.doc(
        `businesses/${businessId}/members/${userId}`,
      );
      const membershipSnap = await membershipRef.get();

      return membershipSnap.exists;
    } catch (error) {
      this.logger.error(
        `Error checking membership for user ${userId} in business ${businessId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Fail closed: deny access on error
      return false;
    }
  }
}
