import { Module } from '@nestjs/common';
import { AdsController } from './ads.controller';
import { WizardController } from './wizard.controller';
import { AdsService } from './ads.service';
import { JobStoreService } from './services/job-store.service';
import { GcsStorageService } from '../storage/gcs-storage.service';
import { AuthModule } from '../auth/auth.module';
import { AgentModule } from '../agent/agent.module';
import { QuotaModule } from '../quota/quota.module';

@Module({
  imports: [AuthModule, AgentModule, QuotaModule],
  controllers: [AdsController, WizardController],
  providers: [AdsService, JobStoreService, GcsStorageService],
  exports: [AdsService, JobStoreService],
})
export class AdsModule {}
