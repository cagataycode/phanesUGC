/**
 * JSON-LD Extractor
 *
 * Extracts structured product data from schema.org JSON-LD scripts.
 * This is the most reliable extraction method as most modern e-commerce
 * platforms emit structured data.
 *
 * Supported schema types:
 * - Product
 * - Offer
 * - AggregateOffer
 * - Brand
 * - Organization
 */

import * as cheerio from 'cheerio';
import {
  MediaAsset,
  ProductReview,
} from '../interfaces/product-extraction.interface';

/**
 * Base interface for JSON-LD objects with index signature
 */
interface JsonLdBase {
  '@type'?: string | string[];
  [key: string]: unknown;
}

/**
 * Schema.org types we're interested in
 */
interface SchemaProduct extends JsonLdBase {
  name?: string;
  description?: string;
  image?: string | string[];
  brand?: SchemaBrand | string;
  offers?: SchemaOffer | SchemaOffer[];
  aggregateRating?: SchemaAggregateRating;
  review?: SchemaReview | SchemaReview[];
  sku?: string;
  gtin?: string;
  mpn?: string;
  category?: string;
}

interface SchemaBrand extends JsonLdBase {
  name?: string;
  logo?: string;
}

interface SchemaOffer extends JsonLdBase {
  price?: number | string;
  priceCurrency?: string;
  availability?: string;
  priceValidUntil?: string;
  url?: string;
  seller?: SchemaOrganization | string;
}

interface SchemaOrganization extends JsonLdBase {
  name?: string;
  logo?: string;
  url?: string;
}

interface SchemaAggregateRating extends JsonLdBase {
  ratingValue?: number | string;
  reviewCount?: number | string;
  bestRating?: number | string;
  worstRating?: number | string;
}

interface SchemaReview extends JsonLdBase {
  reviewRating?: SchemaRating;
  author?: SchemaPerson | string;
  datePublished?: string;
  reviewBody?: string;
  name?: string;
}

interface SchemaRating extends JsonLdBase {
  ratingValue?: number | string;
  bestRating?: number | string;
  worstRating?: number | string;
}

interface SchemaPerson extends JsonLdBase {
  name?: string;
}

/**
 * Result from JSON-LD extraction
 */
export interface JsonLdExtractionResult {
  productName: string | null;
  description: string | null;
  benefits: string[];
  pricing: string | null;
  currency: string | null;
  priceValue: number | null;
  reviews: ProductReview[];
  mediaUrls: MediaAsset[];
  brandName: string | null;
  structuredData: SchemaProduct | null;
}

/**
 * Extract product data from JSON-LD structured data
 */
export function extractFromJsonLd(
  $: cheerio.CheerioAPI,
): JsonLdExtractionResult {
  const result: JsonLdExtractionResult = {
    productName: null,
    description: null,
    benefits: [],
    pricing: null,
    currency: null,
    priceValue: null,
    reviews: [],
    mediaUrls: [],
    brandName: null,
    structuredData: null,
  };

  // Find all JSON-LD script tags
  const jsonLdScripts: JsonLdBase[] = [];

  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const content = $(element).html();
      if (content) {
        const parsed = JSON.parse(content) as JsonLdBase;
        jsonLdScripts.push(parsed);
      }
    } catch {
      // Invalid JSON, skip
    }
  });

  if (jsonLdScripts.length === 0) {
    return result;
  }

  // Flatten @graph structures
  const allObjects = flattenJsonLd(jsonLdScripts);

  // Find Product schema
  const product = findSchema<SchemaProduct>(allObjects, 'Product');
  result.structuredData = product;

  if (product) {
    // Extract product name
    result.productName = product.name || null;

    // Extract description
    result.description = product.description || null;

    // Extract images
    if (product.image) {
      const images = Array.isArray(product.image)
        ? product.image
        : [product.image];
      result.mediaUrls = images
        .filter(
          (url): url is string => typeof url === 'string' && url.length > 0,
        )
        .map((url) => ({
          url: url,
          type: 'image' as const,
        }));
    }

    // Extract brand
    if (product.brand) {
      if (typeof product.brand === 'string') {
        result.brandName = product.brand;
      } else if (product.brand.name) {
        result.brandName = product.brand.name;
      }
    }

    // Extract offers/pricing
    if (product.offers) {
      const offers = Array.isArray(product.offers)
        ? product.offers
        : [product.offers];
      const firstOffer = offers[0];

      if (firstOffer) {
        result.currency = firstOffer.priceCurrency || null;

        if (firstOffer.price !== undefined) {
          const priceNum =
            typeof firstOffer.price === 'string'
              ? parseFloat(firstOffer.price)
              : firstOffer.price;

          if (!isNaN(priceNum)) {
            result.priceValue = priceNum;
            const currencySymbol = getCurrencySymbol(
              firstOffer.priceCurrency || 'USD',
            );
            result.pricing = `${currencySymbol}${priceNum.toFixed(2)}`;
          }
        }
      }
    }

    // Extract reviews
    if (product.review) {
      const reviews = Array.isArray(product.review)
        ? product.review
        : [product.review];
      result.reviews = reviews
        .map((review): ProductReview | null => {
          if (!review.reviewBody && !review.name) {
            return null;
          }

          return {
            text: review.reviewBody || review.name || '',
            rating: review.reviewRating?.ratingValue
              ? typeof review.reviewRating.ratingValue === 'string'
                ? parseFloat(review.reviewRating.ratingValue)
                : review.reviewRating.ratingValue
              : undefined,
            author:
              typeof review.author === 'string'
                ? review.author
                : review.author?.name || undefined,
            date: review.datePublished || undefined,
          };
        })
        .filter((r): r is ProductReview => r !== null);
    }
  }

  return result;
}

/**
 * Flatten JSON-LD structures including @graph
 */
function flattenJsonLd(scripts: JsonLdBase[]): JsonLdBase[] {
  const result: JsonLdBase[] = [];

  for (const obj of scripts) {
    if (obj['@graph'] && Array.isArray(obj['@graph'])) {
      result.push(...(obj['@graph'] as JsonLdBase[]));
    } else if (obj['@type']) {
      result.push(obj);
    }

    // Also check for nested objects with @type
    for (const value of Object.values(obj)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const nested = value as JsonLdBase;
        if (nested['@type']) {
          result.push(nested);
        }
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item === 'object') {
            const nestedItem = item as JsonLdBase;
            if (nestedItem['@type']) {
              result.push(nestedItem);
            }
          }
        }
      }
    }
  }

  return result;
}

/**
 * Find a schema object by type
 */
function findSchema<T extends JsonLdBase>(
  objects: JsonLdBase[],
  type: string,
): T | null {
  // Try exact match first
  for (const obj of objects) {
    if (obj['@type'] === type) {
      return obj as T;
    }
  }

  // Try array of types
  for (const obj of objects) {
    const objType = obj['@type'];
    if (Array.isArray(objType) && objType.includes(type)) {
      return obj as T;
    }
  }

  return null;
}

/**
 * Get currency symbol from currency code
 */
function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CNY: '¥',
    INR: '₹',
    TRY: '₺',
    RUB: '₽',
    BRL: 'R$',
    CAD: 'C$',
    AUD: 'A$',
    CHF: 'CHF ',
    SEK: 'kr ',
    NOK: 'kr ',
    DKK: 'kr ',
    KRW: '₩',
    MXN: 'Mex$',
    SGD: 'S$',
    HKD: 'HK$',
    NZD: 'NZ$',
  };

  return symbols[currency.toUpperCase()] || `${currency} `;
}
