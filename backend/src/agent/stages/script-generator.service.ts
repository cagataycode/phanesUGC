import { Injectable, Logger } from '@nestjs/common';
import { ScriptGenerationService } from '../../ads/services/script-generation.service';
import { AdScript } from '../contracts/ad-script';
import { CreativeBrief } from '../contracts/creative-brief';
import { CreativeBrief as AdsCreativeBrief } from '../../ads/types/creative-brief';

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

    // Convert agent brief to ads brief
    const adsBrief = this.toAdsBrief(brief);

    // Use existing ads service
    const adsScript = await this.scriptGenerationService.generate(adsBrief);

    // Convert ads script to agent contract
    const agentScript: AdScript = {
      jobId,
      scenarioId,
      title: adsScript.title || 'Untitled',
      hook: adsScript.hook || '',
      voiceoverLines: [
        {
          text: adsScript.full_text,
          estimatedDurationSec: 8,
          scene: 1,
        },
      ],
      cta: adsScript.cta || 'Learn more',
      fullText: adsScript.full_text,
      visualDescription: adsScript.visual_description,
      totalEstimatedDuration: 8,
      generatedAt: new Date(),
    };

    this.logger.log(
      `Script generated: "${agentScript.title}", ${agentScript.fullText.length} chars`,
    );

    return agentScript;
  }

  private toAdsBrief(brief: CreativeBrief): AdsCreativeBrief {
    return {
      product_name: brief.productName,
      offer: brief.offer,
      audience: brief.audience,
      pain_points: brief.painPoints,
      benefits: brief.keyBenefits,
      tone: brief.tone,
      language: brief.language,
      duration_sec: brief.targetDuration,
      platform: brief.targetPlatform,
      cta: brief.cta,
      visual_style: brief.visualStyle,
      aspect_ratio: brief.targetAspectRatio,
      key_message: brief.keyMessage,
    };
  }
}
