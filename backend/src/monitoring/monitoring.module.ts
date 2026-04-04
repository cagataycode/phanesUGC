import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StructuredLoggerService } from './structured-logger.service';
import { PerformanceMonitorService } from './performance-monitor.service';
import { ErrorTrackerService } from './error-tracker.service';
import { MonitoringTestController } from './monitoring-test.controller';
import { PerformanceInterceptor } from './interceptors/performance.interceptor';

@Module({
  imports: [ConfigModule],
  providers: [
    StructuredLoggerService,
    PerformanceMonitorService,
    ErrorTrackerService,
    PerformanceInterceptor,
  ],
  controllers: [MonitoringTestController],
  exports: [
    StructuredLoggerService,
    PerformanceMonitorService,
    ErrorTrackerService,
    PerformanceInterceptor,
  ],
})
export class MonitoringModule {}
