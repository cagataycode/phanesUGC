import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FirebaseModule } from '../firebase/firebase.module';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { StripeService } from './stripe.service';
import { SubscriptionController } from './subscription.controller';
import { WebhookController } from './webhook.controller';

@Module({
  imports: [ConfigModule, FirebaseModule, MonitoringModule],
  controllers: [SubscriptionController, WebhookController],
  providers: [StripeService],
  exports: [StripeService],
})
export class PaymentModule {}
