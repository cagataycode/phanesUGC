import { Injectable, Logger } from '@nestjs/common';
import { SceneStructuringService } from '../../ads/services/scene-structuring.service';
import { VeoPromptBuilderService as AdsVeoPromptBuilderService } from '../../ads/services/veo-prompt-builder.service';
import { AdScript } from '../contracts/ad-script';
import { VeoPrompt } from '../contracts/veo-prompt';
import { CreativeBrief } from '../contracts/creative-brief';
import { ProductContext } from '../contracts/product-context';
import { NormalizedRequest } from '../contracts/normalized-request';
import { CreateAdDto } from '../../ads/dto/create-ad.dto';
import { CreativeBrief as AdsCreativeBrief } from '../../ads/types/creative-brief';
import { GeneratedScript } from '../../ads/types/generated-script';
import { VeoScenePrompt } from '../../ads/types/veo-scene-prompt';

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
    private readonly adsVeoPromptBuilder: AdsVeoPromptBuilderService,
  ) {}

  async build(
    jobId: string,
    script: AdScript,
    brief: CreativeBrief,
    productContext: ProductContext,
    normalizedRequest: NormalizedRequest,
  ): Promise<VeoPrompt> {
    this.logger.log(`Building Veo prompt for job ${jobId}`);

    // Convert agent contracts to ads types
    const createAdDto = this.toCreateAdDto(
      normalizedRequest,
      productContext,
      brief,
    );
    const adsBrief = this.toAdsBrief(brief);
    const adsScript = this.toAdsScript(script);

    // Use existing ads service to structure the scene
    const scenePrompt = await this.sceneStructuringService.structureSingleScene(
      createAdDto,
      adsBrief,
      adsScript,
    );

    // Convert ads scene prompt to agent VeoPrompt contract
    const veoPrompt = this.toAgentVeoPrompt(jobId, scenePrompt);

    this.logger.log(`Veo prompt built successfully for job ${jobId}`);
    return veoPrompt;
  }

  private toCreateAdDto(
    request: NormalizedRequest,
    productContext: ProductContext,
    brief: CreativeBrief,
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
        tone: brief.tone,
        cta: brief.cta,
        subtitle_style: request.subtitleStyle || 'kinetic',
      },
      veo_config: {
        aspect_ratio: request.aspectRatio,
        duration_sec: 8,
        person_generation: undefined, // Don't set dont_allow, just leave undefined
        enhance_prompt: false,
      },
    };
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

  private toAdsScript(script: AdScript): GeneratedScript {
    return {
      title: script.title,
      hook: script.hook,
      body: script.voiceoverLines.map((l) => l.text).join(' '),
      cta: script.cta,
      full_text: script.fullText,
      visual_description: script.visualDescription,
    };
  }

  private toAgentVeoPrompt(
    jobId: string,
    scenePrompt: VeoScenePrompt,
  ): VeoPrompt {
    return {
      sceneId: scenePrompt.scene_id,
      projectId: jobId,
      durationSeconds: scenePrompt.duration_seconds,
      aspectRatio: scenePrompt.aspect_ratio,
      prompt: {
        intent: scenePrompt.prompt.intent,
        shot: {
          type: scenePrompt.prompt.shot.type,
          framing: scenePrompt.prompt.shot.framing,
          cameraAngle: scenePrompt.prompt.shot.camera_angle,
          cameraMotion: scenePrompt.prompt.shot.camera_motion,
          lensFeel: scenePrompt.prompt.shot.lens_feel,
          composition: scenePrompt.prompt.shot.composition,
        },
        subject: {
          type: scenePrompt.prompt.subject.type as
            | 'product'
            | 'person'
            | 'person_with_product'
            | 'environment',
          description: scenePrompt.prompt.subject.description,
          action: scenePrompt.prompt.subject.action,
          identityNotes: scenePrompt.prompt.subject.identity_notes || undefined,
        },
        environment: {
          location: scenePrompt.prompt.environment.location,
          props: scenePrompt.prompt.environment.props,
          atmosphere: scenePrompt.prompt.environment.atmosphere,
          timeOfDay: scenePrompt.prompt.environment.time_of_day || undefined,
        },
        lighting: {
          style: scenePrompt.prompt.lighting.style,
          colorTemperature: scenePrompt.prompt.lighting.color_temperature,
          practicalLights:
            scenePrompt.prompt.lighting.practical_lights || undefined,
        },
        audio: {
          speechText: scenePrompt.prompt.audio.speech_text,
          speechStyle: scenePrompt.prompt.audio.speech_style,
          ambientSound: scenePrompt.prompt.audio.ambient_sound || undefined,
          musicSuggestion:
            scenePrompt.prompt.audio.music_suggestion || undefined,
        },
        style: {
          visualStyle: scenePrompt.prompt.style.visual_style,
          colorPalette: scenePrompt.prompt.style.color_palette,
          renderingQuality: scenePrompt.prompt.style.rendering_quality,
          aestheticReference: scenePrompt.prompt.style.aesthetic_reference,
        },
        textOverlay: {
          enabled: scenePrompt.prompt.text_overlay.enabled,
          text: scenePrompt.prompt.text_overlay.text || undefined,
          position: scenePrompt.prompt.text_overlay.position || undefined,
          styleHint: scenePrompt.prompt.text_overlay.style_hint || undefined,
        },
        cta: {
          enabled: scenePrompt.prompt.cta.enabled,
          text: scenePrompt.prompt.cta.text || undefined,
          urlHint: scenePrompt.prompt.cta.url_hint || undefined,
        },
      },
      transitionIn: scenePrompt.transition_in,
      transitionOut: scenePrompt.transition_out,
      negativePrompt: scenePrompt.negative_prompt,
      generationConfig: {
        model: scenePrompt.generation_config.model,
        seed: scenePrompt.generation_config.seed || undefined,
        safetyFilter: scenePrompt.generation_config.safety_filter,
        retryCount: scenePrompt.generation_config.retry_count,
        priority: scenePrompt.generation_config.priority,
      },
      builtAt: new Date(),
    };
  }
}
