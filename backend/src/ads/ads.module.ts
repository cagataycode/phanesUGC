import { Module } from '@nestjs/common';
import { AdsController } from './ads.controller';
import { AdsService } from './ads.service';
import { BriefGenerationService } from './services/brief-generation.service';
import { JobStoreService } from './services/job-store.service';
import { ScriptGenerationService } from './services/script-generation.service';
import { VertexAiService } from '../ai/vertex-ai.service';
import { GcsStorageService } from '../storage/gcs-storage.service';
import { RenderModule } from '../render/render.module';

@Module({
  imports: [RenderModule],
  controllers: [AdsController],
  providers: [
    AdsService,
    BriefGenerationService,
    JobStoreService,
    ScriptGenerationService,
    VertexAiService,
    GcsStorageService,
  ],
  exports: [AdsService, JobStoreService],
})
export class AdsModule {}
