import { Injectable, Logger } from '@nestjs/common';
import { FirestoreService } from '../../firebase/firestore.service';
import { AgentJobState, AgentStage } from './agent-state.model';
import { InputNormalizerService } from '../stages/input-normalizer.service';
import { ContextAcquisitionService } from '../stages/context-acquisition.service';
import { BriefBuilderService } from '../stages/brief-builder.service';
import { ScenarioGeneratorService } from '../stages/scenario-generator.service';
import { ScriptGeneratorService } from '../stages/script-generator.service';
import { VeoPromptBuilderService } from '../stages/veo-prompt-builder.service';
import { VideoGeneratorService } from '../stages/video-generator.service';
import { SubtitleGeneratorService } from '../stages/subtitle-generator.service';
import { TimelineAssemblerService } from '../stages/timeline-assembler.service';
import { RenderExecutorService } from '../stages/render-executor.service';
import { OutputValidatorService } from '../stages/output-validator.service';
import { QualityGatesService } from './quality-gates.service';
import { NormalizedRequest } from '../contracts/normalized-request';
import { CreativeBrief } from '../contracts/creative-brief';
import { ProductContext } from '../contracts/product-context';
import { ScenarioSet } from '../contracts/scenario';
import { FinalOutput } from '../contracts/final-output';
import { CreateAdDto } from '../../ads/dto/create-ad.dto';
import { PlatformMapper, AgentConstants } from '../utils';
import { RetryPolicy, FallbackPolicy } from '../policies';

/**
 * AgentOrchestratorService - Main pipeline controller
 *
 * Orchestrates the two-stage agent pipeline:
 * - Scenario Generation: Fast scenario generation (< 30s)
 * - Video Generation: Full video generation after user selection (< 10 min)
 */
@Injectable()
export class AgentOrchestratorService {
  private readonly logger = new Logger(AgentOrchestratorService.name);
  private readonly SCENARIO_EXPIRY_HOURS = AgentConstants.SCENARIO_EXPIRY_HOURS;

  constructor(
    private readonly firestore: FirestoreService,
    private readonly inputNormalizer: InputNormalizerService,
    private readonly contextAcquisition: ContextAcquisitionService,
    private readonly briefBuilder: BriefBuilderService,
    private readonly scenarioGenerator: ScenarioGeneratorService,
    private readonly scriptGenerator: ScriptGeneratorService,
    private readonly veoPromptBuilder: VeoPromptBuilderService,
    private readonly videoGenerator: VideoGeneratorService,
    private readonly subtitleGenerator: SubtitleGeneratorService,
    private readonly timelineAssembler: TimelineAssemblerService,
    private readonly renderExecutor: RenderExecutorService,
    private readonly outputValidator: OutputValidatorService,
    private readonly qualityGates: QualityGatesService,
    private readonly retryPolicy: RetryPolicy,
    private readonly fallbackPolicy: FallbackPolicy,
  ) {}

  /**
   * Initialize a new agent job
   */
  async initializeJob(
    jobId: string,
    businessId: string,
    createAdDto: CreateAdDto,
  ): Promise<AgentJobState> {
    this.logger.log(`Initializing agent job ${jobId}`);

    const now = new Date();

    // Convert CreateAdDto to NormalizedRequest format
    const promptInputs = createAdDto.prompt_inputs;
    const veoConfig = createAdDto.veo_config;

    const normalizedRequest = {
      jobId,
      businessId,
      prompt:
        typeof promptInputs.prompt === 'string'
          ? promptInputs.prompt
          : JSON.stringify(promptInputs.prompt),
      platform: this.mapPlatform(promptInputs.platform),
      aspectRatio: veoConfig.aspect_ratio,
      durationSec: veoConfig.duration_sec,
      language: promptInputs.language || 'en',
      product: {
        name: promptInputs.product_info?.name,
        description: promptInputs.product_info?.description,
        benefits: promptInputs.product_info?.benefits,
        urls: promptInputs.urls,
      },
      tone: promptInputs.tone,
      targetAudience: promptInputs.target_audience,
      cta: promptInputs.cta,
      subtitleStyle: promptInputs.subtitle_style || 'kinetic',
      disableBackgroundMusic: false,
      disableCaptions: false,
      disableCtaOverlay: false,
    };

    const state: AgentJobState = {
      jobId,
      businessId,
      stage: 'created',
      scenarioGenerationStatus: 'pending',
      videoGenerationStatus: 'pending',
      artifacts: {
        normalizedRequest,
      },
      errors: [],
      totalRetryCount: 0,
      qualityReports: [],
      createdAt: now,
      updatedAt: now,
    };

    await this.saveState(state);
    return state;
  }

  /**
   * Map platform names between frontend and agent using shared utility
   */
  private mapPlatform(
    platform: string,
  ): 'tiktok' | 'instagram_reels' | 'youtube_shorts' {
    if (platform === 'instagram')
      return PlatformMapper.toAgentFormat('instagram');
    if (platform === 'youtube') return PlatformMapper.toAgentFormat('youtube');
    return 'tiktok';
  }

  /**
   * Run Scenario Generation - Fast scenario generation
   *
   * Returns 4 scenarios for user selection
   */
  async runScenarioGeneration(
    jobId: string,
    businessId: string,
  ): Promise<ScenarioSet> {
    this.logger.log(`Starting scenario generation for job ${jobId}`);

    const state = await this.loadState(jobId, businessId);
    state.scenarioGenerationStatus = 'in_progress';
    state.scenarioGenerationStartedAt = new Date();
    await this.saveState(state);

    try {
      // Stage 0: Platform validation (transition to platform_ready)
      this.logger.debug(`[${jobId}] Platform validation`);
      this.transitionStage(state, 'platform_ready');
      await this.saveState(state);

      // Stage 1: Normalize input
      this.logger.debug(`[${jobId}] Starting Stage 1: Normalize input`);
      this.transitionStage(state, 'normalized');
      const normalizedRequest = await this.retryPolicy.execute(
        () =>
          this.inputNormalizer.normalize(
            state.jobId,
            state.businessId,
            state.artifacts.normalizedRequest as Partial<NormalizedRequest>,
          ),
        this.createRetryContext(jobId, businessId, 'normalize', state),
      );
      state.artifacts.normalizedRequest = normalizedRequest;
      this.logger.debug(`[${jobId}] Stage 1 complete, saving state`);
      await this.saveState(state);

      // Stage 2: Acquire product context (with fallback and idempotency)
      this.logger.debug(`[${jobId}] Starting Stage 2: Acquire product context`);
      this.transitionStage(state, 'context_ready');
      let productContext: ProductContext;
      try {
        const result = await this.retryPolicy.execute(
          () =>
            this.contextAcquisition.acquireWithCache(
              normalizedRequest,
              state.artifacts.scrapeResults,
            ),
          this.createRetryContext(
            jobId,
            businessId,
            'context_acquisition',
            state,
          ),
        );
        productContext = result.context;
        state.artifacts.scrapeResults = result.scrapeResults;
      } catch (error) {
        // Fallback: Use manual inputs if scraping fails
        productContext = this.fallbackPolicy.handleScrapingFailure(
          normalizedRequest,
          error,
        );
      }
      state.artifacts.productContext = productContext;
      this.logger.debug(`[${jobId}] Stage 2 complete, saving state`);
      await this.saveState(state);

      // Stage 3: Build creative brief (with fallback)
      this.logger.debug(`[${jobId}] Starting Stage 3: Build creative brief`);
      this.transitionStage(state, 'brief_ready');
      let creativeBrief: CreativeBrief;
      try {
        creativeBrief = await this.retryPolicy.execute(
          () => this.briefBuilder.build(normalizedRequest, productContext),
          this.createRetryContext(jobId, businessId, 'brief_builder', state),
        );
      } catch (error) {
        // Fallback: Use template brief if generation fails
        creativeBrief = await this.fallbackPolicy.handleBriefFailure(
          normalizedRequest,
          productContext,
          error,
        );
      }
      state.artifacts.creativeBrief = creativeBrief;
      this.logger.debug(`[${jobId}] Stage 3 complete, saving state`);
      await this.saveState(state);

      // Stage 4: Generate 4 scenarios (with fallback)
      this.logger.debug(`[${jobId}] Starting Stage 4: Generate scenarios`);
      this.transitionStage(state, 'scenarios_ready');
      let scenarioSet: ScenarioSet;
      try {
        scenarioSet = await this.retryPolicy.execute(
          () => this.scenarioGenerator.generate(state.jobId, creativeBrief),
          this.createRetryContext(
            jobId,
            businessId,
            'scenario_generator',
            state,
          ),
        );
      } catch (error) {
        // Fallback: Use default scenarios if generation fails
        scenarioSet = await this.fallbackPolicy.handleScenarioFailure(
          state.jobId,
          creativeBrief,
          error,
        );
      }
      state.artifacts.scenarioSet = scenarioSet;

      // Set scenario expiry
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.SCENARIO_EXPIRY_HOURS);
      state.scenarioExpiresAt = expiresAt;

      state.scenarioGenerationStatus = 'completed';
      state.scenarioGenerationCompletedAt = new Date();
      await this.saveState(state);

      this.logger.log(`Scenario generation completed for job ${jobId}`);
      return scenarioSet;
    } catch (error) {
      state.scenarioGenerationStatus = 'failed';
      this.recordError(state, state.stage, error);

      // Log full error details for debugging
      this.logger.error(`Scenario generation failed for job ${jobId}:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        stage: state.stage,
        errorDetails: JSON.stringify(error, null, 2),
      });

      await this.saveState(state);
      throw error;
    }
  }

  /**
   * Select a scenario and trigger video generation
   */
  async selectScenario(
    jobId: string,
    businessId: string,
    scenarioId: number,
  ): Promise<void> {
    this.logger.log(`Scenario ${scenarioId} selected for job ${jobId}`);

    const state = await this.loadState(jobId, businessId);

    // Validate scenario selection
    if (state.stage !== 'scenarios_ready') {
      throw new Error('Invalid job state for scenario selection');
    }

    if (state.scenarioExpiresAt && new Date() > state.scenarioExpiresAt) {
      throw new Error('Scenario selection has expired');
    }

    // Validate scenarioId is 1-4
    if (!Number.isInteger(scenarioId) || scenarioId < 1 || scenarioId > 4) {
      throw new Error('Invalid scenario selection');
    }

    // Validate scenario exists in generated set
    const scenarioSet = state.artifacts.scenarioSet as ScenarioSet;
    if (!scenarioSet?.scenarios?.find((s) => s.scenarioId === scenarioId)) {
      throw new Error('Selected scenario not found');
    }

    // Check if video generation is already running
    if (state.videoGenerationStatus === 'in_progress') {
      throw new Error('Video generation already in progress');
    }

    state.selectedScenarioId = scenarioId;
    this.transitionStage(state, 'scenario_selected');
    await this.saveState(state);

    // Start video generation asynchronously
    void this.runVideoGeneration(jobId, businessId);
  }

  /**
   * Run Video Generation - Full video generation
   *
   * Generates the final video for the selected scenario
   */
  async runVideoGeneration(
    jobId: string,
    businessId: string,
  ): Promise<FinalOutput> {
    this.logger.log(`Starting video generation for job ${jobId}`);

    const state = await this.loadState(jobId, businessId);
    state.videoGenerationStatus = 'in_progress';
    state.videoGenerationStartedAt = new Date();
    await this.saveState(state);

    try {
      // Validate selected scenario
      if (!state.selectedScenarioId) {
        throw new Error('No scenario selected');
      }

      // Stage 5: Generate script
      this.transitionStage(state, 'script_ready');
      const creativeBrief = state.artifacts.creativeBrief as CreativeBrief;
      const adScript = await this.retryPolicy.execute(
        () =>
          this.scriptGenerator.generateFromBrief(
            state.jobId,
            state.selectedScenarioId!,
            creativeBrief,
          ),
        this.createRetryContext(jobId, businessId, 'script_generator', state),
      );
      state.artifacts.adScript = adScript;

      // Quality gate: Script
      const scriptReport = this.qualityGates.checkScript(
        adScript,
        (state.artifacts.normalizedRequest as NormalizedRequest).durationSec,
      );
      state.qualityReports.push(scriptReport);
      await this.saveState(state);

      // Stage 6: Build Veo prompt
      this.transitionStage(state, 'veo_prompt_ready');
      const normalizedRequest = state.artifacts
        .normalizedRequest as NormalizedRequest;
      const productContext = state.artifacts.productContext as ProductContext;

      const veoPrompt = await this.retryPolicy.execute(
        () =>
          this.veoPromptBuilder.build(
            state.jobId,
            adScript,
            creativeBrief,
            productContext,
            normalizedRequest,
          ),
        this.createRetryContext(jobId, businessId, 'veo_prompt_builder', state),
      );
      state.artifacts.veoPrompt = veoPrompt;
      await this.saveState(state);

      // Stage 7: Generate video with Veo (no fallback - critical stage, with idempotency)
      this.transitionStage(state, 'veo_generating');
      const veoResult = await this.retryPolicy.execute(
        () =>
          this.videoGenerator.generateWithIdempotency(
            veoPrompt,
            state.artifacts.veoAttempts as Array<{
              attemptId: string;
              gcsPath: string;
              timestamp: Date;
            }>,
          ),
        this.createRetryContext(jobId, businessId, 'video_generator', state),
      );
      const veoOutput = veoResult.output;

      // Track attempt for idempotency
      if (!state.artifacts.veoAttempts) {
        state.artifacts.veoAttempts = [];
      }
      if (!veoResult.isReused) {
        (
          state.artifacts.veoAttempts as Array<{
            attemptId: string;
            gcsPath: string;
            timestamp: Date;
          }>
        ).push({
          attemptId: veoResult.attemptId,
          gcsPath: veoOutput.gcsPath,
          timestamp: new Date(),
        });
      }

      this.transitionStage(state, 'veo_output_ready');
      state.artifacts.veoOutput = veoOutput;

      // Quality gate: Veo output
      const veoReport = this.qualityGates.checkVeoOutput(
        veoOutput,
        (state.artifacts.normalizedRequest as NormalizedRequest).durationSec,
        (state.artifacts.normalizedRequest as NormalizedRequest).aspectRatio,
      );
      state.qualityReports.push(veoReport);
      await this.saveState(state);

      // Stage 8: Generate subtitles (parallel with Veo, then scale)
      this.transitionStage(state, 'subtitles_ready');
      const subtitleData = await this.retryPolicy.execute(
        () =>
          this.subtitleGenerator.generate(
            state.jobId,
            adScript,
            veoOutput,
            normalizedRequest.subtitleStyle,
          ),
        this.createRetryContext(jobId, businessId, 'subtitle_generator', state),
      );
      state.artifacts.subtitleData = subtitleData;

      // Quality gate: Subtitles
      const subtitleReport = this.qualityGates.checkSubtitles(subtitleData);
      state.qualityReports.push(subtitleReport);
      await this.saveState(state);

      // Stage 9: Assemble render timeline
      this.transitionStage(state, 'composition_ready');
      const renderTimeline = await this.retryPolicy.execute(
        () =>
          this.timelineAssembler.assemble(
            state.jobId,
            veoOutput,
            subtitleData,
            state.artifacts.normalizedRequest as NormalizedRequest,
          ),
        this.createRetryContext(jobId, businessId, 'timeline_assembler', state),
      );
      state.artifacts.renderTimeline = renderTimeline;
      await this.saveState(state);

      // Stage 10: Render final video
      this.transitionStage(state, 'rendering');
      const finalOutput = await this.retryPolicy.execute(
        () => this.renderExecutor.render(renderTimeline),
        this.createRetryContext(jobId, businessId, 'render_executor', state),
      );
      this.transitionStage(state, 'completed');

      // Validate output
      const validationResult = await this.outputValidator.validate(
        finalOutput,
        (state.artifacts.normalizedRequest as NormalizedRequest).durationSec,
        (state.artifacts.normalizedRequest as NormalizedRequest).aspectRatio,
      );

      // Add validation warnings to quality reports
      if (
        validationResult.warnings.length > 0 ||
        validationResult.errors.length > 0
      ) {
        state.qualityReports.push({
          gate: 'output_validation',
          status: validationResult.passed ? 'warn' : 'fail',
          issues: [...validationResult.warnings, ...validationResult.errors],
          checkedAt: new Date(),
        });
      }

      // Quality gate: Final render
      const renderReport = this.qualityGates.checkFinalRender(finalOutput);
      state.qualityReports.push(renderReport);

      // Calculate overall quality score
      finalOutput.qualityScore = this.qualityGates.calculateQualityScore(
        state.qualityReports,
      );
      finalOutput.qualityReports = state.qualityReports;

      state.artifacts.finalOutput = finalOutput;
      state.videoGenerationStatus = 'completed';
      state.videoGenerationCompletedAt = new Date();
      await this.saveState(state);

      this.logger.log(`Video generation completed for job ${jobId}`);
      return finalOutput;
    } catch (error) {
      state.videoGenerationStatus = 'failed';
      this.transitionStage(state, 'failed');
      this.recordError(state, state.stage, error);
      await this.saveState(state);
      throw error;
    }
  }

  /**
   * Get current job state
   */
  async getJobState(jobId: string, businessId: string): Promise<AgentJobState> {
    return this.loadState(jobId, businessId);
  }

  /**
   * Transition to a new stage
   */
  private transitionStage(state: AgentJobState, newStage: AgentStage): void {
    this.logger.debug(`Job ${state.jobId}: ${state.stage} → ${newStage}`);
    state.stage = newStage;
    state.updatedAt = new Date();
  }

  /**
   * Get current retry count for a job
   */
  private async getCurrentRetryCount(
    jobId: string,
    businessId: string,
  ): Promise<number> {
    const state = await this.loadState(jobId, businessId);
    return state.totalRetryCount;
  }

  /**
   * Increment retry count and save state
   */
  private async incrementRetryCount(state: AgentJobState): Promise<void> {
    state.totalRetryCount++;
    await this.saveState(state);
  }

  /**
   * Create retry context with state persistence
   */
  private createRetryContext(
    jobId: string,
    businessId: string,
    stage: string,
    state: AgentJobState,
  ): {
    jobId: string;
    stage: string;
    getCurrentRetryCount: () => Promise<number>;
    onRetryAttempt: (attemptNumber: number, error: unknown) => Promise<void>;
  } {
    return {
      jobId,
      stage,
      getCurrentRetryCount: () => this.getCurrentRetryCount(jobId, businessId),
      onRetryAttempt: async (attemptNumber, error) => {
        await this.incrementRetryCount(state);
        this.recordError(state, state.stage, error);
        await this.saveState(state);
        this.logger.log(
          `[${jobId}] Retry attempt ${attemptNumber} for ${stage}, state saved`,
        );
      },
    };
  }

  /**
   * Record an error in the job state
   *
   * Note: retryCount reflects the number of previously persisted errors for this stage,
   * not the number of retry attempts made by RetryPolicy. RetryPolicy retries are logged
   * but not recorded in state.errors until they fail completely.
   *
   * Example: If RetryPolicy retries 2 times and all fail, only 1 error is recorded with retryCount=0
   * (or higher if this stage has failed before in the same job).
   */
  private recordError(
    state: AgentJobState,
    stage: AgentStage,
    error: unknown,
  ): void {
    const message = error instanceof Error ? error.message : String(error);
    const existingErrors = state.errors.filter((e) => e.stage === stage);
    const retryCount = existingErrors.length;

    state.errors.push({
      stage,
      message,
      timestamp: new Date(),
      retryCount,
    });

    this.logger.error(
      `Job ${state.jobId} error at stage ${stage} (attempt ${retryCount + 1}): ${message}`,
    );
  }

  /**
   * Save state to Firestore
   */
  private async saveState(state: AgentJobState): Promise<void> {
    try {
      // Validate IDs before constructing path
      this.validateId(state.businessId);
      this.validateId(state.jobId);

      // Convert Date objects to Firestore Timestamps
      const firestoreState = {
        ...state,
        createdAt: state.createdAt,
        updatedAt: state.updatedAt,
        scenarioGenerationStartedAt: state.scenarioGenerationStartedAt,
        scenarioGenerationCompletedAt: state.scenarioGenerationCompletedAt,
        videoGenerationStartedAt: state.videoGenerationStartedAt,
        videoGenerationCompletedAt: state.videoGenerationCompletedAt,
        scenarioExpiresAt: state.scenarioExpiresAt,
        errors: state.errors.map((e) => ({
          ...e,
          timestamp: e.timestamp,
        })),
        qualityReports: state.qualityReports.map((r) => ({
          ...r,
          checkedAt: r.checkedAt,
        })),
      };

      await this.firestore.set(
        `businesses/${state.businessId}/agent_jobs/${state.jobId}`,
        firestoreState,
      );
    } catch (error) {
      this.logger.error(`Failed to save state for job ${state.jobId}:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        businessId: state.businessId,
        jobId: state.jobId,
        stage: state.stage,
      });
      throw error;
    }
  }

  /**
   * Load state from Firestore
   */
  private async loadState(
    jobId: string,
    businessId: string,
  ): Promise<AgentJobState> {
    this.validateId(jobId);
    this.validateId(businessId);

    // Direct document read instead of collection group query
    const docRef = this.firestore.doc(
      `businesses/${businessId}/agent_jobs/${jobId}`,
    );
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new Error('Job not found');
    }

    const data = doc.data() as AgentJobState;

    // Convert Firestore Timestamps to Date objects
    return {
      ...data,
      createdAt: this.toDate(data.createdAt),
      updatedAt: this.toDate(data.updatedAt),
      scenarioGenerationStartedAt: data.scenarioGenerationStartedAt
        ? this.toDate(data.scenarioGenerationStartedAt)
        : undefined,
      scenarioGenerationCompletedAt: data.scenarioGenerationCompletedAt
        ? this.toDate(data.scenarioGenerationCompletedAt)
        : undefined,
      videoGenerationStartedAt: data.videoGenerationStartedAt
        ? this.toDate(data.videoGenerationStartedAt)
        : undefined,
      videoGenerationCompletedAt: data.videoGenerationCompletedAt
        ? this.toDate(data.videoGenerationCompletedAt)
        : undefined,
      scenarioExpiresAt: data.scenarioExpiresAt
        ? this.toDate(data.scenarioExpiresAt)
        : undefined,
      errors: data.errors.map((e) => ({
        ...e,
        timestamp: this.toDate(e.timestamp),
      })),
      qualityReports: data.qualityReports.map((r) => ({
        ...r,
        checkedAt: this.toDate(r.checkedAt),
      })),
    };
  }

  /**
   * Convert Firestore Timestamp to Date
   */
  private toDate(value: unknown): Date {
    if (value instanceof Date) {
      return value;
    }
    // Firestore Timestamp has toDate() method
    if (value && typeof value === 'object' && 'toDate' in value) {
      return (value as { toDate: () => Date }).toDate();
    }
    // Fallback to current date if invalid
    return new Date();
  }

  /**
   * Validate ID format (alphanumeric, hyphens, underscores only)
   */
  private validateId(id: string): void {
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid ID');
    }
    if (!/^[a-zA-Z0-9-_]+$/.test(id)) {
      throw new Error('Invalid ID format');
    }
  }
}
