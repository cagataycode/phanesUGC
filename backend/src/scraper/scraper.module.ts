/**
 * Scraper Module
 *
 * NestJS module that provides the ScraperService.
 * Registers the service and exports it for use in other modules.
 */

import { Module } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { ScraperController } from './scraper.controller';
import { CrawleeScraperAdapter } from './crawlee-scraper.adapter';

@Module({
  controllers: [ScraperController],
  providers: [
    ScraperService,
    {
      provide: 'SCRAPER_ADAPTER',
      useClass: CrawleeScraperAdapter,
    },
  ],
  exports: [ScraperService, 'SCRAPER_ADAPTER'],
})
export class ScraperModule {}
