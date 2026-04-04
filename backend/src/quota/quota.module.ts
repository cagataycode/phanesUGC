import { Module } from '@nestjs/common';
import { QuotaService } from './quota.service';
import { RateLimiterService } from './rate-limiter.service';
import { FirebaseModule } from '../firebase/firebase.module';
import { MonitoringModule } from '../monitoring/monitoring.module';

@Module({
  imports: [FirebaseModule, MonitoringModule],
  providers: [QuotaService, RateLimiterService],
  exports: [QuotaService, RateLimiterService],
})
export class QuotaModule {}
