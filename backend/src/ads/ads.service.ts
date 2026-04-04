import { Injectable, Logger } from '@nestjs/common';
import { CreateAdDto } from './dto/create-ad.dto';
import { WizardSubmitDto } from './dto/wizard.dto';
import { JobStoreService } from './services/job-store.service';
import { AgentOrchestratorService } from '../agent/orchestrator/agent-orchestrator.service';
import { GcsStorageService } from '../storage/gcs-storage.service';
import { FinalOutput } from '../agent/contracts/final-output';

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

    // Start scenario generation asynchronously
    void this.runScenarioGeneration(jobId, createAdDto);

    return {
      id: jobId,
      status: 'phase1_started',
    };
  }

  /**
   * Create a job from wizard-generated content
   * Skips Phase 1 and goes directly to Phase 2 (video generation)
   */
  async createWizardJob(
    wizardDto: WizardSubmitDto,
  ): Promise<{ id: string; status: string }> {
    const durationSec =
      (wizardDto.scene as { duration_seconds?: number })?.duration_seconds || 8;

    const jobId = await this.jobStoreService.create(wizardDto.businessId, {
      businessId: wizardDto.businessId,
      productId: wizardDto.productId,
      createdBy: wizardDto.createdBy || 'wizard',
      prompt: wizardDto.prompt,
      platform: wizardDto.platform,
      aspectRatio: wizardDto.aspect_ratio,
      durationSec,
    });

    // Initialize agent job with wizard-generated content
    await this.agentOrchestrator.initializeFromWizard(
      jobId,
      wizardDto.businessId,
      {
        prompt: wizardDto.prompt,
        platform: wizardDto.platform,
        language: wizardDto.language,
        tone: wizardDto.tone,
        targetAudience: wizardDto.target_audience,
        cta: wizardDto.cta,
        aspectRatio: wizardDto.aspect_ratio,
        subtitleStyle: wizardDto.subtitle_style,
        brief: wizardDto.brief,
        script: wizardDto.script,
        scene: wizardDto.scene,
      },
    );

    // Update job status to show Phase 1 is complete
    await this.jobStoreService.update(wizardDto.businessId, jobId, {
      status: 'phase2_started',
      progress: 50,
      stages: {
        normalize: 'done',
        scrape: 'done',
        brief: 'done',
        scenarios: 'done',
        script: 'running',
        veo: 'pending',
        subtitles: 'pending',
        render: 'pending',
      },
    });

    // Start video generation for wizard job (scenario already selected)
    void this.agentOrchestrator.runVideoGeneration(jobId, wizardDto.businessId);

    // Start polling for video generation completion
    void this.pollVideoGenerationStatus(wizardDto.businessId, jobId);

    return {
      id: jobId,
      status: 'phase2_started',
    };
  }

  /**
   * Run Scenario Generation - Generate scenarios
   */
  private async runScenarioGeneration(
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

      // Run agent scenario generation

      const scenarioSet = (await this.agentOrchestrator.runScenarioGeneration(
        jobId,
        createAdDto.businessId,
      )) as unknown as { scenarios: unknown[]; expiresAt: Date };

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

      this.logger.log(
        `Scenario generation completed for job ${jobId} - 4 scenarios ready`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Scenario generation failed';
      this.logger.error(
        `Scenario generation failed for job ${jobId}: ${message}`,
      );

      await this.jobStoreService.update(createAdDto.businessId, jobId, {
        status: 'failed',
        error: message,
        failedStage: 'scenarios',
      });
    }
  }

  /**
   * Select scenario and start Video generation
   * Note: AgentOrchestrator.selectScenario() triggers video generation internally
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

    // Select scenario in agent (this triggers video generation internally)
    await this.agentOrchestrator.selectScenario(jobId, businessId, scenarioId);

    // Update job status to reflect video generation has started
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

    // Note: Video generation is already running asynchronously in the orchestrator
    // We poll the agent state to update job status when it completes
    void this.pollVideoGenerationStatus(businessId, jobId);
  }

  /**
   * Poll agent state and update job status when video generation completes
   */
  private async pollVideoGenerationStatus(
    businessId: string,
    jobId: string,
  ): Promise<void> {
    const maxAttempts = 120; // 10 minutes with 5s intervals
    let attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds
      attempts++;

      try {
        const agentState = await this.agentOrchestrator.getJobState(
          jobId,
          businessId,
        );

        if (agentState.videoGenerationStatus === 'completed') {
          const finalOutput = agentState.artifacts
            .finalOutput as FinalOutput | null;

          if (!finalOutput) {
            this.logger.error(
              `Final output missing for completed job ${jobId}`,
            );
            return;
          }

          await this.jobStoreService.update(businessId, jobId, {
            status: 'completed',
            progress: 100,
            output: {
              videoStorageKey: finalOutput.gcsPath.replace(
                /^gs:\/\/[^/]+\//,
                '',
              ),
            },
            'metadata.finalOutput': finalOutput,
            'stages.normalize': 'done',
            'stages.scrape': 'done',
            'stages.brief': 'done',
            'stages.scenarios': 'done',
            'stages.script': 'done',
            'stages.veo': 'done',
            'stages.subtitles': 'done',
            'stages.render': 'done',
          });

          this.logger.log(
            `Video generation completed for job ${jobId}. GCS Path: ${finalOutput.gcsPath}`,
          );
          return;
        } else if (agentState.videoGenerationStatus === 'failed') {
          // Video generation failed
          const lastError =
            agentState.errors.length > 0
              ? agentState.errors[agentState.errors.length - 1].message
              : 'Video generation failed';

          await this.jobStoreService.update(businessId, jobId, {
            status: 'failed',
            error: lastError,
            failedStage: 'video_generation',
          });

          this.logger.error(
            `Video generation failed for job ${jobId}: ${lastError}`,
          );
          return;
        }

        // Still in progress, continue polling
      } catch (error) {
        this.logger.error(
          `Error polling video generation status for job ${jobId}: ${error instanceof Error ? error.message : String(error)}`,
        );
        // Continue polling despite errors
      }
    }

    // Timeout after max attempts
    this.logger.warn(
      `Video generation polling timed out for job ${jobId} after ${maxAttempts * 5} seconds`,
    );
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

    // Return scenarios if in Scenario generation
    const scenarios = job.metadata?.scenarios || null;

    return {
      video_url,
      source_video_url,
      thumbnail_url,
      scenarios, // NEW: Include scenarios for Scenario generation
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
