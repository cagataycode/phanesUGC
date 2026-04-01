import { Injectable, Logger } from '@nestjs/common';
import { NormalizedRequest } from '../contracts/normalized-request';

/**
 * InputNormalizerService - Validates and normalizes user input
 *
 * First stage in the pipeline - ensures all inputs are valid and have defaults
 */
@Injectable()
export class InputNormalizerService {
  private readonly logger = new Logger(InputNormalizerService.name);

  normalize(
    jobId: string,
    businessId: string,
    rawInput: Record<string, unknown>,
  ): Promise<NormalizedRequest> {
    this.logger.log(`Normalizing input for job ${jobId}`);

    // TODO: Implement validation and normalization logic
    // For now, return a minimal valid structure
    const normalized: NormalizedRequest = {
      jobId,
      businessId,
      prompt: typeof rawInput.prompt === 'string' ? rawInput.prompt : '',
      platform: (rawInput.platform as 'tiktok') || 'tiktok',
      aspectRatio: (rawInput.aspectRatio as '9:16') || '9:16',
      durationSec: 8, // MVP: always 8 seconds
      language:
        typeof rawInput.language === 'string' ? rawInput.language : 'en',
      normalizedAt: new Date(),
    };

    return Promise.resolve(normalized);
  }
}
