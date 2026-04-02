import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentOrchestratorService } from './orchestrator/agent-orchestrator.service';
import { InputNormalizerService } from './stages/input-normalizer.service';
import { ContextAcquisitionService } from './stages/context-acquisition.service';
import { ScenarioGeneratorService } from './stages/scenario-generator.service';
import { VideoGeneratorService } from './stages/video-generator.service';
import { SubtitleGeneratorService } from './stages/subtitle-generator.service';
import { TimelineAssemblerService } from './stages/timeline-assembler.service';
import { RenderExecutorService } from './stages/render-executor.service';
import { OutputValidatorService } from './stages/output-validator.service';
import { QualityGatesService } from './orchestrator/quality-gates.service';
import { FirebaseModule } from '../firebase/firebase.module';
import { StorageModule } from '../storage/storage.module';
import { ScraperModule } from '../scraper/scraper.module';
import { RenderModule } from '../render/render.module';
import { GeminiService } from '../ai/gemini.service';
import { VertexAiService } from '../ai/vertex-ai.service';

// Import existing ads services instead of duplicating
import { BriefGenerationService } from '../ads/services/brief-generation.service';
import { ScriptGenerationService } from '../ads/services/script-generation.service';
import { SceneStructuringService } from '../ads/services/scene-structuring.service';
import { VeoPromptBuilderService as AdsVeoPromptBuilderService } from '../ads/services/veo-prompt-builder.service';

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

    // Agent-specific stage services
    InputNormalizerService,
    ContextAcquisitionService,
    ScenarioGeneratorService,
    VideoGeneratorService,
    SubtitleGeneratorService,
    TimelineAssemblerService,
    RenderExecutorService,
    OutputValidatorService,

    // Reuse existing ads services
    BriefGenerationService,
    ScriptGenerationService,
    SceneStructuringService,
    AdsVeoPromptBuilderService,
  ],
  exports: [AgentOrchestratorService],
})
export class AgentModule {}
