import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AvatarsController } from './avatars.controller';
import { AvatarsService } from './avatars.service';

@Module({
  imports: [AuthModule],
  controllers: [AvatarsController],
  providers: [AvatarsService],
  exports: [AvatarsService],
})
export class AvatarsModule {}
