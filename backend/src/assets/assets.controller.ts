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
import { BusinessOwnershipGuard } from '../auth/business-ownership.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AssetsService } from './assets.service';
import {
  createUploadUrlSchema,
  type CreateUploadUrlDto,
} from './dto/create-upload-url.dto';
import {
  createUploadFromUrlSchema,
  type CreateUploadFromUrlDto,
} from './dto/create-upload-from-url.dto';

@Controller('v1/businesses/:businessId/assets')
@UseGuards(FirebaseAuthGuard, BusinessOwnershipGuard, RolesGuard)
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

  @Post(':entityId/upload-from-url')
  async uploadFromUrl(
    @Param('businessId') businessId: string,
    @Param('entityId') entityId: string,
    @Body(new ZodValidationPipe(createUploadFromUrlSchema))
    dto: CreateUploadFromUrlDto,
  ) {
    return this.assetsService.importFromUrl(businessId, entityId, dto);
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
