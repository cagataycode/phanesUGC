import { Injectable, Logger } from '@nestjs/common';
import { NormalizedRequest } from '../contracts/normalized-request';
import { ProductContext } from '../contracts/product-context';
import { ScraperService } from '../../scraper/scraper.service';
import { ScrapeResult } from '../../scraper/interfaces/product-extraction.interface';

/**
 * ContextAcquisitionService - Scrapes URLs and merges with manual input
 *
 * Enriches product data by scraping provided URLs
 */
@Injectable()
export class ContextAcquisitionService {
  private readonly logger = new Logger(ContextAcquisitionService.name);

  constructor(private readonly scraper: ScraperService) {}

  async acquire(request: NormalizedRequest): Promise<ProductContext> {
    this.logger.log(`Acquiring context for job ${request.jobId}`);

    const hasUrls = request.product?.urls && request.product.urls.length > 0;

    // Case 1: No URLs provided - use manual input only
    if (!hasUrls) {
      this.logger.debug('No URLs provided, using manual input only');
      return this.buildManualContext(request);
    }

    // Case 2: URLs provided - scrape and merge with manual
    try {
      const scrapeResults = await this.scraper.scrapeMany(
        request.product!.urls!,
        {
          usePlaywrightFallback: true,
          extractBrandColors: true,
          timeoutMs: 15000,
        },
      );

      // Find the best scrape result (success > partial > failed)
      const bestResult = this.selectBestScrapeResult(scrapeResults);

      if (!bestResult || bestResult.status === 'failed') {
        this.logger.warn('All scrapes failed, falling back to manual input');
        return this.buildManualContext(request);
      }

      // Merge scraped data with manual input
      return this.mergeScrapedAndManual(request, bestResult, scrapeResults);
    } catch (error) {
      this.logger.error(
        `Scraping failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Fallback to manual input on scraping error
      return this.buildManualContext(request);
    }
  }

  /**
   * Build context from manual input only
   */
  private buildManualContext(request: NormalizedRequest): ProductContext {
    return {
      source: 'manual',
      name: request.product?.name || 'Unknown Product',
      description: request.product?.description || '',
      benefits: request.product?.benefits || [],
      pricing: request.product?.pricing,
      offers: request.product?.offers,
      acquiredAt: new Date(),
    };
  }

  /**
   * Select the best scrape result from multiple attempts
   * Priority: success > partial > failed
   */
  private selectBestScrapeResult(results: ScrapeResult[]): ScrapeResult | null {
    const successResults = results.filter((r) => r.status === 'success');
    if (successResults.length > 0) {
      return successResults[0];
    }

    const partialResults = results.filter((r) => r.status === 'partial');
    if (partialResults.length > 0) {
      return partialResults[0];
    }

    return results[0] || null;
  }

  /**
   * Merge scraped data with manual input
   * Manual input takes precedence when both exist
   */
  private mergeScrapedAndManual(
    request: NormalizedRequest,
    bestResult: ScrapeResult,
    allResults: ScrapeResult[],
  ): ProductContext {
    const extraction = bestResult.extraction;
    const manual = request.product;

    // Merge benefits from all successful scrapes
    const allBenefits = new Set<string>();
    for (const result of allResults) {
      if (result.extraction?.benefits) {
        result.extraction.benefits.forEach((b) => allBenefits.add(b));
      }
    }

    // Merge media URLs from all scrapes
    const imageUrls: string[] = [];
    const videoUrls: string[] = [];
    for (const result of allResults) {
      if (result.extraction?.mediaUrls) {
        for (const media of result.extraction.mediaUrls) {
          if (media.type === 'image') {
            imageUrls.push(media.url);
          } else if (media.type === 'video') {
            videoUrls.push(media.url);
          }
        }
      }
    }

    // Merge reviews from all scrapes
    const allReviews: string[] = [];
    for (const result of allResults) {
      if (result.extraction?.reviews) {
        allReviews.push(...result.extraction.reviews.map((r) => r.text));
      }
    }

    const context: ProductContext = {
      source: manual?.name || manual?.description ? 'merged' : 'scraped',
      name: manual?.name || extraction?.productName || 'Unknown Product',
      description:
        manual?.description ||
        extraction?.description ||
        extraction?.rawText ||
        '',
      benefits: [...(manual?.benefits || []), ...Array.from(allBenefits)].slice(
        0,
        10,
      ),
      pricing: manual?.pricing || extraction?.pricing || undefined,
      offers: manual?.offers || undefined,
      media:
        imageUrls.length > 0 || videoUrls.length > 0
          ? {
              images: imageUrls.slice(0, 10),
              videos: videoUrls.slice(0, 5),
            }
          : undefined,
      reviews: allReviews.length > 0 ? allReviews.slice(0, 5) : undefined,
      confidence: this.calculateConfidence(bestResult),
      scrapedUrls: allResults.map((r) => r.sourceUrl),
      acquiredAt: new Date(),
    };

    this.logger.log(
      `Context acquired: source=${context.source}, confidence=${context.confidence}`,
    );

    return context;
  }

  /**
   * Calculate confidence score based on scrape quality
   */
  private calculateConfidence(result: ScrapeResult): number {
    const { status, extraction } = result;

    if (status === 'failed' || !extraction) {
      return 0;
    }

    let score = 0;

    // Base score from status
    if (status === 'success') score += 0.5;
    else if (status === 'partial') score += 0.3;

    // Bonus for having key fields
    if (extraction.productName) score += 0.1;
    if (extraction.description && extraction.description.length > 50)
      score += 0.1;
    if (extraction.benefits && extraction.benefits.length > 0) score += 0.1;
    if (extraction.mediaUrls && extraction.mediaUrls.length > 0) score += 0.1;
    if (extraction.pricing) score += 0.1;

    return Math.min(score, 1.0);
  }
}
