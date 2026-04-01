import { Module } from '@nestjs/common';
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
import { FirebaseModule } from '../firebase/firebase.module';
import { StorageModule } from '../storage/storage.module';
import { GeminiService } from '../ai/gemini.service';

/**
 * AgentModule - AI Ad Agent orchestration system
 *
 * Implements a two-phase pipeline:
 * - Phase 1: Fast scenario generation (< 30s)
 * - Phase 2: Full video generation after user selection (< 10 min)
 */
@Module({
  imports: [FirebaseModule, StorageModule],
  providers: [
    // AI Services
    GeminiService,

    // Core orchestrator
    AgentOrchestratorService,
    QualityGatesService,

    // Stage services
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
  ],
  exports: [AgentOrchestratorService],
})
export class AgentModule {}
