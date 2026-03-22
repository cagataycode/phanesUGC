import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdsController } from './ads.controller';
import { AdsService } from './ads.service';
import { PipelineModule } from '../pipeline/pipeline.module';

@Module({
  imports: [ConfigModule, PipelineModule],
  controllers: [AdsController],
  providers: [AdsService],
  exports: [AdsService],
})
export class AdsModule {}
