import { Module } from '@nestjs/common';
import { CostTrackerService } from './cost-tracker.service';
import { FirebaseModule } from '../firebase/firebase.module';
import { MonitoringModule } from '../monitoring/monitoring.module';

@Module({
  imports: [FirebaseModule, MonitoringModule],
  providers: [CostTrackerService],
  exports: [CostTrackerService],
})
export class CostModule {}
