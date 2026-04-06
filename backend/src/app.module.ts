import { Module, DynamicModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
import { validateEnv, Env } from './config/env';
import { RenderModule } from './render/render.module';
import { ScraperModule } from './scraper/scraper.module';

/**
 * Create app module imports with conditional PaymentModule
 * NOTE: This reads from process.env before ConfigModule loads .env files,
 * so ENABLE_PAYMENTS must be set as an actual environment variable, not just in .env files
 */
function createAppModuleImports(): any[] {
  const imports: any[] = [
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
  ];

  // Conditionally add PaymentModule if payments are enabled
  // NOTE: This checks process.env directly before .env files are loaded
  // For production, set ENABLE_PAYMENTS as an environment variable
  // For local dev, it will be loaded from .env files during ConfigModule initialization
  const enablePayments = process.env.ENABLE_PAYMENTS === 'true';
  if (enablePayments) {
    imports.push(PaymentModule);
  }

  return imports;
}

@Module({
  imports: createAppModuleImports(),
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  static forRoot(): DynamicModule {
    return {
      module: AppModule,
      imports: createAppModuleImports(),
      controllers: [AppController],
      providers: [AppService],
    };
  }
}
