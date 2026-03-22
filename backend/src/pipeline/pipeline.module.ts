import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PipelineService } from './pipeline.service';
import { AdsModule } from '../ads/ads.module';
import { AiModule } from '../ai/ai.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [ConfigModule, AdsModule, AiModule, StorageModule],
  providers: [PipelineService],
  exports: [PipelineService],
})
export class PipelineModule {}
