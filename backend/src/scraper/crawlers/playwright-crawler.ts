/**
 * Playwright Product Crawler
 *
 * Fallback crawler for JavaScript-rendered SPAs (React, Vue, Angular).
 * Uses PlaywrightCrawler from Crawlee with headless Chromium.
 *
 * Heavier than CheerioCrawler (~5-10s per page vs ~1-3s).
 *
 * Configuration:
 * - maxRequestsPerCrawl: 1
 * - requestHandlerTimeoutSecs: 30
 * - headless: true
 * - launchContext: { launchOptions: { args: ['--no-sandbox'] } }
 */

import {
  PlaywrightCrawler,
  Configuration,
  PlaywrightCrawlingContext,
} from 'crawlee';
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
 * Result from Playwright scraping
 */
export interface PlaywrightScrapeResult {
  extraction: ProductExtraction | null;
  error: Error | null;
  rawHtml: string | null;
}

/**
 * Scrape a product page using PlaywrightCrawler (for JS-rendered SPAs)
 */
export async function scrapeWithPlaywright(
  url: string,
  userAgent: string,
  timeoutSecs: number = 30,
): Promise<PlaywrightScrapeResult> {
  const result: PlaywrightScrapeResult = {
    extraction: null,
    error: null,
    rawHtml: null,
  };

  const crawler = new PlaywrightCrawler(
    {
      maxRequestsPerCrawl: 1,
      requestHandlerTimeoutSecs: timeoutSecs,
      maxRequestRetries: 1,
      headless: true,
      launchContext: {
        launchOptions: {
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
      },
      requestHandler: async (context: PlaywrightCrawlingContext) => {
        try {
          const { request, page } = context;

          // Wait for page to be fully hydrated
          await page.waitForLoadState('networkidle');

          // Get the fully-rendered HTML
          const html = await page.content();
          result.rawHtml = html;

          // Parse with Cheerio
          const $ = cheerio.load(html);
          result.extraction = extractProductData($, request.url);
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
