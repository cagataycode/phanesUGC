import { Injectable } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { ScraperAdapter, ScrapeResult } from './interfaces/product-extraction.interface';

@Injectable()
export class CrawleeScraperAdapter implements ScraperAdapter {
  constructor(private readonly scraperService: ScraperService) {}

  async scrape(url: string): Promise<ScrapeResult> {
    return this.scraperService.scrape(url);
  }

  async scrapeMany(urls: string[]): Promise<ScrapeResult[]> {
    return this.scraperService.scrapeMany(urls);
  }
}
