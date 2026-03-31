/**
 * DOM Extractor
 *
 * Extracts product data using heuristic DOM selectors.
 * This is the fallback extraction method when JSON-LD and Meta tags
 * don't provide sufficient data.
 *
 * Extraction targets:
 * - Product name (h1, .product-title, etc.)
 * - Description (meta description, .product-description, etc.)
 * - Benefits/features (ul/li patterns)
 * - Pricing (price patterns, .price, etc.)
 * - Reviews (review patterns)
 */

import * as cheerio from 'cheerio';
import { ProductReview } from '../interfaces/product-extraction.interface';

/**
 * Result from DOM extraction
 */
export interface DomExtractionResult {
  productName: string | null;
  description: string | null;
  tagline: string | null;
  benefits: string[];
  painPoints: string[];
  pricing: string | null;
  reviews: ProductReview[];
  brandColors: string[];
  rawText: string;
}

/**
 * Common selectors for product names
 */
const PRODUCT_NAME_SELECTORS = [
  'h1',
  '.product-title',
  '.product-name',
  '#product-title',
  '[data-product-title]',
  '.pdp-title',
  '.product-heading',
  'h1.product-title',
  'h1.product-name',
];

/**
 * Common selectors for product descriptions
 */
const DESCRIPTION_SELECTORS = [
  '.product-description',
  '.product-details',
  '#product-description',
  '[data-product-description]',
  '.pdp-description',
  '.product-info',
  '.product-summary',
  '.product-overview',
  'meta[name="description"]',
];

/**
 * Common selectors for benefits/features lists
 */
const BENEFITS_SELECTORS = [
  '.product-features',
  '.product-benefits',
  '.features-list',
  '.benefits-list',
  '.product-highlights',
  '[data-product-features]',
  '.key-features',
  '.product-specs',
];

/**
 * Common selectors for pricing
 */
const PRICE_SELECTORS = [
  '.price',
  '.product-price',
  '#product-price',
  '[data-product-price]',
  '.pdp-price',
  '.current-price',
  '.sale-price',
  '.regular-price',
  '.price-amount',
];

/**
 * Common selectors for reviews
 */
const REVIEW_SELECTORS = [
  '.review',
  '.customer-review',
  '.product-review',
  '[data-review]',
  '.review-item',
  '.review-content',
];

/**
 * Extract product data from DOM using heuristic selectors
 */
export function extractFromDom($: cheerio.CheerioAPI): DomExtractionResult {
  const result: DomExtractionResult = {
    productName: null,
    description: null,
    tagline: null,
    benefits: [],
    painPoints: [],
    pricing: null,
    reviews: [],
    brandColors: [],
    rawText: '',
  };

  // Extract product name
  result.productName = extractProductName($);

  // Extract description
  result.description = extractDescription($);

  // Extract tagline
  result.tagline = extractTagline($);

  // Extract benefits/features
  result.benefits = extractBenefits($);

  // Extract pricing
  result.pricing = extractPricing($);

  // Extract reviews
  result.reviews = extractReviews($);

  // Extract brand colors
  result.brandColors = extractBrandColors($);

  // Extract raw text from body
  result.rawText = extractRawText($);

  return result;
}

/**
 * Extract product name using heuristic selectors
 */
function extractProductName($: cheerio.CheerioAPI): string | null {
  for (const selector of PRODUCT_NAME_SELECTORS) {
    const element = $(selector).first();
    if (element.length && element.text().trim()) {
      return element.text().trim();
    }
  }

  // Fallback: look for text patterns like "Buy X", "X - Product"
  const titlePattern = /(?:Buy|Shop|Order)\s+(.+?)(?:\s*[-|]|$)/i;
  const title = $('title').text();
  const match = title.match(titlePattern);
  if (match) {
    return match[1].trim();
  }

  return null;
}

/**
 * Extract product description using heuristic selectors
 */
function extractDescription($: cheerio.CheerioAPI): string | null {
  for (const selector of DESCRIPTION_SELECTORS) {
    const element = $(selector).first();
    if (element.length && element.text().trim()) {
      return element.text().trim().substring(0, 2000); // Limit length
    }
  }

  return null;
}

/**
 * Extract tagline/subtitle
 */
function extractTagline($: cheerio.CheerioAPI): string | null {
  const selectors = [
    '.product-tagline',
    '.product-subtitle',
    '.tagline',
    '.subtitle',
    '.product-slogan',
    '.hero-subtitle',
  ];

  for (const selector of selectors) {
    const element = $(selector).first();
    if (element.length && element.text().trim()) {
      return element.text().trim();
    }
  }

  return null;
}

/**
 * Extract benefits/features from list elements
 */
function extractBenefits($: cheerio.CheerioAPI): string[] {
  const benefits: string[] = [];

  for (const selector of BENEFITS_SELECTORS) {
    const container = $(selector);
    if (container.length) {
      // Look for li elements within the container
      container.find('li').each((_, li) => {
        const text = $(li).text().trim();
        if (text && text.length > 5 && text.length < 500) {
          benefits.push(text);
        }
      });

      // If we found benefits, stop looking
      if (benefits.length > 0) {
        break;
      }
    }
  }

  // Fallback: look for any ul with li elements that look like features
  if (benefits.length === 0) {
    $('ul').each((_, ul) => {
      const listItems: string[] = [];
      $(ul)
        .find('li')
        .each((_, li) => {
          const text = $(li).text().trim();
          if (text && text.length > 5 && text.length < 500) {
            listItems.push(text);
          }
        });

      // If this list has 3+ items, it might be a features list
      if (listItems.length >= 3) {
        benefits.push(...listItems);
      }
    });
  }

  return benefits.slice(0, 20); // Limit to 20 benefits
}

/**
 * Extract pricing information
 */
function extractPricing($: cheerio.CheerioAPI): string | null {
  for (const selector of PRICE_SELECTORS) {
    const element = $(selector).first();
    if (element.length) {
      const text = element.text().trim();
      // Check if it looks like a price
      if (/\$|€|£|¥|\d+\.\d{2}/.test(text)) {
        return text;
      }
    }
  }

  // Fallback: look for price patterns in the page
  const pricePattern = /(?:\$|€|£|¥)\s*\d+(?:\.\d{2})?/g;
  const bodyText = $('body').text();
  const matches = bodyText.match(pricePattern);
  if (matches && matches.length > 0) {
    return matches[0];
  }

  return null;
}

/**
 * Extract customer reviews
 */
function extractReviews($: cheerio.CheerioAPI): ProductReview[] {
  const reviews: ProductReview[] = [];

  for (const selector of REVIEW_SELECTORS) {
    const container = $(selector);
    if (container.length) {
      container.each((_, reviewEl) => {
        const reviewText = $(reviewEl)
          .find('.review-text, .review-body, .review-content, p')
          .first()
          .text()
          .trim();
        const ratingText = $(reviewEl)
          .find('.rating, .stars, .review-rating')
          .first()
          .text()
          .trim();

        if (reviewText) {
          const rating = extractRating(ratingText);
          reviews.push({
            text: reviewText,
            rating,
          });
        }
      });

      if (reviews.length > 0) {
        break;
      }
    }
  }

  return reviews.slice(0, 10); // Limit to 10 reviews
}

/**
 * Extract numeric rating from text
 */
function extractRating(text: string): number | undefined {
  if (!text) return undefined;

  // Look for patterns like "4.5 out of 5", "4.5/5", "★★★★☆"
  const outOfPattern = /(\d+\.?\d*)\s*(?:out of|\/)\s*(\d+)/;
  const match = text.match(outOfPattern);
  if (match) {
    return parseFloat(match[1]);
  }

  // Count stars
  const filledStars = (text.match(/★|★/g) || []).length;
  if (filledStars > 0) {
    return filledStars;
  }

  return undefined;
}

/**
 * Extract brand colors (MVP)
 */
function extractBrandColors($: cheerio.CheerioAPI): string[] {
  const colors = new Set<string>();

  // 1. theme-color meta tag
  const themeColor = $('meta[name="theme-color"]').attr('content');
  if (themeColor && /^#([0-9A-Fa-f]{3}){1,2}$/.test(themeColor.trim())) {
    colors.add(themeColor.trim());
  }

  // 2. We can try pulling from inline styles or basic head styles, but for the MVP 
  // we'll keep it simple and just rely on theme-color. Extracting CSS variables 
  // requires parsing stylesheets which can be heavy.
  
  return Array.from(colors);
}

/**
 * Extract raw text content from the page body
 */
function extractRawText($: cheerio.CheerioAPI): string {
  // Remove script and style elements
  $('script, style, noscript, nav, header, footer').remove();

  // Get text content
  let text = $('body').text() || '';

  // Clean up whitespace
  text = text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();

  // Limit to reasonable length
  return text.substring(0, 10000);
}
