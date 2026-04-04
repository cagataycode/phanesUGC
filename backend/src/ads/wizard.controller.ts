// Above disables are required: @typescript-eslint cannot resolve Zod's
// complex conditional / mapped types, producing false-positive "error typed"
// diagnostics on every .parse() / .format() call and their return values.
import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ZodError, type ZodType } from 'zod';
import {
  GenerateBriefSchema,
  GenerateScriptSchema,
  GenerateSceneSchema,
  GenerateBriefDto,
  GenerateScriptDto,
  GenerateSceneDto,
} from './dto/wizard.dto';
import { BriefBuilderService } from '../agent/stages/brief-builder.service';
import { ScriptGeneratorService } from '../agent/stages/script-generator.service';
import { VeoPromptBuilderService } from '../agent/stages/veo-prompt-builder.service';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { NormalizedRequest } from '../agent/contracts/normalized-request';
import { ProductContext } from '../agent/contracts/product-context';
import { CreativeBrief } from '../agent/contracts/creative-brief';
import { AdScript } from '../agent/contracts/ad-script';
import { v4 as uuidv4 } from 'uuid';

@Controller('wizard')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class WizardController {
  constructor(
    private readonly briefBuilder: BriefBuilderService,
    private readonly scriptGenerator: ScriptGeneratorService,
    private readonly veoPromptBuilder: VeoPromptBuilderService,
  ) {}

  @Post('brief')
  async generateBrief(@Body() body: Record<string, unknown>) {
    const dto = this.zodParse<GenerateBriefDto>(GenerateBriefSchema, body);
    const jobId = uuidv4();
    const normalizedRequest = this.buildNormalizedRequest(dto, jobId);
    const productContext = this.buildProductContext(dto);

    try {
      const brief = await this.briefBuilder.build(
        normalizedRequest,
        productContext,
      );
      return {
        ...this.toFrontendBrief(brief),
        _jobId: jobId,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Brief generation failed',
          details: message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('script')
  async generateScript(@Body() body: Record<string, unknown>) {
    const dto = this.zodParse<GenerateScriptDto>(GenerateScriptSchema, body);
    const brief = this.toAgentBrief(dto.brief);
    const jobId = (dto.brief._jobId as string) || uuidv4();
    const scenarioId = 1;

    try {
      const script = await this.scriptGenerator.generateFromBrief(
        jobId,
        scenarioId,
        brief,
      );
      return {
        ...this.toFrontendScript(script),
        _jobId: jobId,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Script generation failed',
          details: message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('scene')
  async generateScene(@Body() body: Record<string, unknown>) {
    const dto = this.zodParse<GenerateSceneDto>(GenerateSceneSchema, body);
    const brief = this.toAgentBrief(dto.brief);
    const script = this.toAgentScript(dto.script);
    const jobId =
      (dto.script._jobId as string) || (dto.brief._jobId as string) || uuidv4();

    const normalizedRequest = this.buildNormalizedRequestFromScene(dto, jobId);
    const productContext = this.buildProductContextFromScene(dto);

    try {
      const veoPrompt = await this.veoPromptBuilder.build(
        jobId,
        script,
        brief,
        productContext,
        normalizedRequest,
      );
      return {
        ...this.toFrontendScene(veoPrompt),
        _jobId: jobId,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Scene generation failed',
          details: message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /** Parse body with a Zod schema, throwing HttpException on validation failure. */
  private zodParse<T>(schema: ZodType<T>, data: unknown): T {
    try {
      return schema.parse(data);
    } catch (err: unknown) {
      const details =
        err instanceof ZodError
          ? (err.format() as Record<string, unknown>)
          : 'Invalid request';
      throw new HttpException(
        {
          status: HttpStatus.BAD_REQUEST,
          error: 'Validation failed',
          details,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private buildNormalizedRequest(
    dto: GenerateBriefDto,
    jobId: string,
  ): NormalizedRequest {
    return {
      jobId,
      businessId: dto.businessId,
      prompt: dto.prompt,
      platform: this.mapPlatform(dto.platform),
      aspectRatio: '9:16',
      durationSec: 8,
      language: dto.language || 'en',
      product: {
        name: dto.product_info?.name,
        description: dto.product_info?.description,
        benefits: dto.product_info?.benefits,
      },
      tone: dto.tone,
      targetAudience: dto.target_audience,
      cta: dto.cta,
      subtitleStyle: 'kinetic',
      disableBackgroundMusic: false,
      disableCaptions: false,
      disableCtaOverlay: false,
      normalizedAt: new Date(),
    };
  }

  private buildNormalizedRequestFromScene(
    dto: GenerateSceneDto,
    jobId: string,
  ): NormalizedRequest {
    return {
      jobId,
      businessId: dto.businessId,
      prompt: '',
      platform: this.mapPlatform(dto.platform),
      aspectRatio: dto.aspectRatio,
      durationSec: 8,
      language: dto.language || 'en',
      product: {
        name: dto.product_info?.name,
        description: dto.product_info?.description,
        benefits: dto.product_info?.benefits,
      },
      tone: dto.tone,
      targetAudience: dto.target_audience,
      cta: dto.cta,
      subtitleStyle: 'kinetic',
      disableBackgroundMusic: false,
      disableCaptions: false,
      disableCtaOverlay: false,
      normalizedAt: new Date(),
    };
  }

  private buildProductContext(dto: GenerateBriefDto): ProductContext {
    return {
      source: 'manual',
      name: dto.product_info?.name || 'Product',
      description: dto.product_info?.description || '',
      benefits: dto.product_info?.benefits || [],
      acquiredAt: new Date(),
    };
  }

  private buildProductContextFromScene(dto: GenerateSceneDto): ProductContext {
    return {
      source: 'manual',
      name: dto.product_info?.name || 'Product',
      description: dto.product_info?.description || '',
      benefits: dto.product_info?.benefits || [],
      acquiredAt: new Date(),
    };
  }

  private toAgentBrief(data: Record<string, unknown>): CreativeBrief {
    return {
      productName:
        (data.productName as string) ||
        (data.product_name as string) ||
        'Product',
      productCategory:
        (data.productCategory as string) || (data.product_category as string),
      offer: (data.offer as string) || 'Special offer',
      audience: (data.audience as string) || 'General audience',
      painPoints:
        (data.painPoints as string[]) || (data.pain_points as string[]) || [],
      keyBenefits:
        (data.keyBenefits as string[]) || (data.benefits as string[]) || [],
      tone: (data.tone as CreativeBrief['tone']) || 'direct',
      cta: (data.cta as string) || 'Learn more',
      visualStyle:
        (data.visualStyle as CreativeBrief['visualStyle']) ||
        (data.visual_style as CreativeBrief['visualStyle']) ||
        'cinematic',
      keyMessage:
        (data.keyMessage as string) ||
        (data.key_message as string) ||
        'Discover our product',
      targetPlatform: this.mapPlatform(
        (data.targetPlatform as string) ||
          (data.platform as string) ||
          'tiktok',
      ),
      targetDuration:
        (data.targetDuration as number) || (data.duration_sec as number) || 8,
      targetAspectRatio:
        (data.targetAspectRatio as CreativeBrief['targetAspectRatio']) ||
        (data.aspect_ratio as CreativeBrief['targetAspectRatio']) ||
        '9:16',
      language: (data.language as string) || 'en',
      createdAt: new Date(),
    };
  }

  private toAgentScript(data: Record<string, unknown>): AdScript {
    return {
      jobId: (data.jobId as string) || (data._jobId as string) || 'unknown',
      scenarioId: (data.scenarioId as number) || 1,
      title: (data.title as string) || 'Untitled',
      hook: (data.hook as string) || '',
      voiceoverLines: (data.voiceoverLines as AdScript['voiceoverLines']) || [
        {
          text: (data.fullText as string) || (data.full_text as string) || '',
          estimatedDurationSec: 8,
          scene: 1,
        },
      ],
      cta: (data.cta as string) || 'Learn more',
      fullText: (data.fullText as string) || (data.full_text as string) || '',
      visualDescription:
        (data.visualDescription as string) ||
        (data.visual_description as string),
      totalEstimatedDuration: 8,
      generatedAt: new Date(),
    };
  }

  private mapPlatform(
    platform: string,
  ): 'tiktok' | 'instagram_reels' | 'youtube_shorts' {
    if (platform === 'instagram' || platform === 'instagram_reels')
      return 'instagram_reels';
    if (platform === 'youtube' || platform === 'youtube_shorts')
      return 'youtube_shorts';
    return 'tiktok';
  }

  private toFrontendBrief(brief: CreativeBrief): Record<string, unknown> {
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

  private toFrontendScript(script: AdScript): Record<string, unknown> {
    return {
      title: script.title,
      hook: script.hook,
      body: script.voiceoverLines.map((l) => l.text).join(' '),
      cta: script.cta,
      full_text: script.fullText,
      visual_description: script.visualDescription,
    };
  }

  private toFrontendScene(
    veoPrompt: import('../agent/contracts/veo-prompt').VeoPrompt,
  ): Record<string, unknown> {
    return {
      scene_id: veoPrompt.sceneId,
      project_id: veoPrompt.projectId,
      duration_seconds: veoPrompt.durationSeconds,
      aspect_ratio: veoPrompt.aspectRatio,
      prompt: {
        intent: veoPrompt.prompt.intent,
        shot: {
          type: veoPrompt.prompt.shot.type,
          framing: veoPrompt.prompt.shot.framing,
          camera_angle: veoPrompt.prompt.shot.cameraAngle,
          camera_motion: veoPrompt.prompt.shot.cameraMotion,
          lens_feel: veoPrompt.prompt.shot.lensFeel,
          composition: veoPrompt.prompt.shot.composition,
        },
        subject: {
          type: veoPrompt.prompt.subject.type,
          description: veoPrompt.prompt.subject.description,
          action: veoPrompt.prompt.subject.action,
          identity_notes: veoPrompt.prompt.subject.identityNotes,
        },
        environment: {
          location: veoPrompt.prompt.environment.location,
          props: veoPrompt.prompt.environment.props,
          atmosphere: veoPrompt.prompt.environment.atmosphere,
          time_of_day: veoPrompt.prompt.environment.timeOfDay,
        },
        lighting: {
          style: veoPrompt.prompt.lighting.style,
          color_temperature: veoPrompt.prompt.lighting.colorTemperature,
          practical_lights: veoPrompt.prompt.lighting.practicalLights,
        },
        audio: {
          speech_text: veoPrompt.prompt.audio.speechText,
          speech_style: veoPrompt.prompt.audio.speechStyle,
          ambient_sound: veoPrompt.prompt.audio.ambientSound,
          music_suggestion: veoPrompt.prompt.audio.musicSuggestion,
        },
        style: {
          visual_style: veoPrompt.prompt.style.visualStyle,
          color_palette: veoPrompt.prompt.style.colorPalette,
          rendering_quality: veoPrompt.prompt.style.renderingQuality,
          aesthetic_reference: veoPrompt.prompt.style.aestheticReference,
        },
        text_overlay: {
          enabled: veoPrompt.prompt.textOverlay.enabled,
          text: veoPrompt.prompt.textOverlay.text,
          position: veoPrompt.prompt.textOverlay.position,
          style_hint: veoPrompt.prompt.textOverlay.styleHint,
        },
        cta: {
          enabled: veoPrompt.prompt.cta.enabled,
          text: veoPrompt.prompt.cta.text,
          url_hint: veoPrompt.prompt.cta.urlHint,
        },
      },
      transition_in: veoPrompt.transitionIn,
      transition_out: veoPrompt.transitionOut,
      negative_prompt: veoPrompt.negativePrompt,
      generation_config: {
        model: veoPrompt.generationConfig.model,
        seed: veoPrompt.generationConfig.seed,
        safety_filter: veoPrompt.generationConfig.safetyFilter,
        retry_count: veoPrompt.generationConfig.retryCount,
        priority: veoPrompt.generationConfig.priority,
      },
    };
  }
}
