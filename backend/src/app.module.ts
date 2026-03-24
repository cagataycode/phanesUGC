import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdsModule } from './ads/ads.module';

@Module({
  imports: [AdsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
