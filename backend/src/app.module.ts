import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdsModule } from './ads/ads.module';
import { FirebaseModule } from './firebase/firebase.module';
import { StorageModule } from './storage/storage.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { AvatarsModule } from './avatars/avatars.module';
import { AssetsModule } from './assets/assets.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { PaymentModule } from './payment/payment.module';
import { validateEnv } from './config/env';
import { RenderModule } from './render/render.module';
import { ScraperModule } from './scraper/scraper.module';

/**
 * Create app module imports with conditional PaymentModule
 * Always imports PaymentModule - the module itself will conditionally register
 * Stripe-related providers based on ENABLE_PAYMENTS config
 */
function createAppModuleImports(): any[] {
  return [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
    }),
    FirebaseModule,
    StorageModule,
    AuthModule,
    UsersModule,
    RenderModule,
    AdsModule,
    ProductsModule,
    AvatarsModule,
    AssetsModule,
    ScraperModule,
    MonitoringModule,
    PaymentModule, // Always imported - conditionally registers providers internally
  ];
}

@Module({
  imports: createAppModuleImports(),
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
