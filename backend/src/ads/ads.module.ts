import { Module } from '@nestjs/common';
import { AdsController } from './ads.controller';
import { AdsService } from './ads.service';
import { JobStoreService } from './services/job-store.service';

@Module({
  controllers: [AdsController],
  providers: [AdsService, JobStoreService],
  exports: [AdsService, JobStoreService],
})
export class AdsModule {}
