/**
 * JSON-LD Extractor Tests
 */

import * as cheerio from 'cheerio';
import { extractFromJsonLd } from './jsonld-extractor';

describe('JSON-LD Extractor', () => {
  it('should extract product data from JSON-LD', () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org/",
              "@type": "Product",
              "name": "Test Product",
              "description": "A great test product",
              "image": ["https://example.com/image1.jpg", "https://example.com/image2.jpg"],
              "brand": {
                "@type": "Brand",
                "name": "Test Brand"
              },
              "offers": {
                "@type": "Offer",
                "price": "29.99",
                "priceCurrency": "USD"
              },
              "review": [
                {
                  "@type": "Review",
                  "reviewBody": "Great product!",
                  "author": {
                    "@type": "Person",
                    "name": "John Doe"
                  },
                  "reviewRating": {
                    "@type": "Rating",
                    "ratingValue": "5"
                  }
                }
              ]
            }
          </script>
        </head>
        <body></body>
      </html>
    `;

    const $ = cheerio.load(html);
    const result = extractFromJsonLd($);

    expect(result.productName).toBe('Test Product');
    expect(result.description).toBe('A great test product');
    expect(result.brandName).toBe('Test Brand');
    expect(result.priceValue).toBe(29.99);
    expect(result.currency).toBe('USD');
    expect(result.pricing).toBe('$29.99');
    expect(result.mediaUrls).toHaveLength(2);
    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0].text).toBe('Great product!');
    expect(result.reviews[0].author).toBe('John Doe');
    expect(result.reviews[0].rating).toBe(5);
  });

  it('should handle @graph structures', () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org/",
              "@graph": [
                {
                  "@type": "Product",
                  "name": "Graph Product",
                  "description": "Product from graph"
                },
                {
                  "@type": "Organization",
                  "name": "Test Org"
                }
              ]
            }
          </script>
        </head>
        <body></body>
      </html>
    `;

    const $ = cheerio.load(html);
    const result = extractFromJsonLd($);

    expect(result.productName).toBe('Graph Product');
    expect(result.description).toBe('Product from graph');
  });

  it('should return null values when no JSON-LD is present', () => {
    const html = `
      <html>
        <head></head>
        <body></body>
      </html>
    `;

    const $ = cheerio.load(html);
    const result = extractFromJsonLd($);

    expect(result.productName).toBeNull();
    expect(result.description).toBeNull();
    expect(result.mediaUrls).toHaveLength(0);
    expect(result.reviews).toHaveLength(0);
  });

  it('should handle invalid JSON-LD gracefully', () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            { invalid json }
          </script>
        </head>
        <body></body>
      </html>
    `;

    const $ = cheerio.load(html);
    const result = extractFromJsonLd($);

    expect(result.productName).toBeNull();
    expect(result.description).toBeNull();
  });

  it('should handle string brand', () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@type": "Product",
              "name": "Test Product",
              "brand": "Simple Brand"
            }
          </script>
        </head>
        <body></body>
      </html>
    `;

    const $ = cheerio.load(html);
    const result = extractFromJsonLd($);

    expect(result.brandName).toBe('Simple Brand');
  });

  it('should handle multiple offers', () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@type": "Product",
              "name": "Test Product",
              "offers": [
                {
                  "@type": "Offer",
                  "price": "19.99",
                  "priceCurrency": "EUR"
                },
                {
                  "@type": "Offer",
                  "price": "24.99",
                  "priceCurrency": "USD"
                }
              ]
            }
          </script>
        </head>
        <body></body>
      </html>
    `;

    const $ = cheerio.load(html);
    const result = extractFromJsonLd($);

    expect(result.priceValue).toBe(19.99);
    expect(result.currency).toBe('EUR');
  });
});
