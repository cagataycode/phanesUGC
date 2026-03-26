import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { DecodedIdToken } from 'firebase-admin/auth';

export interface AuthenticatedRequest extends Request {
  user?: DecodedIdToken;
}

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;

    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid authorization header',
      );
    }

    const token = authorization.split('Bearer ')[1];
    if (!token) {
      throw new UnauthorizedException(
        'Token not found in authorization header',
      );
    }

    try {
      const decodedToken = await this.authService.verifyIdToken(token);
      request.user = decodedToken;
      return true;
    } catch {
      throw new UnauthorizedException('Unauthorized access');
    }
  }
}
