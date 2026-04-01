import { Injectable, Logger } from '@nestjs/common';
import { NormalizedRequest } from '../contracts/normalized-request';
import { ProductContext } from '../contracts/product-context';
import { CreativeBrief } from '../contracts/creative-brief';

/**
 * BriefBuilderService - Builds creative brief using AI
 *
 * Uses Gemini to synthesize normalized request + product context into a structured brief
 */
@Injectable()
export class BriefBuilderService {
  private readonly logger = new Logger(BriefBuilderService.name);

  build(
    request: NormalizedRequest,
    context: ProductContext,
  ): Promise<CreativeBrief> {
    this.logger.log(`Building creative brief for job ${request.jobId}`);

    // TODO: Implement Gemini-based brief generation
    // For now, return a minimal valid structure
    const brief: CreativeBrief = {
      productName: context.name,
      productCategory: context.category,
      offer: request.prompt,
      audience: request.targetAudience || 'General audience',
      painPoints: [],
      keyBenefits: context.benefits,
      tone: 'enthusiastic',
      cta: request.cta || 'Learn more',
      visualStyle: 'dynamic',
      keyMessage: request.prompt,
      targetPlatform: request.platform,
      targetDuration: request.durationSec,
      targetAspectRatio: request.aspectRatio,
      language: request.language,
      createdAt: new Date(),
    };

    return Promise.resolve(brief);
  }
}
