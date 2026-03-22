import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdsController } from './ads.controller';
import { AdsService } from './ads.service';

@Module({
  imports: [ConfigModule],
  controllers: [AdsController],
  providers: [AdsService],
  exports: [AdsService],
})
export class AdsModule {}
