import { Module } from '@nestjs/common';
import { AdsController } from './ads.controller';
import { AdsService } from './ads.service';
import { BriefGenerationService } from './services/brief-generation.service';
import { JobStoreService } from './services/job-store.service';
import { ScriptGenerationService } from './services/script-generation.service';
import { SceneStructuringService } from './services/scene-structuring.service';
import { VeoPromptBuilderService } from './services/veo-prompt-builder.service';
import { VertexAiService } from '../ai/vertex-ai.service';
import { GeminiService } from '../ai/gemini.service';
import { GcsStorageService } from '../storage/gcs-storage.service';
import { RenderModule } from '../render/render.module';
import { AuthModule } from '../auth/auth.module';
import { VideoUtilsService } from '../common/video-utils.service';

@Module({
  imports: [RenderModule, AuthModule],
  controllers: [AdsController],
  providers: [
    AdsService,
    BriefGenerationService,
    JobStoreService,
    ScriptGenerationService,
    SceneStructuringService,
    VeoPromptBuilderService,
    VertexAiService,
    GeminiService,
    GcsStorageService,
    VideoUtilsService,
  ],
  exports: [AdsService, JobStoreService],
})
export class AdsModule {}
