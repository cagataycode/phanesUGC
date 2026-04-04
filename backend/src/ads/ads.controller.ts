import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdsService } from './ads.service';
import { CreateAdDto } from './dto/create-ad.dto';
import { WizardSubmitSchema } from './dto/wizard.dto';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PerformanceMonitorService } from '../monitoring/performance-monitor.service';
import { StructuredLoggerService } from '../monitoring/structured-logger.service';

/* eslint-disable @typescript-eslint/no-unsafe-assignment */

@Controller('ads')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class AdsController {
  constructor(
    private readonly adsService: AdsService,
    private readonly performanceMonitor: PerformanceMonitorService,
    private readonly structuredLogger: StructuredLoggerService,
  ) {}

  @Post()
  async createJob(@Body() createAdDto: CreateAdDto) {
    const startTime = Date.now();
    const correlationId = this.structuredLogger.generateCorrelationId();

    try {
      const result = await this.adsService.createJob(createAdDto);

      const latency = Date.now() - startTime;
      this.performanceMonitor.trackLatency(
        'ads-controller',
        'create-job',
        latency,
        {
          correlationId,
          businessId: createAdDto.business_id,
          platform: createAdDto.prompt_inputs.platform,
        },
        'success',
      );

      return result;
    } catch (error) {
      const latency = Date.now() - startTime;
      this.performanceMonitor.trackLatency(
        'ads-controller',
        'create-job',
        latency,
        { correlationId, businessId: createAdDto.business_id },
        'failure',
      );
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
    const startTime = Date.now();
    const correlationId = this.structuredLogger.generateCorrelationId();

    try {
      const result = await this.adsService.getJob(businessId, id);

      const latency = Date.now() - startTime;
      this.performanceMonitor.trackLatency(
        'ads-controller',
        'get-job',
        latency,
        { correlationId, businessId, jobId: id },
        'success',
      );

      return result;
    } catch (error) {
      const latency = Date.now() - startTime;
      this.performanceMonitor.trackLatency(
        'ads-controller',
        'get-job',
        latency,
        { correlationId, businessId, jobId: id },
        'failure',
      );
      throw error;
    }
  }

  @Get(':id/result')
  async getJobResult(
    @Param('id') id: string,
    @Query('businessId') businessId: string,
  ) {
    const startTime = Date.now();
    const correlationId = this.structuredLogger.generateCorrelationId();

    try {
      const result = await this.adsService.getJobResult(businessId, id);

      const latency = Date.now() - startTime;
      this.performanceMonitor.trackLatency(
        'ads-controller',
        'get-job-result',
        latency,
        { correlationId, businessId, jobId: id },
        'success',
      );

      return result;
    } catch (error) {
      const latency = Date.now() - startTime;
      this.performanceMonitor.trackLatency(
        'ads-controller',
        'get-job-result',
        latency,
        { correlationId, businessId, jobId: id },
        'failure',
      );
      throw error;
    }
  }

  @Post(':id/select')
  async selectScenario(
    @Param('id') id: string,
    @Body() body: { scenarioId: number },
    @Query('businessId') businessId: string,
  ) {
    const startTime = Date.now();
    const correlationId = this.structuredLogger.generateCorrelationId();

    try {
      await this.adsService.selectScenario(businessId, id, body.scenarioId);

      const latency = Date.now() - startTime;
      this.performanceMonitor.trackLatency(
        'ads-controller',
        'select-scenario',
        latency,
        { correlationId, businessId, jobId: id, scenarioId: body.scenarioId },
        'success',
      );

      return { id, status: 'phase2_started' };
    } catch (error) {
      const latency = Date.now() - startTime;
      this.performanceMonitor.trackLatency(
        'ads-controller',
        'select-scenario',
        latency,
        { correlationId, businessId, jobId: id },
        'failure',
      );
      throw error;
    }
  }

  @Post('wizard')
  async createWizardJob(@Body() wizardDto: Record<string, unknown>) {
    const startTime = Date.now();
    const correlationId = this.structuredLogger.generateCorrelationId();

    try {
      const parsed = WizardSubmitSchema.parse(wizardDto);
      const result = await this.adsService.createWizardJob(parsed);

      const latency = Date.now() - startTime;
      this.performanceMonitor.trackLatency(
        'ads-controller',
        'create-wizard-job',
        latency,
        { correlationId, businessId: parsed.business_id },
        'success',
      );

      return result;
    } catch (error) {
      const latency = Date.now() - startTime;
      this.performanceMonitor.trackLatency(
        'ads-controller',
        'create-wizard-job',
        latency,
        { correlationId },
        'failure',
      );
      throw error;
    }
  }
}
