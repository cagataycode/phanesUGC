import { Module } from '@nestjs/common';
import { AdsController } from './ads.controller';
import { AdsService } from './ads.service';
import { JobStoreService } from './services/job-store.service';
import { VertexAiService } from '../ai/vertex-ai.service';

@Module({
  controllers: [AdsController],
  providers: [AdsService, JobStoreService, VertexAiService],
  exports: [AdsService, JobStoreService],
})
export class AdsModule {}
