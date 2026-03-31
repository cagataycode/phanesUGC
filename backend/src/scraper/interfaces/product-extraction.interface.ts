/**
 * ProductExtraction Interface
 *
 * Represents the structured data extracted from a product page.
 * Based on PRD_01_INPUT_AND_CONTEXT.md Section 7.2 (URL Scraping and Product Extraction)
 */

export interface ProductReview {
  text: string;
  rating?: number;
  author?: string;
  date?: string;
}

export interface MediaAsset {
  url: string;
  type: 'image' | 'video';
  alt?: string;
  width?: number;
  height?: number;
}

export interface ProductExtraction {
  /** Product name from the page */
  productName: string | null;

  /** Short tagline or subtitle */
  tagline: string | null;

  /** Full product description */
  description: string | null;

  /** List of product benefits/features */
  benefits: string[];

  /** Pain points the product addresses */
  painPoints: string[];

  /** Pricing information as raw string */
  pricing: string | null;

  /** Currency code if detectable (USD, EUR, etc.) */
  currency: string | null;

  /** Numeric price value if parseable */
  priceValue: number | null;

  /** Customer reviews found on page */
  reviews: ProductReview[];

  /** Media assets (images and videos) */
  mediaUrls: MediaAsset[];

  /** Call-to-action text from buttons/links */
  ctaText: string | null;

  /** Brand colors detected from page */
  brandColors: string[];

  /** Raw text content from the page body */
  rawText: string;

  /** Structured data (JSON-LD) if available */
  structuredData: Record<string, unknown> | null;

  /** Open Graph metadata */
  openGraph: Record<string, string> | null;

  /** Source URL that was scraped */
  sourceUrl: string;
}

/**
 * ScrapeResult wraps the extraction with status metadata
 */
export type ScrapeStatus = 'success' | 'partial' | 'failed';

export type ScrapeMethod = 'cheerio' | 'playwright';

export interface ScrapeResult {
  /** URL that was scraped */
  sourceUrl: string;

  /** Status of the scrape operation */
  status: ScrapeStatus;

  /** Extracted product data (null if failed completely) */
  extraction: ProductExtraction | null;

  /** Error message if status is 'failed' */
  error?: string;

  /** Timestamp of the scrape */
  scrapedAt: Date;

  /** Method used for scraping */
  method: ScrapeMethod;

  /** Time taken in milliseconds */
  durationMs: number;
}

/**
 * ScraperAdapter interface for dependency injection
 */
export interface ScraperAdapter {
  /**
   * Scrape a single product URL
   */
  scrape(url: string): Promise<ScrapeResult>;

  /**
   * Scrape multiple product URLs in parallel
   */
  scrapeMany(urls: string[]): Promise<ScrapeResult[]>;
}

/**
 * Options for configuring the scraper
 */
export interface ScraperOptions {
  /** Timeout in milliseconds for each request */
  timeoutMs?: number;

  /** Maximum retries per URL */
  maxRetries?: number;

  /** Whether to use Playwright fallback for JS-rendered pages */
  usePlaywrightFallback?: boolean;

  /** User agent string to use */
  userAgent?: string;

  /** Whether to extract brand colors (can be slow) */
  extractBrandColors?: boolean;
}

/**
 * Default scraper options
 */
export const DEFAULT_SCRAPER_OPTIONS: Required<ScraperOptions> = {
  timeoutMs: 15000,
  maxRetries: 2,
  usePlaywrightFallback: true,
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  extractBrandColors: false,
};
