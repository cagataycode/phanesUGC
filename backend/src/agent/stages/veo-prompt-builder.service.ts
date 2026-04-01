import { Injectable, Logger } from '@nestjs/common';
import { AdScript } from '../contracts/ad-script';
import { VeoPrompt } from '../contracts/veo-prompt';

/**
 * VeoPromptBuilderService - Builds Veo-ready structured prompt
 *
 * Uses Gemini to translate script into Veo 3.1 JSON format
 */
@Injectable()
export class VeoPromptBuilderService {
  private readonly logger = new Logger(VeoPromptBuilderService.name);

  build(jobId: string, script: AdScript): Promise<VeoPrompt> {
    this.logger.log(`Building Veo prompt for job ${jobId}`);

    // TODO: Implement Gemini-based Veo prompt generation
    // For now, return a minimal valid structure
    const prompt: VeoPrompt = {
      sceneId: 1,
      projectId: jobId,
      durationSeconds: 8,
      aspectRatio: '9:16',
      prompt: {
        intent: 'Product advertisement',
        shot: {
          type: 'medium',
          framing: 'centered',
          cameraAngle: 'eye-level',
          cameraMotion: 'static',
          lensFeel: 'standard',
          composition: 'rule-of-thirds',
        },
        subject: {
          type: 'product',
          description: 'Product showcase',
          action: 'Display product features',
        },
        environment: {
          location: 'Studio',
          props: [],
          atmosphere: 'Professional',
        },
        lighting: {
          style: 'soft',
          colorTemperature: 'neutral',
        },
        audio: {
          speechText: script.fullText,
          speechStyle: 'enthusiastic',
        },
        style: {
          visualStyle: 'modern',
          colorPalette: 'vibrant',
          renderingQuality: 'high',
          aestheticReference: 'commercial',
        },
        textOverlay: {
          enabled: false,
        },
        cta: {
          enabled: true,
          text: script.cta,
        },
      },
      transitionIn: 'fade',
      transitionOut: 'fade',
      negativePrompt: 'low quality, blurry, distorted',
      generationConfig: {
        model: 'veo-3.1',
        safetyFilter: 'standard',
        retryCount: 0,
        priority: 'normal',
      },
      builtAt: new Date(),
    };

    return Promise.resolve(prompt);
  }
}
