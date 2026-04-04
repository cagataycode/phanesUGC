import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StructuredLoggerService } from './structured-logger.service';
import { PerformanceMonitorService } from './performance-monitor.service';
import { ErrorTrackerService } from './error-tracker.service';
import { CorrelationContextService } from './correlation-context.service';
import { MonitoringTestController } from './monitoring-test.controller';
import { PerformanceInterceptor } from './interceptors/performance.interceptor';

@Module({
  imports: [ConfigModule],
  providers: [
    CorrelationContextService,
    StructuredLoggerService,
    PerformanceMonitorService,
    ErrorTrackerService,
    PerformanceInterceptor,
  ],
  controllers: [MonitoringTestController],
  exports: [
    CorrelationContextService,
    StructuredLoggerService,
    PerformanceMonitorService,
    ErrorTrackerService,
    PerformanceInterceptor,
  ],
})
export class MonitoringModule {}
