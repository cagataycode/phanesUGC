import { Injectable, Logger } from '@nestjs/common';
import { CreateAdDto } from './dto/create-ad.dto';
import { JobStoreService } from './services/job-store.service';
import { AgentOrchestratorService } from '../agent/orchestrator/agent-orchestrator.service';
import { GcsStorageService } from '../storage/gcs-storage.service';

@Injectable()
export class AdsService {
  private readonly logger = new Logger(AdsService.name);

  constructor(
    private readonly jobStoreService: JobStoreService,
    private readonly agentOrchestrator: AgentOrchestratorService,
    private readonly gcsStorageService: GcsStorageService,
  ) {}

  async createJob(
    createAdDto: CreateAdDto,
  ): Promise<{ id: string; status: string }> {
    const jobId = await this.jobStoreService.create(createAdDto.businessId, {
      businessId: createAdDto.businessId,
      productId: createAdDto.productId,
      createdBy: createAdDto.createdBy,
      prompt:
        typeof createAdDto.prompt_inputs.prompt === 'string'
          ? createAdDto.prompt_inputs.prompt
          : JSON.stringify(createAdDto.prompt_inputs.prompt),
      platform: createAdDto.prompt_inputs.platform,
      aspectRatio: createAdDto.veo_config.aspect_ratio,
      durationSec: createAdDto.veo_config.duration_sec,
    });

    // Initialize agent job
    await this.agentOrchestrator.initializeJob(
      jobId,
      createAdDto.businessId,
      createAdDto,
    );

    // Start Phase 1 (scenario generation) asynchronously
    void this.runPhase1(jobId, createAdDto);

    return {
      id: jobId,
      status: 'created', // Maintain backward compatibility
    };
  }

  /**
   * Run Phase 1 - Generate scenarios
   */
  private async runPhase1(
    jobId: string,
    createAdDto: CreateAdDto,
  ): Promise<void> {
    try {
      await this.jobStoreService.update(createAdDto.businessId, jobId, {
        status: 'processing',
        progress: 10,
        'stages.normalize': 'running',
        'stages.scrape': 'pending',
        'stages.brief': 'pending',
        'stages.scenarios': 'pending',
      });

      // Run agent Phase 1
      const scenarioSet = await this.agentOrchestrator.runPhase1(
        jobId,
        createAdDto.businessId,
      );

      // Store scenarios in job
      await this.jobStoreService.update(createAdDto.businessId, jobId, {
        status: 'scenarios_ready',
        progress: 40,
        metadata: {
          scenarios: scenarioSet.scenarios,
          scenarioExpiresAt: scenarioSet.expiresAt,
        },
        'stages.normalize': 'done',
        'stages.scrape': 'done',
        'stages.brief': 'done',
        'stages.scenarios': 'done',
      });

      this.logger.log(`Phase 1 completed for job ${jobId} - 4 scenarios ready`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Phase 1 failed';
      this.logger.error(`Phase 1 failed for job ${jobId}: ${message}`);

      await this.jobStoreService.update(createAdDto.businessId, jobId, {
        status: 'failed',
        error: message,
        failedStage: 'scenarios',
      });
    }
  }

  /**
   * Select scenario and start Phase 2
   */
  async selectScenario(
    businessId: string,
    jobId: string,
    scenarioId: number,
  ): Promise<void> {
    const job = await this.jobStoreService.getById(businessId, jobId);

    if (job.status !== 'scenarios_ready') {
      throw new Error('Job is not ready for scenario selection');
    }

    // Select scenario in agent
    await this.agentOrchestrator.selectScenario(jobId, businessId, scenarioId);

    // Update job status
    await this.jobStoreService.update(businessId, jobId, {
      status: 'phase2_started',
      progress: 50,
      metadata: {
        ...job.metadata,
        selectedScenarioId: scenarioId,
      },
      'stages.normalize': 'done',
      'stages.scrape': 'done',
      'stages.brief': 'done',
      'stages.scenarios': 'done',
      'stages.script': 'running',
      'stages.veo': 'pending',
      'stages.subtitles': 'pending',
      'stages.render': 'pending',
    });

    // Start Phase 2 asynchronously
    void this.runPhase2(businessId, jobId);
  }

  /**
   * Run Phase 2 - Generate video for selected scenario
   */
  private async runPhase2(businessId: string, jobId: string): Promise<void> {
    try {
      // Run agent Phase 2
      const finalOutput = await this.agentOrchestrator.runPhase2(
        jobId,
        businessId,
      );

      // Store final output in job
      await this.jobStoreService.update(businessId, jobId, {
        status: 'completed',
        progress: 100,
        output: {
          videoStorageKey: finalOutput.gcsPath, // Already in objectPath format
        },
        metadata: {
          finalOutput,
        },
        'stages.normalize': 'done',
        'stages.scrape': 'done',
        'stages.brief': 'done',
        'stages.scenarios': 'done',
        'stages.script': 'done',
        'stages.veo': 'done',
        'stages.subtitles': 'done',
        'stages.render': 'done',
      });

      this.logger.log(`Phase 2 completed for job ${jobId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Phase 2 failed';
      this.logger.error(`Phase 2 failed for job ${jobId}: ${message}`);

      await this.jobStoreService.update(businessId, jobId, {
        status: 'failed',
        error: message,
        failedStage: 'video_generation',
      });
    }
  }

  async getJob(businessId: string, projectId: string) {
    return this.jobStoreService.getById(businessId, projectId);
  }

  async listJobs(businessId: string) {
    return this.jobStoreService.listByBusiness(businessId);
  }

  async getJobResult(businessId: string, projectId: string) {
    const job = await this.jobStoreService.getById(businessId, projectId);

    let video_url: string | undefined;
    if (job.output?.videoStorageKey) {
      video_url = await this.gcsStorageService.createSignedVideoUrl(
        job.output.videoStorageKey,
      );
    }

    let source_video_url: string | undefined;
    if (job.output?.sourceVideoStorageKey) {
      source_video_url = await this.gcsStorageService.createSignedVideoUrl(
        job.output.sourceVideoStorageKey,
      );
    }

    const thumbnail_url = job.output?.thumbnailStorageKey
      ? await this.gcsStorageService.createSignedVideoUrl(
          job.output.thumbnailStorageKey,
        )
      : undefined;

    // Return scenarios if in Phase 1
    const scenarios = job.metadata?.scenarios || null;

    return {
      video_url,
      source_video_url,
      thumbnail_url,
      scenarios, // NEW: Include scenarios for Phase 1
      script: (job.script as unknown as Record<string, unknown>) ?? null,
      creativeBrief: job.creativeBrief ?? null,
      subtitles: job.subtitleSegments ?? [],
      transcript: job.script?.full_text ? [{ text: job.script.full_text }] : [],
      metadata: job.metadata ?? {},
      generationConfig: {
        platform: job.platform ?? undefined,
        aspectRatio: job.aspectRatio ?? undefined,
        durationSec: job.durationSec ?? undefined,
      },
      timestamps: {
        createdAt: job.createdAt?.toDate?.()?.toISOString() ?? null,
        updatedAt: job.updatedAt?.toDate?.()?.toISOString() ?? null,
      },
      pipeline: {
        status: job.status,
        stages: job.stages ?? {},
      },
    };
  }
}
