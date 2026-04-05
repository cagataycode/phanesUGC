/**
 * DtoMapper - Centralized DTO conversion utilities
 *
 * Single source of truth for converting between agent contracts
 * and ads DTOs. Eliminates duplicate conversion logic across adapters.
 */

import { NormalizedRequest } from '../contracts/normalized-request';
import { ProductContext } from '../contracts/product-context';
import { CreativeBrief } from '../contracts/creative-brief';
import { AdScript } from '../contracts/ad-script';
import { VeoPrompt } from '../contracts/veo-prompt';
import { CreateAdDto } from '../../ads/dto/create-ad.dto';
import { CreativeBrief as AdsCreativeBrief } from '../../ads/types/creative-brief';
import { GeneratedScript } from '../../ads/types/generated-script';
import { VeoScenePrompt } from '../../ads/types/veo-scene-prompt';
import { PlatformMapper } from './platform-mapper';

export class DtoMapper {
  /**
   * Convert NormalizedRequest + ProductContext to CreateAdDto
   */
  static toCreateAdDto(
    request: NormalizedRequest,
    productContext: ProductContext,
    brief?: CreativeBrief,
  ): CreateAdDto {
    return {
      businessId: request.businessId,
      productId: 'agent-generated',
      createdBy: 'agent',
      prompt_inputs: {
        prompt: request.prompt,
        platform: PlatformMapper.toAdsFormat(request.platform),
        language: request.language,
        product_info: {
          name: productContext.name,
          description: productContext.description,
          benefits: productContext.benefits,
        },
        urls: request.product?.urls,
        target_audience: request.targetAudience,
        tone: brief?.tone || request.tone,
        cta: brief?.cta || request.cta,
        subtitle_style: request.subtitleStyle || 'standard',
      },
      veo_config: {
        aspect_ratio: request.aspectRatio,
        duration_sec: request.durationSec as 8,
        person_generation: undefined,
        enhance_prompt: false,
      },
    };
  }

  /**
   * Convert agent CreativeBrief to ads CreativeBrief
   */
  static toAdsBrief(brief: CreativeBrief): AdsCreativeBrief {
    return {
      product_name: brief.productName,
      offer: brief.offer,
      audience: brief.audience,
      pain_points: brief.painPoints,
      benefits: brief.keyBenefits,
      tone: brief.tone,
      language: brief.language,
      duration_sec: brief.targetDuration,
      platform: PlatformMapper.toAdsFormat(brief.targetPlatform),
      cta: brief.cta,
      visual_style: brief.visualStyle,
      aspect_ratio: brief.targetAspectRatio,
      key_message: brief.keyMessage,
    };
  }

  /**
   * Convert ads CreativeBrief to agent CreativeBrief
   */
  static toAgentBrief(
    adsBrief: AdsCreativeBrief,
    productContext: ProductContext,
  ): CreativeBrief {
    // Convert platform from ads format to agent format with fallback
    let targetPlatform: 'tiktok' | 'instagram_reels' | 'youtube_shorts';
    try {
      targetPlatform = PlatformMapper.toAgentFormat(
        adsBrief.platform as 'tiktok' | 'instagram' | 'youtube',
      );
    } catch {
      // Fallback to default if platform is invalid
      targetPlatform = 'tiktok';
    }

    // Validate and normalize aspect ratio (only 9:16 and 16:9 supported)
    let targetAspectRatio: '9:16' | '16:9';
    if (adsBrief.aspect_ratio === '16:9') {
      targetAspectRatio = '16:9';
    } else if (adsBrief.aspect_ratio === '1:1') {
      // Legacy 1:1 format no longer supported, default to 9:16
      targetAspectRatio = '9:16';
    } else {
      // Default to 9:16 for any other value
      targetAspectRatio = '9:16';
    }

    return {
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
      targetPlatform,
      targetDuration: adsBrief.duration_sec || 8,
      targetAspectRatio,
      language: adsBrief.language || 'en',
      createdAt: new Date(),
    };
  }

  /**
   * Convert agent AdScript to ads GeneratedScript
   */
  static toAdsScript(script: AdScript): GeneratedScript {
    return {
      title: script.title,
      hook: script.hook,
      body: script.voiceoverLines.map((l) => l.text).join(' '),
      cta: script.cta,
      full_text: script.fullText,
      visual_description: script.visualDescription,
    };
  }

  /**
   * Convert ads GeneratedScript to agent AdScript
   */
  static toAgentScript(
    adsScript: GeneratedScript,
    jobId: string,
    scenarioId: number,
  ): AdScript {
    return {
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
  }

  /**
   * Convert ads VeoScenePrompt to agent VeoPrompt
   */
  static toAgentVeoPrompt(
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
