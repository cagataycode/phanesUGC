import { Injectable, Logger } from '@nestjs/common';
import { BriefGenerationService } from '../../ads/services/brief-generation.service';
import { NormalizedRequest } from '../contracts/normalized-request';
import { ProductContext } from '../contracts/product-context';
import { CreativeBrief } from '../contracts/creative-brief';
import { CreateAdDto } from '../../ads/dto/create-ad.dto';

/**
 * BriefBuilderService - Adapter for existing BriefGenerationService
 *
 * Converts agent contracts to ads DTOs and calls the existing service.
 * This avoids duplication and maintains consistency with the working pipeline.
 */
@Injectable()
export class BriefBuilderService {
  private readonly logger = new Logger(BriefBuilderService.name);

  constructor(
    private readonly briefGenerationService: BriefGenerationService,
  ) {}

  async build(
    request: NormalizedRequest,
    productContext: ProductContext,
  ): Promise<CreativeBrief> {
    this.logger.log(`Building creative brief for job ${request.jobId}`);

    // Convert agent contracts to ads DTO
    const createAdDto = this.toCreateAdDto(request, productContext);

    // Use existing ads service
    const adsBrief = await this.briefGenerationService.generate(createAdDto);

    // Convert ads brief to agent contract
    const agentBrief: CreativeBrief = {
      productName: adsBrief.product_name || productContext.name,
      productCategory: productContext.category,
      offer: adsBrief.offer || 'Special offer',
      audience: adsBrief.audience || 'General audience',
      painPoints: adsBrief.pain_points || [],
      keyBenefits: adsBrief.benefits || [],
      tone: (adsBrief.tone || 'direct') as
        | 'direct'
        | 'professional'
        | 'casual'
        | 'enthusiastic',
      cta: adsBrief.cta || 'Learn more',
      visualStyle: (adsBrief.visual_style || 'cinematic') as
        | 'dynamic'
        | 'minimalist'
        | 'bold'
        | 'cinematic',
      keyMessage: adsBrief.key_message || 'Discover our product',
      targetPlatform: adsBrief.platform as
        | 'tiktok'
        | 'instagram_reels'
        | 'youtube_shorts',
      targetDuration: adsBrief.duration_sec || 8,
      targetAspectRatio: adsBrief.aspect_ratio as '9:16' | '16:9' | '1:1',
      language: adsBrief.language || 'en',
      createdAt: new Date(),
    };

    this.logger.log(
      `Brief built: product="${agentBrief.productName}", tone="${agentBrief.tone}"`,
    );

    return agentBrief;
  }

  private toCreateAdDto(
    request: NormalizedRequest,
    productContext: ProductContext,
  ): CreateAdDto {
    // Map agent platform to ads platform
    const platformMap: Record<string, 'tiktok' | 'instagram' | 'youtube'> = {
      tiktok: 'tiktok',
      instagram_reels: 'instagram',
      youtube_shorts: 'youtube',
    };

    return {
      businessId: request.businessId,
      productId: 'agent-generated',
      createdBy: 'agent',
      prompt_inputs: {
        prompt: request.prompt,
        platform: platformMap[request.platform] || 'tiktok',
        language: request.language,
        product_info: {
          name: productContext.name,
          description: productContext.description,
          benefits: productContext.benefits,
        },
        target_audience: request.targetAudience,
        tone: request.tone,
        cta: request.cta,
        subtitle_style: request.subtitleStyle || 'kinetic',
      },
      veo_config: {
        aspect_ratio: request.aspectRatio,
        duration_sec: request.durationSec as 8,
        person_generation: undefined, // Don't set dont_allow, just leave undefined
        enhance_prompt: false,
      },
    };
  }
}
