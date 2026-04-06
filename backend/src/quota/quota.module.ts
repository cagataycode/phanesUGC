import { Module, forwardRef } from '@nestjs/common';
import { QuotaService } from './quota.service';
import { RateLimiterService } from './rate-limiter.service';
import { RateLimitInterceptor } from './interceptors/rate-limit.interceptor';
import { FirebaseModule } from '../firebase/firebase.module';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { CostModule } from '../cost/cost.module';

@Module({
  imports: [FirebaseModule, MonitoringModule, forwardRef(() => CostModule)],
  providers: [QuotaService, RateLimiterService, RateLimitInterceptor],
  exports: [QuotaService, RateLimiterService, RateLimitInterceptor],
})
export class QuotaModule {}
