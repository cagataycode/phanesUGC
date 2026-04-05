import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AdsService } from './ads.service';
import { CreateAdDto } from './dto/create-ad.dto';
import { WizardSubmitSchema } from './dto/wizard.dto';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PerformanceInterceptor } from '../monitoring/interceptors/performance.interceptor';
import { RateLimitInterceptor } from '../quota/interceptors/rate-limit.interceptor';
import { QuotaService } from '../quota/quota.service';
import { RateLimiterService } from '../quota/rate-limiter.service';

@Controller('ads')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@UseInterceptors(PerformanceInterceptor, RateLimitInterceptor)
export class AdsController {
  constructor(
    private readonly adsService: AdsService,
    private readonly quotaService: QuotaService,
    private readonly rateLimiter: RateLimiterService,
  ) {}

  @Post()
  async createJob(@Body() createAdDto: CreateAdDto) {
    const businessId = createAdDto.businessId;

    // Get subscription tier
    const tier = await this.quotaService.getSubscriptionTier(businessId);
    const rateLimitConfig = this.rateLimiter.getRateLimitConfig(tier);

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

    // Atomically check and increment quota
    const quotaResult = await this.quotaService.tryIncrementQuota(businessId);

    if (!quotaResult.allowed && quotaResult.quota) {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          message: 'Monthly video quota exceeded. Please upgrade your plan.',
          quota: {
            used: quotaResult.quota.videosCreated,
            limit:
              quotaResult.quota.videosRemaining === -1
                ? 'unlimited'
                : quotaResult.quota.videosRemaining +
                  quotaResult.quota.videosCreated,
            resetDate: quotaResult.quota.resetDate.toISOString().split('T')[0],
          },
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    // Create the job (with rollback on failure)
    try {
      const result = await this.adsService.createJob(createAdDto);
      return result;
    } catch (error) {
      // Rollback quota increment if job creation fails
      await this.quotaService.decrementQuota(businessId);
      throw error;
    }
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
  async createWizardJob(@Body() wizardDto: Record<string, unknown>) {
    const parsed = WizardSubmitSchema.parse(wizardDto);
    const businessId = parsed.businessId;

    // Get subscription tier
    const tier = await this.quotaService.getSubscriptionTier(businessId);
    const rateLimitConfig = this.rateLimiter.getRateLimitConfig(tier);

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

    // Atomically check and increment quota
    const quotaResult = await this.quotaService.tryIncrementQuota(businessId);

    if (!quotaResult.allowed && quotaResult.quota) {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          message: 'Monthly video quota exceeded. Please upgrade your plan.',
          quota: {
            used: quotaResult.quota.videosCreated,
            limit:
              quotaResult.quota.videosRemaining === -1
                ? 'unlimited'
                : quotaResult.quota.videosRemaining +
                  quotaResult.quota.videosCreated,
            resetDate: quotaResult.quota.resetDate.toISOString().split('T')[0],
          },
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    // Create the job (with rollback on failure)
    try {
      const result = await this.adsService.createWizardJob(parsed);
      return result;
    } catch (error) {
      // Rollback quota increment if job creation fails
      await this.quotaService.decrementQuota(businessId);
      throw error;
    }
  }
}
