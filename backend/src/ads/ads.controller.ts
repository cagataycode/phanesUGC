import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
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
import {
  QuotaService,
  SubscriptionTier,
  TierLimits,
} from '../quota/quota.service';
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

  /**
   * Validate businessId and perform quota/rate limit checks
   * Shared logic for createJob and createWizardJob
   */
  private async validateAndCheckLimits(
    authorizedBusinessId: string | string[] | undefined,
    queryBusinessId: string | string[] | undefined,
    bodyBusinessId: string,
  ): Promise<{
    businessId: string;
    tier: SubscriptionTier;
    tierLimits: TierLimits;
  }> {
    // IDOR Protection: Validate body businessId matches the authorized businessId from guard
    // Normalize arrays (repeated headers/query params) to single string
    const normalizedHeader = Array.isArray(authorizedBusinessId)
      ? authorizedBusinessId[0]
      : authorizedBusinessId;
    const normalizedQuery = Array.isArray(queryBusinessId)
      ? queryBusinessId[0]
      : queryBusinessId;

    const guardBusinessId = normalizedHeader || normalizedQuery;
    if (!guardBusinessId) {
      throw new ForbiddenException(
        'Business ID must be provided via x-business-id header or query parameter',
      );
    }

    if (bodyBusinessId !== guardBusinessId) {
      throw new ForbiddenException(
        'Business ID in request body must match authorized business',
      );
    }

    const businessId = guardBusinessId;

    // Get subscription tier and limits
    const tier = await this.quotaService.getSubscriptionTier(businessId);
    const rateLimitConfig = this.rateLimiter.getRateLimitConfig(tier);
    const tierLimits = this.quotaService.getTierLimits(tier);

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

    // Check quota availability (without incrementing - quota is charged on completion)
    const quota = await this.quotaService.checkQuota(businessId, tier);
    if (quota.videosRemaining !== -1 && quota.videosRemaining === 0) {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          message: 'Monthly video quota exceeded. Please upgrade your plan.',
          quota: {
            used: quota.videosCreated,
            limit: tierLimits.monthlyVideos,
            resetDate: quota.resetDate.toISOString().split('T')[0],
          },
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    return { businessId, tier, tierLimits };
  }

  @Post()
  async createJob(
    @Headers('x-business-id')
    authorizedBusinessId: string | string[] | undefined,
    @Query('businessId') queryBusinessId: string | string[] | undefined,
    @Body() createAdDto: CreateAdDto,
  ) {
    await this.validateAndCheckLimits(
      authorizedBusinessId,
      queryBusinessId,
      createAdDto.businessId,
    );

    // Create the job (quota will be charged by orchestrator on successful completion)
    return this.adsService.createJob(createAdDto);
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
    @Headers('x-business-id')
    authorizedBusinessId: string | string[] | undefined,
    @Query('businessId') queryBusinessId: string | string[] | undefined,
    @Body() wizardDto: Record<string, unknown>,
  ) {
    const parsed = WizardSubmitSchema.parse(wizardDto);

    await this.validateAndCheckLimits(
      authorizedBusinessId,
      queryBusinessId,
      parsed.businessId,
    );

    // Create the job (quota will be charged by orchestrator on successful completion)
    return this.adsService.createWizardJob(parsed);
  }
}
