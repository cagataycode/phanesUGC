import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { UserRole } from './roles.enum';
import { FirestoreService } from '../firebase/firestore.service';
import { AuthenticatedRequest } from './firebase-auth.guard';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private firestore: FirestoreService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles are required, allow access
    if (!requiredRoles) {
      return true;
    }

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
    const membershipRef = db.doc(
      `businesses/${businessId}/members/${user.uid}`,
    );
    const membershipSnap = await membershipRef.get();

    if (!membershipSnap.exists) {
      throw new ForbiddenException('You are not a member of this business');
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
