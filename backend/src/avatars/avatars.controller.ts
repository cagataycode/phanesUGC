import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { GetUser } from '../auth/get-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AvatarsService } from './avatars.service';
import {
  createAvatarSchema,
  type CreateAvatarDto,
} from './dto/create-avatar.dto';
import {
  updateAvatarSchema,
  type UpdateAvatarDto,
} from './dto/update-avatar.dto';

@Controller('v1/businesses/:businessId/avatars')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class AvatarsController {
  constructor(private readonly avatarsService: AvatarsService) {}

  @Post()
  async create(
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(createAvatarSchema)) dto: CreateAvatarDto,
    @GetUser() user: DecodedIdToken,
  ) {
    const id = await this.avatarsService.create(businessId, user.uid, dto);
    return { id };
  }

  @Get()
  async findAll(@Param('businessId') businessId: string) {
    return this.avatarsService.findAll(businessId);
  }

  @Get(':avatarId')
  async findOne(
    @Param('businessId') businessId: string,
    @Param('avatarId') avatarId: string,
  ) {
    return this.avatarsService.findOne(businessId, avatarId);
  }

  @Patch(':avatarId')
  async update(
    @Param('businessId') businessId: string,
    @Param('avatarId') avatarId: string,
    @Body(new ZodValidationPipe(updateAvatarSchema)) dto: UpdateAvatarDto,
  ) {
    await this.avatarsService.update(businessId, avatarId, dto);
    return { success: true };
  }

  @Delete(':avatarId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async softDelete(
    @Param('businessId') businessId: string,
    @Param('avatarId') avatarId: string,
  ) {
    await this.avatarsService.softDelete(businessId, avatarId);
  }
}
