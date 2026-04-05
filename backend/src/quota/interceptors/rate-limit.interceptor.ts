import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { QuotaService } from '../quota.service';
import { RateLimiterService } from '../rate-limiter.service';
import { Response } from 'express';

@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  constructor(
    private readonly quotaService: QuotaService,
    private readonly rateLimiter: RateLimiterService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const request = context.switchToHttp().getRequest<any>();
    const response = context.switchToHttp().getResponse<Response>();

    // Extract businessId from params, query, or body
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const businessId: string | undefined =
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      request.params?.businessId ||
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      request.query?.businessId ||
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      request.body?.businessId;

    if (!businessId) {
      // No businessId, skip rate limiting
      return next.handle();
    }

    const tier = await this.quotaService.getSubscriptionTier(businessId);
    const rateLimitStatus = await this.rateLimiter.checkRateLimit(
      businessId,
      tier,
    );

    // Set rate limit headers
    const config = this.rateLimiter.getRateLimitConfig(tier);
    response.setHeader('X-RateLimit-Limit', config.requestsPerMinute);
    response.setHeader(
      'X-RateLimit-Remaining',
      rateLimitStatus.requestsRemaining,
    );
    response.setHeader(
      'X-RateLimit-Reset',
      rateLimitStatus.resetTime.toISOString(),
    );

    if (!rateLimitStatus.allowed) {
      response.setHeader('Retry-After', rateLimitStatus.retryAfter || 60);
      throw new HttpException(
        'Rate limit exceeded',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.rateLimiter.recordRequest(businessId);

    return next.handle();
  }
}
