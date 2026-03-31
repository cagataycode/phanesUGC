/**
 * Meta Extractor Tests
 */

import * as cheerio from 'cheerio';
import { extractFromMeta } from './meta-extractor';

describe('Meta Extractor', () => {
  it('should extract Open Graph tags', () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="OG Product Title" />
          <meta property="og:description" content="OG Product Description" />
          <meta property="og:image" content="https://example.com/og-image.jpg" />
          <meta property="og:site_name" content="Test Store" />
          <meta property="product:price:amount" content="49.99" />
          <meta property="product:price:currency" content="USD" />
        </head>
        <body></body>
      </html>
    `;

    const $ = cheerio.load(html);
    const result = extractFromMeta($);

    expect(result.productName).toBe('OG Product Title');
    expect(result.description).toBe('OG Product Description');
    expect(result.tagline).toBe('Test Store');
    expect(result.priceValue).toBe(49.99);
    expect(result.currency).toBe('USD');
    expect(result.pricing).toBe('$49.99');
    expect(result.mediaUrls).toHaveLength(1);
    expect(result.mediaUrls[0].url).toBe('https://example.com/og-image.jpg');
  });

  it('should extract Twitter Card tags', () => {
    const html = `
      <html>
        <head>
          <meta name="twitter:title" content="Twitter Title" />
          <meta name="twitter:description" content="Twitter Description" />
          <meta name="twitter:image" content="https://example.com/twitter-image.jpg" />
        </head>
        <body></body>
      </html>
    `;

    const $ = cheerio.load(html);
    const result = extractFromMeta($);

    expect(result.productName).toBe('Twitter Title');
    expect(result.description).toBe('Twitter Description');
    expect(result.mediaUrls).toHaveLength(1);
    expect(result.mediaUrls[0].url).toBe(
      'https://example.com/twitter-image.jpg',
    );
  });

  it('should fallback to title tag when no OG/Twitter title', () => {
    const html = `
      <html>
        <head>
          <title>Page Title</title>
          <meta name="description" content="Meta Description" />
        </head>
        <body></body>
      </html>
    `;

    const $ = cheerio.load(html);
    const result = extractFromMeta($);

    expect(result.productName).toBe('Page Title');
    expect(result.description).toBe('Meta Description');
  });

  it('should extract keywords', () => {
    const html = `
      <html>
        <head>
          <meta name="keywords" content="product, test, example" />
        </head>
        <body></body>
      </html>
    `;

    const $ = cheerio.load(html);
    const result = extractFromMeta($);

    expect(result.keywords).toEqual(['product', 'test', 'example']);
  });

  it('should extract video URLs', () => {
    const html = `
      <html>
        <head>
          <meta property="og:video" content="https://example.com/video.mp4" />
        </head>
        <body></body>
      </html>
    `;

    const $ = cheerio.load(html);
    const result = extractFromMeta($);

    expect(result.mediaUrls).toHaveLength(1);
    expect(result.mediaUrls[0].url).toBe('https://example.com/video.mp4');
    expect(result.mediaUrls[0].type).toBe('video');
  });

  it('should handle empty meta tags', () => {
    const html = `
      <html>
        <head></head>
        <body></body>
      </html>
    `;

    const $ = cheerio.load(html);
    const result = extractFromMeta($);

    expect(result.productName).toBeNull();
    expect(result.description).toBeNull();
    expect(result.mediaUrls).toHaveLength(0);
  });
});
