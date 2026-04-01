/**
 * Media Extractor
 *
 * Extracts images and videos from product pages.
 * Collects from:
 * - og:image, og:video
 * - JSON-LD Product.image
 * - <img> tags in product gallery containers
 * - <video> / <source> tags
 * Filter: deduplicate, resolve relative URLs, skip tiny icons/tracking pixels
 */

import * as cheerio from 'cheerio';
import { MediaAsset } from '../interfaces/product-extraction.interface';

/**
 * File extensions that indicate images
 */
const IMAGE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.avif',
  '.bmp',
  '.svg',
];

/**
 * File extensions that indicate videos
 */
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.ogv'];

/**
 * Common selectors for product image galleries
 */
const GALLERY_SELECTORS = [
  '.product-gallery',
  '.product-images',
  '.product-gallery-images',
  '.image-gallery',
  '.product-slider',
  '.product-carousel',
  '[data-product-gallery]',
  '.pdp-gallery',
  '.product-media-gallery',
];

/**
 * Common selectors for product images
 */
const PRODUCT_IMAGE_SELECTORS = [
  '.product-image',
  '.product-img',
  '#product-image',
  '[data-product-image]',
  '.pdp-image',
  '.main-product-image',
  '.product-main-image',
  '.primary-image',
];

/**
 * Extract media assets from the page
 */
export function extractMedia(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  openGraphImages: string[] = [],
  jsonLdImages: string[] = [],
): MediaAsset[] {
  const mediaAssets: MediaAsset[] = [];
  const seenUrls = new Set<string>();

  // Add Open Graph images first (highest priority)
  for (const url of openGraphImages) {
    const resolvedUrl = resolveUrl(url, baseUrl);
    if (
      resolvedUrl &&
      !seenUrls.has(resolvedUrl) &&
      isValidMediaUrl(resolvedUrl)
    ) {
      mediaAssets.push({
        url: resolvedUrl,
        type: 'image',
        alt: 'Product image (OG)',
      });
      seenUrls.add(resolvedUrl);
    }
  }

  // Add JSON-LD images
  for (const url of jsonLdImages) {
    const resolvedUrl = resolveUrl(url, baseUrl);
    if (
      resolvedUrl &&
      !seenUrls.has(resolvedUrl) &&
      isValidMediaUrl(resolvedUrl)
    ) {
      mediaAssets.push({
        url: resolvedUrl,
        type: 'image',
        alt: 'Product image (JSON-LD)',
      });
      seenUrls.add(resolvedUrl);
    }
  }

  // Extract from product image selectors
  for (const selector of PRODUCT_IMAGE_SELECTORS) {
    $(selector).each((_, element) => {
      const imgSrc = extractImageSrc($, element, baseUrl);
      if (imgSrc && !seenUrls.has(imgSrc)) {
        const alt =
          $(element).attr('alt') ||
          $(element).find('img').attr('alt') ||
          undefined;
        mediaAssets.push({
          url: imgSrc,
          type: 'image',
          alt,
        });
        seenUrls.add(imgSrc);
      }
    });
  }

  // Extract from gallery containers
  for (const selector of GALLERY_SELECTORS) {
    const gallery = $(selector);
    if (gallery.length) {
      gallery.find('img').each((_, img) => {
        const imgSrc = extractImageSrcFromElement($, img, baseUrl);
        if (imgSrc && !seenUrls.has(imgSrc)) {
          const alt = $(img).attr('alt') || undefined;
          mediaAssets.push({
            url: imgSrc,
            type: 'image',
            alt,
          });
          seenUrls.add(imgSrc);
        }
      });
    }
  }

  // Extract all images with reasonable size
  $('img').each((_, img) => {
    const imgSrc = extractImageSrcFromElement($, img, baseUrl);
    if (imgSrc && !seenUrls.has(imgSrc) && isValidMediaUrl(imgSrc)) {
      const alt = $(img).attr('alt') || undefined;
      mediaAssets.push({
        url: imgSrc,
        type: 'image',
        alt,
      });
      seenUrls.add(imgSrc);
    }
  });

  // Extract videos
  extractVideos($, baseUrl, mediaAssets, seenUrls);

  return mediaAssets.slice(0, 30); // Limit to 30 media assets
}

/**
 * Extract image src from an element
 */
function extractImageSrc(
  $: cheerio.CheerioAPI,

  element: any,
  baseUrl: string,
): string | null {
  // Check for data-src (lazy loading)
  const dataSrc =
    $(element).attr('data-src') || $(element).attr('data-lazy-src');
  if (dataSrc) {
    return resolveUrl(dataSrc, baseUrl);
  }

  // Check for srcset (take the first/largest)
  const srcset = $(element).attr('srcset');
  if (srcset) {
    const firstSrc = srcset.split(',')[0]?.trim().split(' ')[0];
    if (firstSrc) {
      return resolveUrl(firstSrc, baseUrl);
    }
  }

  // Check for src
  const src = $(element).attr('src');
  if (src) {
    return resolveUrl(src, baseUrl);
  }

  // Check for child img
  const img = $(element).find('img').first();
  if (img.length) {
    return extractImageSrcFromElement($, img[0], baseUrl);
  }

  return null;
}

/**
 * Extract image src from an img element
 */
function extractImageSrcFromElement(
  $: cheerio.CheerioAPI,

  img: any,
  baseUrl: string,
): string | null {
  // Check for data-src (lazy loading)
  const dataSrc = $(img).attr('data-src') || $(img).attr('data-lazy-src');
  if (dataSrc) {
    return resolveUrl(dataSrc, baseUrl);
  }

  // Check for srcset (take the first/largest)
  const srcset = $(img).attr('srcset');
  if (srcset) {
    const firstSrc = srcset.split(',')[0]?.trim().split(' ')[0];
    if (firstSrc) {
      return resolveUrl(firstSrc, baseUrl);
    }
  }

  // Check for src
  const src = $(img).attr('src');
  if (src) {
    return resolveUrl(src, baseUrl);
  }

  return null;
}

/**
 * Extract video elements from the page
 */
function extractVideos(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  mediaAssets: MediaAsset[],
  seenUrls: Set<string>,
): void {
  // Extract from <video> tags
  $('video').each((_, video) => {
    // Check for src attribute
    const src = $(video).attr('src');
    if (src) {
      const resolvedUrl = resolveUrl(src, baseUrl);
      if (resolvedUrl && !seenUrls.has(resolvedUrl)) {
        mediaAssets.push({
          url: resolvedUrl,
          type: 'video',
        });
        seenUrls.add(resolvedUrl);
      }
    }

    // Check for <source> elements
    $(video)
      .find('source')
      .each((_, source) => {
        const sourceSrc = $(source).attr('src');
        if (sourceSrc) {
          const resolvedUrl = resolveUrl(sourceSrc, baseUrl);
          if (resolvedUrl && !seenUrls.has(resolvedUrl)) {
            mediaAssets.push({
              url: resolvedUrl,
              type: 'video',
            });
            seenUrls.add(resolvedUrl);
          }
        }
      });
  });

  // Extract from video selectors
  const videoSelectors = [
    '.product-video',
    '.product-demo',
    '.product-video-demo',
    '[data-product-video]',
    '.video-gallery',
  ];

  for (const selector of videoSelectors) {
    $(selector).each((_, element) => {
      const videoSrc = $(element).attr('src') || $(element).attr('data-src');
      if (videoSrc) {
        const resolvedUrl = resolveUrl(videoSrc, baseUrl);
        if (resolvedUrl && !seenUrls.has(resolvedUrl)) {
          mediaAssets.push({
            url: resolvedUrl,
            type: 'video',
          });
          seenUrls.add(resolvedUrl);
        }
      }
    });
  }
}

/**
 * Resolve a relative URL to an absolute URL
 */
function resolveUrl(url: string, baseUrl: string): string | null {
  if (!url) return null;

  // Already absolute
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('//')
  ) {
    return url.startsWith('//') ? `https:${url}` : url;
  }

  // Data URLs
  if (url.startsWith('data:')) {
    return null; // Skip data URLs
  }

  try {
    return new URL(url, baseUrl).href;
  } catch {
    return null;
  }
}

/**
 * Check if a URL is a valid media URL (not a tiny icon or tracking pixel)
 */
function isValidMediaUrl(url: string): boolean {
  const lowerUrl = url.toLowerCase();

  // Skip tracking pixels and tiny icons
  if (
    lowerUrl.includes('tracking') ||
    lowerUrl.includes('pixel') ||
    lowerUrl.includes('analytics') ||
    lowerUrl.includes('1x1') ||
    lowerUrl.includes('favicon') ||
    lowerUrl.includes('icon') ||
    lowerUrl.includes('logo') ||
    lowerUrl.includes('badge')
  ) {
    return false;
  }

  // Check for image or video extensions
  const hasImageExt = IMAGE_EXTENSIONS.some((ext) => lowerUrl.includes(ext));
  const hasVideoExt = VIDEO_EXTENSIONS.some((ext) => lowerUrl.includes(ext));

  return (
    hasImageExt ||
    hasVideoExt ||
    lowerUrl.includes('image') ||
    lowerUrl.includes('photo')
  );
}
