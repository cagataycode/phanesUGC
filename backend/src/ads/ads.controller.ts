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
import { WizardSubmitSchema } from './dto/wizard.dto';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@Controller('ads')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  @Post()
  async createJob(@Body() createAdDto: CreateAdDto) {
    return this.adsService.createJob(createAdDto);
  }

  @Get()
  async listJobs(@Query('businessId') businessId: string) {
    return this.adsService.listJobs(businessId);
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

  @Post(':id/select')
  async selectScenario(
    @Param('id') id: string,
    @Body() body: { scenarioId: number },
    @Query('businessId') businessId: string,
  ) {
    await this.adsService.selectScenario(businessId, id, body.scenarioId);
    return { id, status: 'phase2_started' };
  }

  @Post('wizard')
  async createWizardJob(@Body() wizardDto: Record<string, unknown>) {
    const parsed = WizardSubmitSchema.parse(wizardDto);
    return this.adsService.createWizardJob(parsed);
  }
}
