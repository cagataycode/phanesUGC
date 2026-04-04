import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StructuredLoggerService } from './structured-logger.service';
import { PerformanceMonitorService } from './performance-monitor.service';
import { ErrorTrackerService } from './error-tracker.service';
import { MonitoringTestController } from './monitoring-test.controller';

@Module({
  imports: [ConfigModule],
  providers: [
    StructuredLoggerService,
    PerformanceMonitorService,
    ErrorTrackerService,
  ],
  controllers: [MonitoringTestController],
  exports: [
    StructuredLoggerService,
    PerformanceMonitorService,
    ErrorTrackerService,
  ],
})
export class MonitoringModule {}
