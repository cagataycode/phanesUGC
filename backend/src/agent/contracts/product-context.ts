/**
 * ProductContext - Merged product data from scraping and manual input
 *
 * Combines scraped data from URLs with user-provided product information.
 * Includes confidence scores and source tracking for data provenance.
 */
export interface ProductContext {
  /** Data source indicator */
  source: 'scraped' | 'manual' | 'merged';

  /** Product name */
  name: string;

  /** Product description */
  description: string;

  /** Key benefits/features */
  benefits: string[];

  /** Product category (inferred or provided) */
  category?: string;

  /** Pricing information */
  pricing?: string;

  /** Special offers or promotions */
  offers?: string;

  /** Scraped media URLs */
  media?: {
    images: string[];
    videos: string[];
  };

  /** Customer reviews (if scraped) */
  reviews?: string[];

  /** AI-generated summary of the product */
  aiSummary?: string;

  /** AI-detected target audiences */
  aiTargetAudiences?: string[];

  /** Confidence score for scraped data (0-1) */
  confidence?: number;

  /** URLs that were scraped */
  scrapedUrls?: string[];

  /** Timestamp when context was acquired */
  acquiredAt: Date;
}
