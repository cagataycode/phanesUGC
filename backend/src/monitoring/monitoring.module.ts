import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StructuredLoggerService } from './structured-logger.service';
import { PerformanceMonitorService } from './performance-monitor.service';
import { ErrorTrackerService } from './error-tracker.service';
import { CorrelationContextService } from './correlation-context.service';
import { PerformanceInterceptor } from './interceptors/performance.interceptor';
import { AuditLoggerService } from './audit-logger.service';
import { FirebaseModule } from '../firebase/firebase.module';

@Global()
@Module({
  imports: [ConfigModule, FirebaseModule],
  providers: [
    CorrelationContextService,
    StructuredLoggerService,
    PerformanceMonitorService,
    ErrorTrackerService,
    PerformanceInterceptor,
    AuditLoggerService,
  ],
  exports: [
    CorrelationContextService,
    StructuredLoggerService,
    PerformanceMonitorService,
    ErrorTrackerService,
    PerformanceInterceptor,
    AuditLoggerService,
  ],
})
export class MonitoringModule {}
