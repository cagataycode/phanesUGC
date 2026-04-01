import { fetchWithAuth } from "./api-client";

export interface ScrapeRequestPayload {
  url: string;
  usePlaywrightFallback?: boolean;
}

export interface MediaAsset {
  url: string;
  type: "image" | "video";
  alt?: string;
  width?: number;
  height?: number;
}

export interface ProductExtraction {
  productName: string | null;
  tagline: string | null;
  description: string | null;
  benefits: string[];
  painPoints: string[];
  pricing: string | null;
  currency: string | null;
  priceValue: number | null;
  mediaUrls: MediaAsset[];
  ctaText: string | null;
  brandColors: string[];
  rawText: string;
  sourceUrl: string;
}

export interface ScrapeResult {
  sourceUrl: string;
  status: "success" | "partial" | "failed";
  extraction: ProductExtraction | null;
  error?: string;
  scrapedAt: string;
  method: "cheerio" | "playwright";
  durationMs: number;
}

/**
 * Scrape a product URL using the backend scraper service.
 */
export async function scrapeProductUrl(
  data: ScrapeRequestPayload,
): Promise<ScrapeResult> {
  const res = await fetchWithAuth("/scraper/scrape", {
    method: "POST",
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    let errorMsg = "Scraping failed";
    try {
      const errorData = await res.json();
      errorMsg = errorData.error || errorData.message || errorMsg;
    } catch {
      errorMsg = await res.text();
    }
    throw new Error(errorMsg);
  }

  return res.json() as Promise<ScrapeResult>;
}
