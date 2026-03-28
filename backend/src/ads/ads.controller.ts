import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdsService } from './ads.service';
import { CreateAdDto } from './dto/create-ad.dto';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';

@Controller('ads')
@UseGuards(FirebaseAuthGuard)
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  @Post()
  async createJob(@Body() createAdDto: CreateAdDto) {
    return this.adsService.createJob(createAdDto);
  }

  @Get(':id')
  async getJob(
    @Param('id') id: string,
    @Query('businessId') businessId: string,
  ) {
    return this.adsService.getJob(businessId, id);
  }

  @Get(':id/result')
  async getJobResult(
    @Param('id') id: string,
    @Query('businessId') businessId: string,
  ) {
    return this.adsService.getJobResult(businessId, id);
  }
}
