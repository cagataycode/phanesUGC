import { Module } from '@nestjs/common';
import { QuotaService } from './quota.service';
import { RateLimiterService } from './rate-limiter.service';
import { RateLimitInterceptor } from './interceptors/rate-limit.interceptor';
import { FirebaseModule } from '../firebase/firebase.module';
import { MonitoringModule } from '../monitoring/monitoring.module';

@Module({
  imports: [FirebaseModule, MonitoringModule],
  providers: [QuotaService, RateLimiterService, RateLimitInterceptor],
  exports: [QuotaService, RateLimiterService, RateLimitInterceptor],
})
export class QuotaModule {}
