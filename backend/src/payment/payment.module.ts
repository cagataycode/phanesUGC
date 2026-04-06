import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FirebaseModule } from '../firebase/firebase.module';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { AuthModule } from '../auth/auth.module';
import { StripeService } from './stripe.service';
import { SubscriptionController } from './subscription.controller';
import { WebhookController } from './webhook.controller';

// Always register payment module - StripeService will validate config at runtime
// and throw clear errors if ENABLE_PAYMENTS=true but Stripe config is missing
@Module({
  imports: [ConfigModule, FirebaseModule, MonitoringModule, AuthModule],
  controllers: [SubscriptionController, WebhookController],
  providers: [StripeService],
  exports: [StripeService],
})
export class PaymentModule {}
