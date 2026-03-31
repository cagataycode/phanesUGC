import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { UserRole } from './roles.enum';
import { FirestoreService } from '../firebase/firestore.service';
import { AuthenticatedRequest } from './firebase-auth.guard';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(
    private reflector: Reflector,
    private firestore: FirestoreService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      return false;
    }

    // Attempt to resolve businessId from request (header or query or params)
    const rawBusinessId =
      (request.headers['x-business-id'] as string) ||
      (request.query.businessId as string) ||
      request.params.businessId;

    if (!rawBusinessId) {
      throw new ForbiddenException(
        'Business ID is required for role-based access',
      );
    }

    const businessId = Array.isArray(rawBusinessId)
      ? rawBusinessId[0]
      : String(rawBusinessId);

    // Fetch membership to check role
    const db = this.firestore.getFirestore();
    this.logger.debug(
      `Checking membership for businessId: "${businessId}", user: "${user.uid}"`,
    );
    const membershipRef = db.doc(
      `businesses/${businessId}/members/${user.uid}`,
    );
    const membershipSnap = await membershipRef.get();

    if (!membershipSnap.exists) {
      throw new ForbiddenException('You are not a member of this business');
    }

    // If no roles are required, allow access now that membership is confirmed
    if (!requiredRoles) {
      return true;
    }

    const membershipData = membershipSnap.data();
    const userRole = membershipData?.role as UserRole;

    const hasRole = requiredRoles.includes(userRole);
    if (!hasRole) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
