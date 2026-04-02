import { Injectable, Logger } from '@nestjs/common';
import { SceneStructuringService } from '../../ads/services/scene-structuring.service';
import { AdScript } from '../contracts/ad-script';
import { VeoPrompt } from '../contracts/veo-prompt';
import { CreativeBrief } from '../contracts/creative-brief';
import { ProductContext } from '../contracts/product-context';
import { NormalizedRequest } from '../contracts/normalized-request';
import { DtoMapper } from '../utils';

/**
 * VeoPromptBuilderService - Adapter for existing SceneStructuringService
 *
 * Converts agent contracts to ads types and calls the existing services.
 * This avoids duplication and maintains consistency with the working pipeline.
 */
@Injectable()
export class VeoPromptBuilderService {
  private readonly logger = new Logger(VeoPromptBuilderService.name);

  constructor(
    private readonly sceneStructuringService: SceneStructuringService,
  ) {}

  async build(
    jobId: string,
    script: AdScript,
    brief: CreativeBrief,
    productContext: ProductContext,
    normalizedRequest: NormalizedRequest,
  ): Promise<VeoPrompt> {
    this.logger.log(`Building Veo prompt for job ${jobId}`);

    // Convert agent contracts to ads types using shared utilities
    const createAdDto = DtoMapper.toCreateAdDto(
      normalizedRequest,
      productContext,
      brief,
    );
    const adsBrief = DtoMapper.toAdsBrief(brief);
    const adsScript = DtoMapper.toAdsScript(script);

    // Use existing ads service to structure the scene
    const scenePrompt = await this.sceneStructuringService.structureSingleScene(
      createAdDto,
      adsBrief,
      adsScript,
    );

    // Convert ads scene prompt to agent VeoPrompt contract using shared utility
    const veoPrompt = DtoMapper.toAgentVeoPrompt(jobId, scenePrompt);

    this.logger.log(`Veo prompt built successfully for job ${jobId}`);
    return veoPrompt;
  }
}
