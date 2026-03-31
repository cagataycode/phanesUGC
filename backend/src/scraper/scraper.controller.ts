import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { ScrapeRequestDto, ScrapeRequestSchema } from './dto/scrape-request.dto';
import { ScrapeResultDto } from './dto/scrape-result.dto';

@Controller('scraper')
export class ScraperController {
  constructor(private readonly scraperService: ScraperService) {}

  @Post('scrape')
  async scrapeUrl(@Body() body: Record<string, any>): Promise<ScrapeResultDto> {
    const parseResult = ScrapeRequestSchema.safeParse(body);
    
    if (!parseResult.success) {
      throw new HttpException(
        {
          status: HttpStatus.BAD_REQUEST,
          error: 'Validation failed',
          details: parseResult.error.format(),
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const { url, ...options } = parseResult.data;
    
    try {
      const result = await this.scraperService.scrape(url, options);
      return result;
    } catch (error) {
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Scraping failed',
          details: error instanceof Error ? error.message : String(error),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
