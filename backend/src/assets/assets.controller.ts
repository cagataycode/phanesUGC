import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AssetsService } from './assets.service';
import {
  createUploadUrlSchema,
  type CreateUploadUrlDto,
} from './dto/create-upload-url.dto';

@Controller('v1/businesses/:businessId/assets')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post(':entityId/upload-url')
  async createUploadUrl(
    @Param('businessId') businessId: string,
    @Param('entityId') entityId: string,
    @Body(new ZodValidationPipe(createUploadUrlSchema)) dto: CreateUploadUrlDto,
  ) {
    return this.assetsService.createUploadUrl(businessId, entityId, dto);
  }

  @Get('download-url')
  async createDownloadUrl(
    @Param('businessId') _businessId: string,
    @Query('storageKey') storageKey: string,
  ) {
    if (!storageKey) {
      return { downloadUrl: null };
    }
    return this.assetsService.createDownloadUrl(storageKey);
  }
}
