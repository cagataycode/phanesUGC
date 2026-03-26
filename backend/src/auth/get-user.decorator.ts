import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { DecodedIdToken } from 'firebase-admin/auth';
import { AuthenticatedRequest } from './firebase-auth.guard';

/**
 * Extracts the decoded Firebase user from the request.
 * Must be used in conjunction with FirebaseAuthGuard.
 */
export const GetUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): DecodedIdToken => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      throw new UnauthorizedException(
        'User not found in request. Ensure FirebaseAuthGuard is applied.',
      );
    }
    return request.user;
  },
);
