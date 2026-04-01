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
    rawInput: Record<string, unknown>,
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

    const prod = product as Record<string, unknown>;

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
        // TODO: Add URL validation before production (SSRF prevention)
        // For now, just validate it's a valid URL format
        try {
          new URL(url);
          return url;
        } catch {
          throw new BadRequestException('Invalid product URL format');
        }
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
}
