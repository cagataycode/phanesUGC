import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
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
import { StructuredLoggerService } from '../../monitoring/structured-logger.service';
import { PerformanceMonitorService } from '../../monitoring/performance-monitor.service';
import { NormalizedRequest } from '../contracts/normalized-request';
import { CreativeBrief } from '../contracts/creative-brief';
import { ProductContext } from '../contracts/product-context';
import { ScenarioSet } from '../contracts/scenario';
import { FinalOutput } from '../contracts/final-output';
import { AdScript, NarrationLine } from '../contracts/ad-script';
import { VeoPrompt } from '../contracts/veo-prompt';
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
    private readonly structuredLogger: StructuredLoggerService,
    private readonly performanceMonitor: PerformanceMonitorService,
  ) {}

  /**
   * Initialize a new agent job
   */
  async initializeJob(
    jobId: string,
    businessId: string,
    createAdDto: CreateAdDto,
  ): Promise<AgentJobState> {
    // Generate correlation ID for this job
    const correlationId = this.structuredLogger.generateCorrelationId();

    const context = {
      correlationId,
      jobId,
      businessId,
      stage: 'created' as const,
    };

    this.structuredLogger.log('Initializing agent job', context);
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
      correlationId,
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

    this.structuredLogger.log('Agent job initialized successfully', context);

    return state;
  }

  /**
   * Initialize a job from wizard-generated content
   * Skips Phase 1 by pre-populating artifacts
   */
  async initializeFromWizard(
    jobId: string,
    businessId: string,
    wizardData: {
      prompt: string;
      platform: 'tiktok' | 'instagram' | 'youtube';
      language?: string;
      tone?: string;
      targetAudience?: string;
      cta?: string;
      aspectRatio: '9:16' | '1:1' | '16:9';
      subtitleStyle?: 'standard' | 'kinetic';
      brief: Record<string, unknown>;
      script: Record<string, unknown>;
      scene: Record<string, unknown>;
    },
  ): Promise<AgentJobState> {
    this.logger.log(`Initializing wizard job ${jobId}`);

    const now = new Date();

    // Map platform
    const agentPlatform = this.mapPlatform(wizardData.platform);

    // Build normalized request from wizard data
    const normalizedRequest: Partial<NormalizedRequest> = {
      jobId,
      businessId,
      prompt: wizardData.prompt,
      platform: agentPlatform,
      aspectRatio: wizardData.aspectRatio,
      durationSec: ((wizardData.scene as { duration_seconds?: number })
        ?.duration_seconds || 8) as 8,
      language: wizardData.language || 'en',
      tone: wizardData.tone,
      targetAudience: wizardData.targetAudience,
      cta: wizardData.cta,
      subtitleStyle: wizardData.subtitleStyle || 'kinetic',
      disableBackgroundMusic: false,
      disableCaptions: false,
      disableCtaOverlay: false,
    };

    // Build product context from brief if available
    const briefData = wizardData.brief;
    const productContext: Partial<ProductContext> = {
      name: (briefData.product_name || briefData.productName) as string,
      description: (briefData.product_description ||
        briefData.description) as string,
      benefits: (briefData.benefits || briefData.keyBenefits || []) as string[],
    };

    // Map wizard brief to CreativeBrief format
    const creativeBrief: Partial<CreativeBrief> = {
      productName: (briefData.product_name || briefData.productName) as string,
      offer: (briefData.offer || '') as string,
      audience: (briefData.audience ||
        briefData.target_audience ||
        '') as string,
      painPoints: (briefData.pain_points ||
        briefData.painPoints ||
        []) as string[],
      keyBenefits: (briefData.benefits ||
        briefData.keyBenefits ||
        []) as string[],
      tone: (briefData.tone as CreativeBrief['tone']) || 'casual',
      cta: (briefData.cta || '') as string,
      visualStyle:
        ((briefData.visual_style ||
          briefData.visualStyle) as CreativeBrief['visualStyle']) || 'dynamic',
      keyMessage: (briefData.key_message ||
        briefData.keyMessage ||
        '') as string,
      targetPlatform: agentPlatform,
      targetDuration:
        (wizardData.scene as { duration_seconds?: number })?.duration_seconds ||
        8,
      targetAspectRatio: wizardData.aspectRatio,
      language: wizardData.language || 'en',
      createdAt: now,
    };

    // Map wizard script to AdScript format
    const scriptData = wizardData.script;
    const adScript: Partial<AdScript> = {
      jobId,
      scenarioId: 1,
      title: (scriptData.title as string) || 'Wizard Generated Script',
      hook: (scriptData.hook as string) || '',
      voiceoverLines: (scriptData.voiceover_lines ||
        scriptData.voiceoverLines ||
        []) as NarrationLine[],
      cta: (scriptData.cta as string) || '',
      fullText: ((scriptData.full_text || scriptData.fullText) as string) || '',
      visualDescription: (scriptData.visual_description ||
        scriptData.visualDescription) as string,
      totalEstimatedDuration:
        (wizardData.scene as { duration_seconds?: number })?.duration_seconds ||
        8,
      generatedAt: now,
    };

    // Map wizard scene to VeoPrompt format
    const sceneData = wizardData.scene;
    const promptData = (sceneData.prompt || {}) as Record<string, unknown>;
    const veoPrompt: Partial<VeoPrompt> = {
      sceneId: (sceneData.scene_id as number) || 1,
      projectId: jobId,
      durationSeconds: (sceneData.duration_seconds as number) || 8,
      aspectRatio: wizardData.aspectRatio,
      prompt: {
        intent: (promptData.intent as string) || '',
        shot: (promptData.shot as VeoPrompt['prompt']['shot']) || {
          type: 'medium',
          framing: 'center',
          cameraAngle: 'eye_level',
          cameraMotion: 'static',
          lensFeel: 'normal',
          composition: 'rule_of_thirds',
        },
        subject: (promptData.subject as VeoPrompt['prompt']['subject']) || {
          type: 'product',
          description: '',
          action: '',
        },
        environment:
          (promptData.environment as VeoPrompt['prompt']['environment']) || {
            location: '',
            props: [],
            atmosphere: '',
          },
        lighting: (promptData.lighting as VeoPrompt['prompt']['lighting']) || {
          style: 'natural',
          colorTemperature: 'daylight',
        },
        audio: (promptData.audio as VeoPrompt['prompt']['audio']) || {
          speechText: '',
          speechStyle: 'conversational',
        },
        style: (promptData.style as VeoPrompt['prompt']['style']) || {
          visualStyle: 'dynamic',
          colorPalette: 'vibrant',
          renderingQuality: 'high',
          aestheticReference: '',
        },
        textOverlay: ((promptData.text_overlay ||
          promptData.textOverlay) as VeoPrompt['prompt']['textOverlay']) || {
          enabled: false,
        },
        cta: (promptData.cta as VeoPrompt['prompt']['cta']) || {
          enabled: false,
        },
      },
      transitionIn:
        (sceneData.transition_in as VeoPrompt['transitionIn']) || 'cut',
      transitionOut:
        (sceneData.transition_out as VeoPrompt['transitionOut']) || 'cut',
      negativePrompt: (sceneData.negative_prompt as string) || '',
      generationConfig:
        (sceneData.generation_config as VeoPrompt['generationConfig']) || {
          model: 'veo-2.0-generate-001',
          safetyFilter: 'standard',
          retryCount: 3,
          priority: 'normal',
        },
      builtAt: now,
    };

    // Create state with Phase 1 completed
    const state: AgentJobState = {
      jobId,
      businessId,
      stage: 'scenario_selected',
      scenarioGenerationStatus: 'completed',
      videoGenerationStatus: 'pending',
      selectedScenarioId: 1,
      artifacts: {
        normalizedRequest,
        productContext,
        creativeBrief,
        adScript,
        veoPrompt,
      },
      errors: [],
      totalRetryCount: 0,
      qualityReports: [],
      createdAt: now,
      updatedAt: now,
      scenarioGenerationStartedAt: now,
      scenarioGenerationCompletedAt: now,
    };

    await this.saveState(state);
    this.logger.log(
      `Wizard job ${jobId} initialized with pre-generated content`,
    );
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
      const normalizedRequest = await this.retryPolicy.execute(
        () =>
          this.inputNormalizer.normalize(
            state.jobId,
            state.businessId,
            state.artifacts.normalizedRequest as Partial<NormalizedRequest>,
          ),
        this.createRetryContext(
          jobId,
          businessId,
          'normalize',
          state,
          'normalized',
        ),
      );
      this.transitionStage(state, 'normalized');
      state.artifacts.normalizedRequest = normalizedRequest;
      this.logger.debug(`[${jobId}] Stage 1 complete, saving state`);
      await this.saveState(state);

      // Stage 2: Acquire product context (with fallback and idempotency)
      this.logger.debug(`[${jobId}] Starting Stage 2: Acquire product context`);
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
            'context_ready',
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
      this.transitionStage(state, 'context_ready');
      state.artifacts.productContext = productContext;
      this.logger.debug(`[${jobId}] Stage 2 complete, saving state`);
      await this.saveState(state);

      // Stage 3: Build creative brief (with fallback)
      this.logger.debug(`[${jobId}] Starting Stage 3: Build creative brief`);
      let creativeBrief: CreativeBrief;
      try {
        creativeBrief = await this.retryPolicy.execute(
          () => this.briefBuilder.build(normalizedRequest, productContext),
          this.createRetryContext(
            jobId,
            businessId,
            'brief_builder',
            state,
            'brief_ready',
          ),
        );
      } catch (error) {
        // Fallback: Use template brief if generation fails
        creativeBrief = await this.fallbackPolicy.handleBriefFailure(
          normalizedRequest,
          productContext,
          error,
        );
      }
      this.transitionStage(state, 'brief_ready');
      state.artifacts.creativeBrief = creativeBrief;
      this.logger.debug(`[${jobId}] Stage 3 complete, saving state`);
      await this.saveState(state);

      // Stage 4: Generate 4 scenarios (generator has internal fallback on errors)
      this.logger.debug(`[${jobId}] Starting Stage 4: Generate scenarios`);
      const scenarioSet = await this.retryPolicy.execute(
        () => this.scenarioGenerator.generate(state.jobId, creativeBrief),
        this.createRetryContext(
          jobId,
          businessId,
          'scenario_generator',
          state,
          'scenarios_ready',
        ),
      );
      this.transitionStage(state, 'scenarios_ready');
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
   * Uses Firestore transaction to prevent race conditions
   */
  async selectScenario(
    jobId: string,
    businessId: string,
    scenarioId: number,
  ): Promise<void> {
    this.logger.log(`Scenario ${scenarioId} selected for job ${jobId}`);

    // Validate IDs before constructing path
    this.validateId(jobId);
    this.validateId(businessId);

    const docPath = `businesses/${businessId}/agent_jobs/${jobId}`;
    const docRef = this.firestore.doc(docPath);

    // Use Firestore transaction for atomic read-check-write
    await this.firestore.runTransaction(
      async (transaction: admin.firestore.Transaction) => {
        const doc = await transaction.get(docRef);

        if (!doc.exists) {
          throw new Error('Job not found');
        }

        const data = doc.data() as AgentJobState;

        // Validate scenario selection
        if (data.stage !== 'scenarios_ready') {
          throw new Error('Invalid job state for scenario selection');
        }

        if (data.scenarioExpiresAt) {
          const expiresAt = this.toDate(data.scenarioExpiresAt);
          if (new Date() > expiresAt) {
            throw new Error('Scenario selection has expired');
          }
        }

        // Validate scenarioId is 1-4
        if (!Number.isInteger(scenarioId) || scenarioId < 1 || scenarioId > 4) {
          throw new Error('Invalid scenario selection');
        }

        // Validate scenario exists in generated set
        const scenarioSet = data.artifacts.scenarioSet as ScenarioSet;
        if (!scenarioSet?.scenarios?.find((s) => s.scenarioId === scenarioId)) {
          throw new Error('Selected scenario not found');
        }

        // CRITICAL: Check if video generation is already running (race condition prevention)
        if (data.videoGenerationStatus === 'in_progress') {
          this.logger.warn(
            `Video generation already in progress for job ${jobId}, ignoring duplicate request`,
          );
          throw new Error('Video generation already in progress');
        }

        // CRITICAL: Check if video generation is already completed
        if (data.videoGenerationStatus === 'completed') {
          this.logger.warn(
            `Video generation already completed for job ${jobId}, ignoring duplicate request`,
          );
          throw new Error('Video generation already completed');
        }

        // Atomic update: set selected scenario and mark as in_progress
        transaction.update(docRef, {
          selectedScenarioId: scenarioId,
          videoGenerationStatus: 'in_progress',
          videoGenerationStartedAt: new Date(),
          stage: 'scenario_selected',
          updatedAt: new Date(),
        });
      },
    );

    // Start video generation asynchronously (after transaction commits)
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

    // Double-check status (defense in depth)
    if (state.videoGenerationStatus === 'completed') {
      this.logger.warn(
        `Video generation already completed for job ${jobId}, skipping`,
      );
      return state.artifacts.finalOutput as FinalOutput;
    }

    // Ensure status is set to in_progress and start timestamp exists
    if (
      state.videoGenerationStatus !== 'in_progress' ||
      !state.videoGenerationStartedAt
    ) {
      state.videoGenerationStatus = 'in_progress';
      if (!state.videoGenerationStartedAt) {
        state.videoGenerationStartedAt = new Date();
      }
      await this.saveState(state);
    }

    try {
      // Validate selected scenario
      if (!state.selectedScenarioId) {
        throw new Error('No scenario selected');
      }

      // Stage 5: Generate script
      const creativeBrief = state.artifacts.creativeBrief as CreativeBrief;
      const adScript = await this.retryPolicy.execute(
        () =>
          this.scriptGenerator.generateFromBrief(
            state.jobId,
            state.selectedScenarioId!,
            creativeBrief,
          ),
        this.createRetryContext(
          jobId,
          businessId,
          'script_generator',
          state,
          'script_ready',
        ),
      );
      this.transitionStage(state, 'script_ready');
      state.artifacts.adScript = adScript;

      // Quality gate: Script
      const scriptReport = this.qualityGates.checkScript(
        adScript,
        (state.artifacts.normalizedRequest as NormalizedRequest).durationSec,
      );
      state.qualityReports.push(scriptReport);
      await this.saveState(state);

      // Stage 6: Build Veo prompt
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
        this.createRetryContext(
          jobId,
          businessId,
          'veo_prompt_builder',
          state,
          'veo_prompt_ready',
        ),
      );
      this.transitionStage(state, 'veo_prompt_ready');
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
        this.createRetryContext(
          jobId,
          businessId,
          'video_generator',
          state,
          'veo_output_ready',
        ),
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
      const subtitleData = await this.retryPolicy.execute(
        () =>
          this.subtitleGenerator.generate(
            state.jobId,
            adScript,
            veoOutput,
            normalizedRequest.subtitleStyle,
          ),
        this.createRetryContext(
          jobId,
          businessId,
          'subtitle_generator',
          state,
          'subtitles_ready',
        ),
      );
      this.transitionStage(state, 'subtitles_ready');
      state.artifacts.subtitleData = subtitleData;

      // Quality gate: Subtitles
      const subtitleReport = this.qualityGates.checkSubtitles(subtitleData);
      state.qualityReports.push(subtitleReport);
      await this.saveState(state);

      // Stage 9: Assemble render timeline
      const renderTimeline = await this.retryPolicy.execute(
        () =>
          this.timelineAssembler.assemble(
            state.jobId,
            veoOutput,
            subtitleData,
            state.artifacts.normalizedRequest as NormalizedRequest,
          ),
        this.createRetryContext(
          jobId,
          businessId,
          'timeline_assembler',
          state,
          'composition_ready',
        ),
      );
      this.transitionStage(state, 'composition_ready');
      state.artifacts.renderTimeline = renderTimeline;
      await this.saveState(state);

      // Stage 10: Render final video
      this.transitionStage(state, 'rendering');
      const finalOutput = await this.retryPolicy.execute(
        () => this.renderExecutor.render(renderTimeline),
        this.createRetryContext(
          jobId,
          businessId,
          'render_executor',
          state,
          'completed',
        ),
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
   * Create retry context with state persistence
   */
  private createRetryContext(
    jobId: string,
    businessId: string,
    stageName: string,
    state: AgentJobState,
    targetStage: AgentStage,
  ): {
    jobId: string;
    stage: string;
    getCurrentRetryCount: () => Promise<number>;
    onRetryAttempt: (attemptNumber: number, error: unknown) => Promise<void>;
  } {
    return {
      jobId,
      stage: stageName,
      getCurrentRetryCount: () => this.getCurrentRetryCount(jobId, businessId),
      onRetryAttempt: async (attemptNumber, error) => {
        // Increment retry count and record error against the target stage
        state.totalRetryCount++;
        this.recordError(state, targetStage, error);
        // Single saveState call
        await this.saveState(state);
        this.logger.log(
          `[${jobId}] Retry attempt ${attemptNumber} for ${stageName}, state saved`,
        );
      },
    };
  }

  /**
   * Record an error in the job state
   *
   * Note: With state persistence during retries (Phase 3), errors are now recorded
   * on each retry attempt, not just final failures. The retryCount field reflects
   * the number of previously persisted errors for this stage.
   *
   * Example: If RetryPolicy retries 1 time and both attempts fail, 2 errors are recorded
   * (one with retryCount=0 for first attempt, one with retryCount=1 for retry).
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
