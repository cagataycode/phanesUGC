import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AdsService } from './ads.service';
import { CreateAdDto } from './dto/create-ad.dto';

@Controller('ads')
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  @Post()
  createJob(@Body() createAdDto: CreateAdDto) {
    return this.adsService.createJob(createAdDto);
  }

  @Get(':id')
  getJob(@Param('id') id: string) {
    return this.adsService.getJob(id);
  }
}
