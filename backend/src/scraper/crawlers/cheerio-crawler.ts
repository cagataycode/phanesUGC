/**
 * Cheerio Product Crawler
 *
 * Fast, lightweight crawler for static HTML product pages.
 * Uses CheerioCrawler from Crawlee to fetch and parse HTML
 * without browser overhead.
 *
 * Configuration:
 * - maxRequestsPerCrawl: 1 (single page per job)
 * - requestHandlerTimeoutSecs: 15
 * - maxRequestRetries: 2
 */

import { CheerioCrawler, Configuration, CheerioCrawlingContext } from 'crawlee';
import * as cheerio from 'cheerio';
import {
  ProductExtraction,
  MediaAsset,
} from '../interfaces/product-extraction.interface';
import { extractFromJsonLd } from '../extractors/jsonld-extractor';
import { extractFromMeta } from '../extractors/meta-extractor';
import { extractFromDom } from '../extractors/dom-extractor';
import { extractMedia } from '../extractors/media-extractor';

/**
 * Result from Cheerio scraping
 */
export interface CheerioScrapeResult {
  extraction: ProductExtraction | null;
  error: Error | null;
  rawHtml: string | null;
}

/**
 * Scrape a product page using CheerioCrawler
 */
export async function scrapeWithCheerio(
  url: string,
  userAgent: string,
  timeoutSecs: number = 15,
): Promise<CheerioScrapeResult> {
  const result: CheerioScrapeResult = {
    extraction: null,
    error: null,
    rawHtml: null,
  };

  const crawler = new CheerioCrawler(
    {
      maxRequestsPerCrawl: 1,
      requestHandlerTimeoutSecs: timeoutSecs,
      maxRequestRetries: 2,
      requestHandler: (context: CheerioCrawlingContext) => {
        try {
          const { request, $ } = context;
          result.rawHtml = $.html();
          result.extraction = extractProductData(
            $ as unknown as cheerio.CheerioAPI,
            request.url,
          );
        } catch (e) {
          result.error = e instanceof Error ? e : new Error(String(e));
        }
      },
    },
    new Configuration({
      persistStorage: false,
      purgeOnStart: true,
    }),
  );

  await crawler.run([url]);

  return result;
}

/**
 * Extract product data from Cheerio-parsed HTML
 * Uses the extractors with priority: JSON-LD > Meta > DOM
 */
function extractProductData(
  $: cheerio.CheerioAPI,
  url: string,
): ProductExtraction {
  // Priority 1: JSON-LD extraction
  const jsonLdResult = extractFromJsonLd($);

  // Priority 2: Meta/OG extraction
  const metaResult = extractFromMeta($);

  // Priority 3: DOM heuristic extraction
  const domResult = extractFromDom($);

  // Extract media from DOM
  const domMedia = extractMedia($, url, [], []);

  // Merge results with priority: JSON-LD > Meta > DOM
  const extraction: ProductExtraction = {
    productName:
      jsonLdResult.productName ||
      metaResult.productName ||
      domResult.productName,
    tagline: metaResult.tagline || domResult.tagline,
    description:
      jsonLdResult.description ||
      metaResult.description ||
      domResult.description,
    benefits:
      jsonLdResult.benefits.length > 0
        ? jsonLdResult.benefits
        : domResult.benefits,
    painPoints: domResult.painPoints,
    pricing: jsonLdResult.pricing || metaResult.pricing || domResult.pricing,
    currency: jsonLdResult.currency || metaResult.currency,
    priceValue: jsonLdResult.priceValue ?? metaResult.priceValue,
    reviews:
      jsonLdResult.reviews.length > 0
        ? jsonLdResult.reviews
        : domResult.reviews,
    mediaUrls: mergeMediaUrls(
      jsonLdResult.mediaUrls,
      metaResult.mediaUrls,
      domMedia,
    ),
    ctaText: metaResult.ctaText,
    brandColors: domResult.brandColors,
    rawText: domResult.rawText,
    structuredData: jsonLdResult.structuredData,
    openGraph: metaResult.openGraph,
    sourceUrl: url,
  };

  return extraction;
}

/**
 * Merge media URLs from different sources, deduplicating
 */
function mergeMediaUrls(
  jsonLdMedia: MediaAsset[],

  metaMedia: MediaAsset[],

  domMedia: MediaAsset[],
): MediaAsset[] {
  const seen = new Set<string>();
  const merged: MediaAsset[] = [];

  // Add JSON-LD media first (highest priority)
  for (const media of jsonLdMedia) {
    if (!seen.has(media.url)) {
      merged.push(media);
      seen.add(media.url);
    }
  }

  // Add Meta media
  for (const media of metaMedia) {
    if (!seen.has(media.url)) {
      merged.push(media);
      seen.add(media.url);
    }
  }

  // Add DOM media
  for (const media of domMedia) {
    if (!seen.has(media.url)) {
      merged.push(media);
      seen.add(media.url);
    }
  }

  return merged.slice(0, 30); // Limit to 30 media items
}
