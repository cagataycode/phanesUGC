import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LlmService } from './llm.service';
import { VeoService } from './veo.service';
import { ImagenService } from './imagen.service';

@Module({
  imports: [ConfigModule],
  providers: [LlmService, VeoService, ImagenService],
  exports: [LlmService, VeoService, ImagenService],
})
export class AiModule {}
