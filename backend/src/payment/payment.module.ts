import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FirebaseModule } from '../firebase/firebase.module';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { AuthModule } from '../auth/auth.module';
import { StripeService } from './stripe.service';
import { SubscriptionController } from './subscription.controller';
import { WebhookController } from './webhook.controller';

// Conditionally register payment controllers and providers based on ENABLE_PAYMENTS
// This prevents StripeService from being instantiated when payments are disabled
const paymentsEnabled = process.env.ENABLE_PAYMENTS === 'true';
const paymentControllers = paymentsEnabled
  ? [SubscriptionController, WebhookController]
  : [];
const paymentProviders = paymentsEnabled ? [StripeService] : [];

@Module({
  imports: [ConfigModule, FirebaseModule, MonitoringModule, AuthModule],
  controllers: paymentControllers,
  providers: paymentProviders,
  exports: paymentProviders,
})
export class PaymentModule {}
