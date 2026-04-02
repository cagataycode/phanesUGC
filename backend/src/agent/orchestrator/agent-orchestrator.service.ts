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
// TODO: Use OutputValidatorService in Phase 2
// import { OutputValidatorService } from '../stages/output-validator.service';
import { QualityGatesService } from './quality-gates.service';
import { NormalizedRequest } from '../contracts/normalized-request';
import { CreativeBrief } from '../contracts/creative-brief';
import { ProductContext } from '../contracts/product-context';
import { ScenarioSet } from '../contracts/scenario';
import { FinalOutput } from '../contracts/final-output';
import { CreateAdDto } from '../../ads/dto/create-ad.dto';
import { PlatformMapper, AgentConstants } from '../utils';

/**
 * AgentOrchestratorService - Main pipeline controller
 *
 * Orchestrates the two-phase agent pipeline:
 * - Phase 1: Fast scenario generation (< 30s)
 * - Phase 2: Full video generation after user selection (< 10 min)
 */
@Injectable()
export class AgentOrchestratorService {
  private readonly logger = new Logger(AgentOrchestratorService.name);
  private readonly SCENARIO_EXPIRY_HOURS = AgentConstants.SCENARIO_EXPIRY_HOURS;
  // TODO: Implement retry logic in Phase 2
  // private readonly MAX_RETRIES = AgentConstants.MAX_RETRIES;

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
    // TODO: Use outputValidator in Phase 2 for final validation
    // private readonly outputValidator: OutputValidatorService,
    private readonly qualityGates: QualityGatesService,
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
      phase1Status: 'pending',
      phase2Status: 'pending',
      artifacts: {
        normalizedRequest,
      },
      errors: [],
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
   * Run Phase 1 - Fast scenario generation
   *
   * Returns 4 scenarios for user selection
   */
  async runPhase1(jobId: string, businessId: string): Promise<ScenarioSet> {
    this.logger.log(`Starting Phase 1 for job ${jobId}`);

    const state = await this.loadState(jobId, businessId);
    state.phase1Status = 'in_progress';
    state.phase1StartedAt = new Date();
    await this.saveState(state);

    try {
      // Stage 1: Normalize input
      this.logger.debug(`[${jobId}] Starting Stage 1: Normalize input`);
      this.transitionStage(state, 'normalized');
      const normalizedRequest = await this.inputNormalizer.normalize(
        state.jobId,
        state.businessId,
        state.artifacts.normalizedRequest as Record<string, unknown>,
      );
      state.artifacts.normalizedRequest = normalizedRequest;
      this.logger.debug(`[${jobId}] Stage 1 complete, saving state`);
      await this.saveState(state);

      // Stage 2: Acquire product context
      this.logger.debug(`[${jobId}] Starting Stage 2: Acquire product context`);
      this.transitionStage(state, 'context_ready');
      const productContext =
        await this.contextAcquisition.acquire(normalizedRequest);
      state.artifacts.productContext = productContext;
      this.logger.debug(`[${jobId}] Stage 2 complete, saving state`);
      await this.saveState(state);

      // Stage 3: Build creative brief
      this.logger.debug(`[${jobId}] Starting Stage 3: Build creative brief`);
      this.transitionStage(state, 'brief_ready');
      const creativeBrief = await this.briefBuilder.build(
        normalizedRequest,
        productContext,
      );
      state.artifacts.creativeBrief = creativeBrief;
      this.logger.debug(`[${jobId}] Stage 3 complete, saving state`);
      await this.saveState(state);

      // Stage 4: Generate 4 scenarios
      this.logger.debug(`[${jobId}] Starting Stage 4: Generate scenarios`);
      this.transitionStage(state, 'scenarios_ready');
      const scenarioSet = await this.scenarioGenerator.generate(
        state.jobId,
        creativeBrief,
      );
      state.artifacts.scenarioSet = scenarioSet;

      // Set scenario expiry
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.SCENARIO_EXPIRY_HOURS);
      state.scenarioExpiresAt = expiresAt;

      state.phase1Status = 'completed';
      state.phase1CompletedAt = new Date();
      await this.saveState(state);

      this.logger.log(`Phase 1 completed for job ${jobId}`);
      return scenarioSet;
    } catch (error) {
      state.phase1Status = 'failed';
      this.recordError(state, state.stage, error);

      // Log full error details for debugging
      this.logger.error(`Phase 1 failed for job ${jobId}:`, {
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
   * Select a scenario and trigger Phase 2
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

    // Check if Phase 2 is already running
    if (state.phase2Status === 'in_progress') {
      throw new Error('Video generation already in progress');
    }

    state.selectedScenarioId = scenarioId;
    this.transitionStage(state, 'scenario_selected');
    await this.saveState(state);

    // Start Phase 2 asynchronously
    void this.runPhase2(jobId, businessId);
  }

  /**
   * Run Phase 2 - Full video generation
   *
   * Generates the final video for the selected scenario
   */
  async runPhase2(jobId: string, businessId: string): Promise<FinalOutput> {
    this.logger.log(`Starting Phase 2 for job ${jobId}`);

    const state = await this.loadState(jobId, businessId);
    state.phase2Status = 'in_progress';
    state.phase2StartedAt = new Date();
    await this.saveState(state);

    try {
      // Validate selected scenario
      if (!state.selectedScenarioId) {
        throw new Error('No scenario selected');
      }

      // Stage 5: Generate script
      this.transitionStage(state, 'script_ready');
      const creativeBrief = state.artifacts.creativeBrief as CreativeBrief;
      const adScript = await this.scriptGenerator.generateFromBrief(
        state.jobId,
        state.selectedScenarioId,
        creativeBrief,
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

      const veoPrompt = await this.veoPromptBuilder.build(
        state.jobId,
        adScript,
        creativeBrief,
        productContext,
        normalizedRequest,
      );
      state.artifacts.veoPrompt = veoPrompt;
      await this.saveState(state);

      // Stage 7: Generate video with Veo
      this.transitionStage(state, 'veo_generating');
      const veoOutput = await this.videoGenerator.generate(veoPrompt);
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
      const subtitleData = await this.subtitleGenerator.generate(
        state.jobId,
        adScript,
        veoOutput,
      );
      state.artifacts.subtitleData = subtitleData;

      // Quality gate: Subtitles
      const subtitleReport = this.qualityGates.checkSubtitles(subtitleData);
      state.qualityReports.push(subtitleReport);
      await this.saveState(state);

      // Stage 9: Assemble render timeline
      this.transitionStage(state, 'composition_ready');
      const renderTimeline = await this.timelineAssembler.assemble(
        state.jobId,
        veoOutput,
        subtitleData,
        state.artifacts.normalizedRequest as NormalizedRequest,
      );
      state.artifacts.renderTimeline = renderTimeline;
      await this.saveState(state);

      // Stage 10: Render final video
      this.transitionStage(state, 'rendering');
      const finalOutput = await this.renderExecutor.render(renderTimeline);
      this.transitionStage(state, 'completed');

      // Quality gate: Final render
      const renderReport = this.qualityGates.checkFinalRender(finalOutput);
      state.qualityReports.push(renderReport);

      // Calculate overall quality score
      finalOutput.qualityScore = this.qualityGates.calculateQualityScore(
        state.qualityReports,
      );
      finalOutput.qualityReports = state.qualityReports;

      state.artifacts.finalOutput = finalOutput;
      state.phase2Status = 'completed';
      state.phase2CompletedAt = new Date();
      await this.saveState(state);

      this.logger.log(`Phase 2 completed for job ${jobId}`);
      return finalOutput;
    } catch (error) {
      state.phase2Status = 'failed';
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
   * Record an error
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
      `Job ${state.jobId} error at stage ${stage} (retry ${retryCount}): ${message}`,
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
        phase1StartedAt: state.phase1StartedAt,
        phase1CompletedAt: state.phase1CompletedAt,
        phase2StartedAt: state.phase2StartedAt,
        phase2CompletedAt: state.phase2CompletedAt,
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

    return doc.data() as AgentJobState;
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
