import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AdsModule } from './ads/ads.module';
import { AiModule } from './ai/ai.module';
import { StorageModule } from './storage/storage.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { initializeFirebase } from './config/firebase.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AdsModule,
    AiModule,
    StorageModule,
    PipelineModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useValue: [],
    },
    {
      provide: APP_FILTER,
      useValue: [],
    },
  ],
})
export class AppModule {
  constructor(private configService: ConfigService) {
    // Initialize Firebase on app startup
    this.initializeFirebase();
  }

  private initializeFirebase(): void {
    try {
      const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
      const config = {
        projectId: projectId || '',
        privateKey: this.configService.get<string>('FIREBASE_PRIVATE_KEY') || '',
        clientEmail: this.configService.get<string>('FIREBASE_CLIENT_EMAIL') || '',
        storageBucket: this.configService.get<string>('GCS_BUCKET_NAME') || '',
};

      if (config.projectId && config.privateKey && config.clientEmail) {
        initializeFirebase(config);
        console.log('Firebase initialized successfully');
      } else {
        console.warn('Firebase credentials not configured - running in mock mode');
      }
    } catch (error) {
      console.error('Failed to initialize Firebase:', error);
    }
  }
}
