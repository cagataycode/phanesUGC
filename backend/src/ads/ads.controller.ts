import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdsService } from './ads.service';
import { CreateAdDto } from './dto/create-ad.dto';
import { WizardSubmitSchema } from './dto/wizard.dto';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PerformanceInterceptor } from '../monitoring/interceptors/performance.interceptor';
import { QuotaService } from '../quota/quota.service';
import { RateLimiterService } from '../quota/rate-limiter.service';

@Controller('ads')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@UseInterceptors(PerformanceInterceptor)
export class AdsController {
  constructor(
    private readonly adsService: AdsService,
    private readonly quotaService: QuotaService,
    private readonly rateLimiter: RateLimiterService,
  ) {}

  @Post()
  async createJob(
    @Body() createAdDto: CreateAdDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const businessId = createAdDto.businessId;

    // Get subscription tier for rate limit config
    const tier = await this.quotaService.getSubscriptionTier(businessId);
    const rateLimitConfig = this.rateLimiter.getRateLimitConfig(tier);

    // Check rate limit
    const rateLimitStatus = await this.rateLimiter.checkRateLimit(
      businessId,
      tier,
    );

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', rateLimitConfig.requestsPerMinute);
    res.setHeader('X-RateLimit-Remaining', rateLimitStatus.requestsRemaining);
    res.setHeader('X-RateLimit-Reset', rateLimitStatus.resetTime.toISOString());

    if (!rateLimitStatus.allowed) {
      res.setHeader('Retry-After', rateLimitStatus.retryAfter || 60);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: rateLimitStatus.retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Check quota
    const canCreate = await this.quotaService.canCreateJob(businessId);
    if (!canCreate) {
      const quota = await this.quotaService.checkQuota(businessId);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Monthly video quota exceeded. Please upgrade your plan.',
          quota: {
            used: quota.videosCreated,
            limit:
              quota.videosRemaining === -1
                ? 'unlimited'
                : quota.videosRemaining + quota.videosCreated,
            resetDate: quota.resetDate.toISOString().split('T')[0], // Date only
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Check concurrent jobs
    const canRunConcurrent = await this.rateLimiter.checkConcurrentJobs(
      businessId,
      tier,
    );
    if (!canRunConcurrent) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Concurrent job limit reached for your ${tier} tier. Please wait for existing jobs to complete.`,
          tier,
          concurrentLimit: rateLimitConfig.concurrentJobs,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Record the request for rate limiting
    await this.rateLimiter.recordRequest(businessId);

    // Create the job
    const result = await this.adsService.createJob(createAdDto);

    // Note: Quota usage will be incremented when the job completes successfully
    // See AgentOrchestratorService for the actual increment call

    return result;
  }

  @Get()
  async listJobs(@Query('businessId') businessId: string) {
    return this.adsService.listJobs(businessId);
  }

  @Get(':id')
  async getJob(
    @Param('id') id: string,
    @Query('businessId') businessId: string,
  ) {
    return this.adsService.getJob(businessId, id);
  }

  @Get(':id/result')
  async getJobResult(
    @Param('id') id: string,
    @Query('businessId') businessId: string,
  ) {
    return this.adsService.getJobResult(businessId, id);
  }

  @Post(':id/select')
  async selectScenario(
    @Param('id') id: string,
    @Body() body: { scenarioId: number },
    @Query('businessId') businessId: string,
  ) {
    await this.adsService.selectScenario(businessId, id, body.scenarioId);
    return { id, status: 'phase2_started' };
  }

  @Post('wizard')
  async createWizardJob(
    @Body() wizardDto: Record<string, unknown>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const parsed = WizardSubmitSchema.parse(wizardDto);
    const businessId = parsed.businessId;

    // Get subscription tier for rate limit config
    const tier = await this.quotaService.getSubscriptionTier(businessId);
    const rateLimitConfig = this.rateLimiter.getRateLimitConfig(tier);

    // Check rate limit
    const rateLimitStatus = await this.rateLimiter.checkRateLimit(
      businessId,
      tier,
    );

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', rateLimitConfig.requestsPerMinute);
    res.setHeader('X-RateLimit-Remaining', rateLimitStatus.requestsRemaining);
    res.setHeader('X-RateLimit-Reset', rateLimitStatus.resetTime.toISOString());

    if (!rateLimitStatus.allowed) {
      res.setHeader('Retry-After', rateLimitStatus.retryAfter || 60);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: rateLimitStatus.retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Check quota
    const canCreate = await this.quotaService.canCreateJob(businessId);
    if (!canCreate) {
      const quota = await this.quotaService.checkQuota(businessId);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Monthly video quota exceeded. Please upgrade your plan.',
          quota: {
            used: quota.videosCreated,
            limit:
              quota.videosRemaining === -1
                ? 'unlimited'
                : quota.videosRemaining + quota.videosCreated,
            resetDate: quota.resetDate.toISOString().split('T')[0], // Date only
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Check concurrent jobs
    const canRunConcurrent = await this.rateLimiter.checkConcurrentJobs(
      businessId,
      tier,
    );
    if (!canRunConcurrent) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Concurrent job limit reached for your ${tier} tier. Please wait for existing jobs to complete.`,
          tier,
          concurrentLimit: rateLimitConfig.concurrentJobs,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Record the request for rate limiting
    await this.rateLimiter.recordRequest(businessId);

    // Create the job
    const result = await this.adsService.createWizardJob(parsed);

    // Note: Quota usage will be incremented when the job completes successfully
    // See AgentOrchestratorService for the actual increment call

    return result;
  }
}
