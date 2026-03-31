/**
 * Meta/OG Extractor
 *
 * Extracts product data from Open Graph, Twitter Card, and standard meta tags.
 * This is the second priority extraction method after JSON-LD.
 *
 * Supported meta tags:
 * - Open Graph (og:*)
 * - Twitter Cards (twitter:*)
 * - Standard meta (description, keywords, author)
 * - Product-specific meta (product:price:amount, etc.)
 */

import * as cheerio from 'cheerio';
import { MediaAsset } from '../interfaces/product-extraction.interface';

/**
 * Result from meta/OG extraction
 */
export interface MetaExtractionResult {
  productName: string | null;
  description: string | null;
  tagline: string | null;
  pricing: string | null;
  currency: string | null;
  priceValue: number | null;
  mediaUrls: MediaAsset[];
  ctaText: string | null;
  openGraph: Record<string, string>;
  twitterCard: Record<string, string>;
  keywords: string[];
}

/**
 * Extract product data from meta tags
 */
export function extractFromMeta($: cheerio.CheerioAPI): MetaExtractionResult {
  const result: MetaExtractionResult = {
    productName: null,
    description: null,
    tagline: null,
    pricing: null,
    currency: null,
    priceValue: null,
    mediaUrls: [],
    ctaText: null,
    openGraph: {},
    twitterCard: {},
    keywords: [],
  };

  // Extract Open Graph tags
  result.openGraph = extractOpenGraph($);

  // Extract Twitter Card tags
  result.twitterCard = extractTwitterCard($);

  // Extract product name (priority: og:title > twitter:title > title tag)
  result.productName =
    result.openGraph['og:title'] ||
    result.twitterCard['twitter:title'] ||
    $('title').text()?.trim() ||
    null;

  // Extract description (priority: og:description > twitter:description > meta description)
  result.description =
    result.openGraph['og:description'] ||
    result.twitterCard['twitter:description'] ||
    $('meta[name="description"]').attr('content')?.trim() ||
    null;

  // Extract tagline (often in og:site_name or subtitle patterns)
  result.tagline =
    result.openGraph['og:site_name'] ||
    $('meta[name="subtitle"]').attr('content')?.trim() ||
    null;

  // Extract pricing from Open Graph product tags
  const priceAmount =
    result.openGraph['product:price:amount'] ||
    result.openGraph['og:price:amount'];
  const priceCurrency =
    result.openGraph['product:price:currency'] ||
    result.openGraph['og:price:currency'];

  if (priceAmount) {
    const priceNum = parseFloat(priceAmount);
    if (!isNaN(priceNum)) {
      result.priceValue = priceNum;
      result.currency = priceCurrency || null;
      const symbol = getCurrencySymbol(priceCurrency || 'USD');
      result.pricing = `${symbol}${priceNum.toFixed(2)}`;
    }
  }

  // Extract images (priority: og:image > twitter:image)
  const images: string[] = [];

  // Primary OG image
  if (result.openGraph['og:image']) {
    images.push(result.openGraph['og:image']);
  }

  // Additional OG images (og:image:url, og:image:secure_url)
  for (const [key, value] of Object.entries(result.openGraph)) {
    if (
      (key === 'og:image:url' || key === 'og:image:secure_url') &&
      value &&
      !images.includes(value)
    ) {
      images.push(value);
    }
  }

  // Twitter image
  if (
    result.twitterCard['twitter:image'] &&
    !images.includes(result.twitterCard['twitter:image'])
  ) {
    images.push(result.twitterCard['twitter:image']);
  }

  result.mediaUrls = images.map((url) => ({
    url,
    type: 'image' as const,
    alt: result.openGraph['og:image:alt'] || undefined,
  }));

  // Extract videos
  const videoUrl =
    result.openGraph['og:video'] || result.openGraph['og:video:url'];
  if (videoUrl) {
    result.mediaUrls.push({
      url: videoUrl,
      type: 'video' as const,
    });
  }

  // Extract CTA text (often in buttons, but sometimes in meta)
  result.ctaText =
    $('meta[name="cta"]').attr('content')?.trim() ||
    $('meta[property="og:cta"]').attr('content')?.trim() ||
    null;

  // Extract keywords
  const keywordsStr = $('meta[name="keywords"]').attr('content');
  if (keywordsStr) {
    result.keywords = keywordsStr
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
  }

  return result;
}

/**
 * Extract all Open Graph meta tags
 */
function extractOpenGraph($: cheerio.CheerioAPI): Record<string, string> {
  const og: Record<string, string> = {};

  // Standard OG properties via property attribute
  $(
    'meta[property^="og:"], meta[property^="product:"], meta[property^="article:"]',
  ).each((_, element) => {
    const property = $(element).attr('property');
    const content = $(element).attr('content');
    if (property && content) {
      og[property] = content;
    }
  });

  // Also check name attribute (some implementations use this)
  $('meta[name^="og:"]').each((_, element) => {
    const name = $(element).attr('name');
    const content = $(element).attr('content');
    if (name && content && !og[name]) {
      og[name] = content;
    }
  });

  return og;
}

/**
 * Extract all Twitter Card meta tags
 */
function extractTwitterCard($: cheerio.CheerioAPI): Record<string, string> {
  const twitter: Record<string, string> = {};

  $('meta[name^="twitter:"]').each((_, element) => {
    const name = $(element).attr('name');
    const content = $(element).attr('content');
    if (name && content) {
      twitter[name] = content;
    }
  });

  return twitter;
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
