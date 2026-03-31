/**
 * Scraper Service
 *
 * Main service that orchestrates product page scraping.
 * Uses CheerioCrawler as the fast path and falls back to
 * PlaywrightCrawler for JS-rendered SPAs.
 *
 * Fallback Strategy:
 * 1. Try CheerioCrawler first (fast, no browser overhead)
 * 2. Check if extraction is "sufficient" (has product name + description or meaningful raw text)
 * 3. If not sufficient, fallback to PlaywrightCrawler
 * 4. Return result with status (success/partial/failed)
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  ProductExtraction,
  ScrapeResult,
  ScrapeStatus,
  ScraperOptions,
  DEFAULT_SCRAPER_OPTIONS,
} from './interfaces/product-extraction.interface';
import { scrapeWithCheerio } from './crawlers/cheerio-crawler';
import { scrapeWithPlaywright } from './crawlers/playwright-crawler';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  /**
   * Scrape a single product URL with fallback logic
   */
  async scrape(
    url: string,
    options?: Partial<ScraperOptions>,
  ): Promise<ScrapeResult> {
    const config = { ...DEFAULT_SCRAPER_OPTIONS, ...options };
    const startTime = Date.now();

    this.logger.log(`Scraping URL: ${url}`);

    // Step 1: Try CheerioCrawler first
    this.logger.debug('Attempting CheerioCrawler...');
    const cheerioResult = await scrapeWithCheerio(
      url,
      config.userAgent,
      config.timeoutMs / 1000,
    );

    if (
      cheerioResult.extraction &&
      this.isExtractionSufficient(cheerioResult.extraction)
    ) {
      const duration = Date.now() - startTime;
      this.logger.log(`CheerioCrawler succeeded in ${duration}ms`);

      return {
        sourceUrl: url,
        status: this.determineStatus(cheerioResult.extraction),
        extraction: cheerioResult.extraction,
        scrapedAt: new Date(),
        method: 'cheerio',
        durationMs: duration,
      };
    }

    // Step 2: Check if Playwright fallback is enabled
    if (!config.usePlaywrightFallback) {
      const duration = Date.now() - startTime;
      this.logger.warn(
        `CheerioCrawler extraction insufficient, but Playwright fallback is disabled`,
      );

      return {
        sourceUrl: url,
        status: 'partial',
        extraction: cheerioResult.extraction,
        error: cheerioResult.error?.message || 'Extraction insufficient',
        scrapedAt: new Date(),
        method: 'cheerio',
        durationMs: duration,
      };
    }

    // Step 3: Fallback to PlaywrightCrawler
    this.logger.debug('Falling back to PlaywrightCrawler...');
    const playwrightResult = await scrapeWithPlaywright(
      url,
      config.userAgent,
      30, // Longer timeout for Playwright
    );

    const duration = Date.now() - startTime;

    if (playwrightResult.error) {
      this.logger.error(
        `PlaywrightCrawler failed: ${playwrightResult.error.message}`,
      );

      return {
        sourceUrl: url,
        status: 'failed',
        extraction: null,
        error: playwrightResult.error.message,
        scrapedAt: new Date(),
        method: 'playwright',
        durationMs: duration,
      };
    }

    this.logger.log(`PlaywrightCrawler succeeded in ${duration}ms`);

    return {
      sourceUrl: url,
      status: playwrightResult.extraction
        ? this.determineStatus(playwrightResult.extraction)
        : 'partial',
      extraction: playwrightResult.extraction,
      scrapedAt: new Date(),
      method: 'playwright',
      durationMs: duration,
    };
  }

  /**
   * Scrape multiple product URLs in parallel
   */
  async scrapeMany(
    urls: string[],
    options?: Partial<ScraperOptions>,
  ): Promise<ScrapeResult[]> {
    this.logger.log(`Scraping ${urls.length} URLs...`);

    const results = await Promise.allSettled(
      urls.map((url) => this.scrape(url, options)),
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reason = result.reason as any;

      return {
        sourceUrl: urls[index],
        status: 'failed' as const,
        extraction: null,
        error: reason?.message || 'Unknown error',
        scrapedAt: new Date(),
        method: 'cheerio' as const,
        durationMs: 0,
      };
    });
  }

  /**
   * Check if extraction has sufficient data
   * "Sufficient" = has at least product name + description OR meaningful raw text
   */
  private isExtractionSufficient(extraction: ProductExtraction): boolean {
    // Has product name and description
    if (extraction.productName && extraction.description) {
      return true;
    }

    // Has product name and some raw text
    if (extraction.productName && extraction.rawText.length > 100) {
      return true;
    }

    // Has meaningful raw text and some media
    if (extraction.rawText.length > 500 && extraction.mediaUrls.length > 0) {
      return true;
    }

    return false;
  }

  /**
   * Determine scrape status based on extraction quality
   */
  private determineStatus(extraction: ProductExtraction): ScrapeStatus {
    // Success: has product name and description
    if (extraction.productName && extraction.description) {
      return 'success';
    }

    // Partial: has some data but not complete
    if (
      extraction.productName ||
      extraction.description ||
      extraction.mediaUrls.length > 0
    ) {
      return 'partial';
    }

    // Failed: no meaningful data extracted
    return 'failed';
  }
}
