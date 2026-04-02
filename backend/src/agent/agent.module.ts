import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentOrchestratorService } from './orchestrator/agent-orchestrator.service';
import { InputNormalizerService } from './stages/input-normalizer.service';
import { ContextAcquisitionService } from './stages/context-acquisition.service';
import { BriefBuilderService } from './stages/brief-builder.service';
import { ScenarioGeneratorService } from './stages/scenario-generator.service';
import { ScriptGeneratorService } from './stages/script-generator.service';
import { VeoPromptBuilderService } from './stages/veo-prompt-builder.service';
import { VideoGeneratorService } from './stages/video-generator.service';
import { SubtitleGeneratorService } from './stages/subtitle-generator.service';
import { TimelineAssemblerService } from './stages/timeline-assembler.service';
import { RenderExecutorService } from './stages/render-executor.service';
import { OutputValidatorService } from './stages/output-validator.service';
import { QualityGatesService } from './orchestrator/quality-gates.service';
import { RetryPolicy } from './policies/retry-policy';
import { FallbackPolicy } from './policies/fallback-policy';
import { AgentConstants } from './utils';
import { FirebaseModule } from '../firebase/firebase.module';
import { StorageModule } from '../storage/storage.module';
import { ScraperModule } from '../scraper/scraper.module';
import { RenderModule } from '../render/render.module';
import { GeminiService } from '../ai/gemini.service';
import { VertexAiService } from '../ai/vertex-ai.service';

// Import existing ads services that the adapters use
import { BriefGenerationService } from '../ads/services/brief-generation.service';
import { ScriptGenerationService } from '../ads/services/script-generation.service';
import { SceneStructuringService } from '../ads/services/scene-structuring.service';

/**
 * AgentModule - AI Ad Agent orchestration system
 *
 * Implements a two-phase pipeline:
 * - Phase 1: Fast scenario generation (< 30s)
 * - Phase 2: Full video generation after user selection (< 10 min)
 *
 * Uses existing ads services for brief, script, and scene generation
 * to avoid duplication and maintain consistency.
 */
@Module({
  imports: [
    ConfigModule,
    FirebaseModule,
    StorageModule,
    ScraperModule,
    RenderModule,
  ],
  providers: [
    // AI Services
    GeminiService,
    VertexAiService,

    // Core orchestrator
    AgentOrchestratorService,
    QualityGatesService,

    // Policies
    {
      provide: RetryPolicy,
      useFactory: () =>
        new RetryPolicy({
          maxRetries: AgentConstants.MAX_RETRIES,
          initialDelayMs: AgentConstants.RETRY_DELAY_MS,
          backoffMultiplier: AgentConstants.RETRY_BACKOFF_MULTIPLIER,
          retryableErrors: [
            'timeout',
            'rate limit',
            'network error',
            'ECONNRESET',
            'ETIMEDOUT',
            'ENOTFOUND',
            '429',
            '503',
            '504',
          ],
        }),
    },
    {
      provide: FallbackPolicy,
      useFactory: () =>
        new FallbackPolicy({
          enableFallbacks: true,
          logFallbacks: true,
        }),
    },

    // Agent-specific stage services
    InputNormalizerService,
    ContextAcquisitionService,
    BriefBuilderService,
    ScenarioGeneratorService,
    ScriptGeneratorService,
    VeoPromptBuilderService,
    VideoGeneratorService,
    SubtitleGeneratorService,
    TimelineAssemblerService,
    RenderExecutorService,
    OutputValidatorService,

    // Reuse existing ads services (used by adapters)
    BriefGenerationService,
    ScriptGenerationService,
    SceneStructuringService,
  ],
  exports: [AgentOrchestratorService],
})
export class AgentModule {}
