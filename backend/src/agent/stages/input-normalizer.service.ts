import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { NormalizedRequest } from '../contracts/normalized-request';

/**
 * InputNormalizerService - Validates and normalizes user input
 *
 * First stage in the pipeline - ensures all inputs are valid and have defaults
 */
@Injectable()
export class InputNormalizerService {
  private readonly logger = new Logger(InputNormalizerService.name);

  private readonly VALID_PLATFORMS = [
    'tiktok',
    'instagram_reels',
    'youtube_shorts',
  ] as const;
  private readonly VALID_ASPECT_RATIOS = ['9:16', '16:9', '1:1'] as const;
  private readonly MAX_PROMPT_LENGTH = 2000;
  private readonly MAX_URLS = 10;
  private readonly MAX_DESCRIPTION_LENGTH = 5000;
  private readonly MAX_BENEFITS = 20;

  normalize(
    jobId: string,
    businessId: string,
    rawInput: Partial<NormalizedRequest>,
  ): Promise<NormalizedRequest> {
    this.logger.log(`Normalizing input for job ${jobId}`);

    // Validate IDs
    this.validateId(jobId, 'jobId');
    this.validateId(businessId, 'businessId');

    // Validate and normalize prompt
    const prompt = this.validatePrompt(rawInput.prompt);

    // Validate and normalize platform
    const platform = this.validatePlatform(rawInput.platform);

    // Validate and normalize aspect ratio
    const aspectRatio = this.validateAspectRatio(rawInput.aspectRatio);

    // Validate and normalize language
    const language = this.validateLanguage(rawInput.language);

    // Validate and normalize product data
    const product = this.validateProduct(rawInput.product);

    const normalized: NormalizedRequest = {
      jobId,
      businessId,
      prompt,
      platform,
      aspectRatio,
      durationSec: 8, // MVP: always 8 seconds
      language,
      product,
      tone: this.validateString(rawInput.tone, 100),
      targetAudience: this.validateString(rawInput.targetAudience, 200),
      cta: this.validateString(rawInput.cta, 100),
      visualStyle: this.validateString(rawInput.visualStyle, 100),
      subtitleStyle: this.validateSubtitleStyle(rawInput.subtitleStyle),
      disableBackgroundMusic: Boolean(rawInput.disableBackgroundMusic),
      disableCaptions: Boolean(rawInput.disableCaptions),
      disableCtaOverlay: Boolean(rawInput.disableCtaOverlay),
      normalizedAt: new Date(),
    };

    return Promise.resolve(normalized);
  }

  private validateId(id: string, fieldName: string): void {
    if (!id || typeof id !== 'string') {
      throw new BadRequestException(`${fieldName} is required`);
    }
    if (!/^[a-zA-Z0-9-_]+$/.test(id)) {
      throw new BadRequestException(`Invalid ${fieldName} format`);
    }
  }

  private validatePrompt(prompt: unknown): string {
    if (!prompt || typeof prompt !== 'string') {
      throw new BadRequestException('Prompt is required');
    }
    const trimmed = prompt.trim();
    if (trimmed.length === 0) {
      throw new BadRequestException('Prompt cannot be empty');
    }
    if (trimmed.length > this.MAX_PROMPT_LENGTH) {
      throw new BadRequestException(
        `Prompt exceeds maximum length of ${this.MAX_PROMPT_LENGTH} characters`,
      );
    }
    return trimmed;
  }

  private validatePlatform(
    platform: unknown,
  ): 'tiktok' | 'instagram_reels' | 'youtube_shorts' {
    if (!platform) {
      return 'tiktok'; // Default
    }
    if (!this.VALID_PLATFORMS.includes(platform as never)) {
      throw new BadRequestException('Invalid platform');
    }
    return platform as 'tiktok' | 'instagram_reels' | 'youtube_shorts';
  }

  private validateAspectRatio(aspectRatio: unknown): '9:16' | '16:9' | '1:1' {
    if (!aspectRatio) {
      return '9:16'; // Default
    }
    if (!this.VALID_ASPECT_RATIOS.includes(aspectRatio as never)) {
      throw new BadRequestException('Invalid aspect ratio');
    }
    return aspectRatio as '9:16' | '16:9' | '1:1';
  }

  private validateLanguage(language: unknown): string {
    if (!language || typeof language !== 'string') {
      return 'en'; // Default
    }
    // Basic ISO 639-1 validation (2-letter code)
    if (!/^[a-z]{2}$/.test(language)) {
      throw new BadRequestException('Invalid language code');
    }
    return language;
  }

  private validateString(
    value: unknown,
    maxLength: number,
  ): string | undefined {
    if (!value) return undefined;
    if (typeof value !== 'string') {
      throw new BadRequestException('Invalid string value');
    }
    const trimmed = value.trim();
    if (trimmed.length > maxLength) {
      throw new BadRequestException(`String exceeds maximum length`);
    }
    return trimmed || undefined;
  }

  private validateSubtitleStyle(
    style: unknown,
  ): 'standard' | 'kinetic' | undefined {
    if (!style) return undefined;
    if (style !== 'standard' && style !== 'kinetic') {
      throw new BadRequestException('Invalid subtitle style');
    }
    return style;
  }

  private validateProduct(
    product: unknown,
  ): NormalizedRequest['product'] | undefined {
    if (!product || typeof product !== 'object') {
      return undefined;
    }

    // Type guard to check if product has expected shape
    const isProductLike = (
      obj: object,
    ): obj is Partial<NonNullable<NormalizedRequest['product']>> => {
      return true; // We'll validate fields individually below
    };

    if (!isProductLike(product)) {
      return undefined;
    }

    const prod = product;

    // Validate URLs
    let urls: string[] | undefined;
    if (prod.urls) {
      if (!Array.isArray(prod.urls)) {
        throw new BadRequestException('Product URLs must be an array');
      }
      if (prod.urls.length > this.MAX_URLS) {
        throw new BadRequestException(
          `Maximum ${this.MAX_URLS} product URLs allowed`,
        );
      }
      urls = prod.urls.map((url) => {
        if (typeof url !== 'string') {
          throw new BadRequestException('Invalid product URL');
        }
        // SSRF prevention: validate URL protocol and hostname
        this.validateUrlForSsrf(url);
        return url;
      });
    }

    // Validate benefits
    let benefits: string[] | undefined;
    if (prod.benefits) {
      if (!Array.isArray(prod.benefits)) {
        throw new BadRequestException('Product benefits must be an array');
      }
      if (prod.benefits.length > this.MAX_BENEFITS) {
        throw new BadRequestException(
          `Maximum ${this.MAX_BENEFITS} benefits allowed`,
        );
      }
      benefits = prod.benefits.map((benefit) => {
        if (typeof benefit !== 'string') {
          throw new BadRequestException('Invalid benefit');
        }
        return benefit.trim();
      });
    }

    return {
      name: this.validateString(prod.name, 200),
      description: this.validateString(
        prod.description,
        this.MAX_DESCRIPTION_LENGTH,
      ),
      benefits,
      urls,
      pricing: this.validateString(prod.pricing, 200),
      offers: this.validateString(prod.offers, 500),
    };
  }

  /**
   * Validate URL for SSRF prevention
   * Only allow http/https protocols and block localhost/private IPs
   */
  private validateUrlForSsrf(url: string): void {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new BadRequestException('Invalid product URL format');
    }

    // Only allow http and https protocols
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new BadRequestException(
        'Only http and https protocols are allowed',
      );
    }

    const hostname = parsedUrl.hostname.toLowerCase();

    // Block localhost variations
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname === '0:0:0:0:0:0:0:1'
    ) {
      throw new BadRequestException('Localhost URLs are not allowed');
    }

    // Block private IP ranges (IPv4)
    // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipv4Match = hostname.match(ipv4Regex);
    if (ipv4Match) {
      const octets = ipv4Match.slice(1).map(Number);
      const [a, b] = octets;

      // Validate octets are in range 0-255
      if (octets.some((octet) => octet > 255)) {
        throw new BadRequestException('Invalid IP address');
      }

      // Block private ranges
      if (
        a === 10 || // 10.0.0.0/8
        (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
        (a === 192 && b === 168) || // 192.168.0.0/16
        (a === 169 && b === 254) // 169.254.0.0/16 (link-local)
      ) {
        throw new BadRequestException('Private IP addresses are not allowed');
      }
    }

    // Block private IPv6 ranges (simplified check)
    if (hostname.includes(':')) {
      // Block link-local (fe80::/10) and unique local (fc00::/7)
      if (hostname.startsWith('fe80:') || hostname.startsWith('fc')) {
        throw new BadRequestException('Private IPv6 addresses are not allowed');
      }
    }
  }
}
