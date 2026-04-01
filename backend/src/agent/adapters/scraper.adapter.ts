/**
 * ScraperAdapter - Interface for web scraping and content extraction
 *
 * Used in context acquisition stage to enrich product data from URLs
 */
export interface ScraperAdapter {
  /**
   * Scrape product information from URLs
   *
   * @param urls - Product URLs to scrape
   * @returns Extracted product data
   */
  scrapeProductUrls(urls: string[]): Promise<ScrapedProductData>;
}

export interface ScrapedProductData {
  /** Product name (if found) */
  name?: string;

  /** Product description */
  description?: string;

  /** Key features/benefits */
  benefits?: string[];

  /** Product category */
  category?: string;

  /** Pricing information */
  pricing?: string;

  /** Special offers */
  offers?: string;

  /** Media URLs */
  media?: {
    images: string[];
    videos: string[];
  };

  /** Customer reviews */
  reviews?: string[];

  /** Confidence score (0-1) */
  confidence: number;

  /** URLs that were successfully scraped */
  scrapedUrls: string[];

  /** Scraping errors (if any) */
  errors?: string[];
}
