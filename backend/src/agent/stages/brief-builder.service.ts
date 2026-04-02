import { Injectable, Logger } from '@nestjs/common';
import { BriefGenerationService } from '../../ads/services/brief-generation.service';
import { NormalizedRequest } from '../contracts/normalized-request';
import { ProductContext } from '../contracts/product-context';
import { CreativeBrief } from '../contracts/creative-brief';
import { DtoMapper } from '../utils';

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

    // Convert agent contracts to ads DTO using shared utility
    const createAdDto = DtoMapper.toCreateAdDto(request, productContext);

    // Use existing ads service
    const adsBrief = await this.briefGenerationService.generate(createAdDto);

    // Convert ads brief to agent contract using shared utility
    const agentBrief = DtoMapper.toAgentBrief(adsBrief, productContext);

    this.logger.log(
      `Brief built: product="${agentBrief.productName}", tone="${agentBrief.tone}"`,
    );

    return agentBrief;
  }
}
