import { Injectable, Logger } from '@nestjs/common';
import { ScriptGenerationService } from '../../ads/services/script-generation.service';
import { AdScript } from '../contracts/ad-script';
import { CreativeBrief } from '../contracts/creative-brief';
import { DtoMapper } from '../utils';

/**
 * ScriptGeneratorService - Adapter for existing ScriptGenerationService
 *
 * Converts agent contracts to ads types and calls the existing service.
 * This avoids duplication and maintains consistency with the working pipeline.
 */
@Injectable()
export class ScriptGeneratorService {
  private readonly logger = new Logger(ScriptGeneratorService.name);

  constructor(
    private readonly scriptGenerationService: ScriptGenerationService,
  ) {}

  generate(jobId: string, scenarioId: number): Promise<AdScript> {
    this.logger.log(
      `Generating script for job ${jobId}, scenario ${scenarioId}`,
    );

    // For now, we need the brief to generate the script
    // In a real implementation, we'd load it from state
    // This is a placeholder - the orchestrator should pass the brief
    throw new Error(
      'ScriptGeneratorService.generate needs to be called with brief parameter',
    );
  }

  /**
   * Generate script from brief (called by orchestrator with brief from state)
   */
  async generateFromBrief(
    jobId: string,
    scenarioId: number,
    brief: CreativeBrief,
  ): Promise<AdScript> {
    this.logger.log(
      `Generating script for job ${jobId}, scenario ${scenarioId}`,
    );

    // Convert agent brief to ads brief using shared utility
    const adsBrief = DtoMapper.toAdsBrief(brief);

    // Use existing ads service
    const adsScript = await this.scriptGenerationService.generate(adsBrief);

    // Convert ads script to agent contract using shared utility
    const agentScript = DtoMapper.toAgentScript(adsScript, jobId, scenarioId);

    this.logger.log(
      `Script generated: "${agentScript.title}", ${agentScript.fullText.length} chars`,
    );

    return agentScript;
  }
}
