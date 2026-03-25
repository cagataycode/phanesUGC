import { Injectable } from '@nestjs/common';
import { CreateAdDto } from './dto/create-ad.dto';
import { JobStoreService } from './services/job-store.service';
import { BriefGenerationService } from './services/brief-generation.service';
import { ScriptGenerationService } from './services/script-generation.service';
import { VertexAiService } from '../ai/vertex-ai.service';
import { GcsStorageService } from '../storage/gcs-storage.service';

@Injectable()
export class AdsService {
  constructor(
    private readonly briefGenerationService: BriefGenerationService,
    private readonly scriptGenerationService: ScriptGenerationService,
    private readonly jobStoreService: JobStoreService,
    private readonly vertexAiService: VertexAiService,
    private readonly gcsStorageService: GcsStorageService,
  ) {}

  private parseAndFlattenPrompt(createAdDto: CreateAdDto): void {
    let promptData: string | Record<string, unknown> =
      createAdDto.prompt_inputs.prompt;

    // Parse JSON string if possible
    promptData = this.parseJsonString(promptData);

    // If we have an object, process it
    if (typeof promptData === 'object' && promptData !== null) {
      // Extract and format prompt parts
      const formattedPrompt = this.extractPromptParts(promptData);

      // Handle negative prompt
      this.handleNegativePrompt(promptData, createAdDto);

      // Handle aspect ratio override
      this.handleAspectRatioOverride(promptData, createAdDto);

      // Replace the original prompt with the formatted version
      createAdDto.prompt_inputs.prompt = formattedPrompt;
    }
  }

  private parseJsonString(
    promptData: string | Record<string, unknown>,
  ): string | Record<string, unknown> {
    if (typeof promptData === 'string') {
      try {
        const parsed: unknown = JSON.parse(promptData);
        if (typeof parsed === 'object' && parsed !== null) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        // Not a JSON string, leave it as is
      }
    }
    return promptData;
  }

  private extractPromptParts(promptData: Record<string, unknown>): string {
    const parts: string[] = [];
    const keysToExtract = [
      'subject',
      'pose',
      'environment',
      'camera',
      'lighting',
      'mood_and_expression',
      'style_and_realism',
      'colors_and_tone',
      'quality_and_technical_details',
    ];

    for (const key of keysToExtract) {
      const val = promptData[key];
      if (typeof val === 'string') {
        const formattedKey = key.replace(/_/g, ' ').toUpperCase();
        parts.push(`${formattedKey}:\n${val}`);
      }
    }

    return parts.join('\n\n') || JSON.stringify(promptData);
  }

  private handleNegativePrompt(
    promptData: Record<string, unknown>,
    createAdDto: CreateAdDto,
  ): void {
    const negPromptObj = promptData['negative_prompt'] as
      | Record<string, unknown>
      | undefined;
    if (
      negPromptObj?.forbidden_elements &&
      Array.isArray(negPromptObj.forbidden_elements)
    ) {
      const negs = (negPromptObj.forbidden_elements as string[]).join(', ');
      if (createAdDto.veo_config.negative_prompt) {
        createAdDto.veo_config.negative_prompt += ', ' + negs;
      } else {
        createAdDto.veo_config.negative_prompt = negs;
      }
    }
  }

  private handleAspectRatioOverride(
    promptData: Record<string, unknown>,
    createAdDto: CreateAdDto,
  ): void {
    const aspectRatioOverride = promptData['aspect_ratio_and_output'];
    if (typeof aspectRatioOverride === 'string') {
      const validRatios = ['16:9', '9:16', '1:1'];
      if (validRatios.includes(aspectRatioOverride)) {
        createAdDto.veo_config.aspect_ratio = aspectRatioOverride as
          | '16:9'
          | '9:16'
          | '1:1';
      }
    }
  }

  async createJob(
    createAdDto: CreateAdDto,
  ): Promise<{ id: string; status: string }> {
    // Process JSON prompts into flat strings before saving them to the database
    this.parseAndFlattenPrompt(createAdDto);

    const jobId = await this.jobStoreService.create(createAdDto.businessId, {
      businessId: createAdDto.businessId,
      productId: createAdDto.productId,
      createdBy: createAdDto.createdBy,
      prompt: createAdDto.prompt_inputs.prompt as string,
      platform: createAdDto.prompt_inputs.platform,
      aspectRatio: createAdDto.veo_config.aspect_ratio,
      durationSec: createAdDto.veo_config.duration_sec,
    });

    void this.processJob(createAdDto.businessId, jobId, createAdDto);

    return {
      id: jobId,
      status: 'created',
    };
  }

  async getJob(businessId: string, projectId: string) {
    return this.jobStoreService.getById(businessId, projectId);
  }

  async getJobResult(businessId: string, projectId: string) {
    const job = await this.jobStoreService.getById(businessId, projectId);

    let video_url: string | undefined;
    if (job.output?.videoStorageKey) {
      video_url = await this.gcsStorageService.createSignedVideoUrl(
        job.output.videoStorageKey,
      );
    }

    return {
      video_url,
      thumbnail_url: job.output?.thumbnailStorageKey
        ? await this.gcsStorageService.createSignedVideoUrl(
            job.output.thumbnailStorageKey,
          )
        : undefined,
      script: job.script as Record<string, unknown>,
      subtitles: [],
      transcript: [],
      metadata: {},
    };
  }

  private buildPromptFromScript(
    createAdDto: CreateAdDto,
    script: {
      title?: string;
      hook?: string;
      body?: string;
      cta?: string;
      full_text: string;
    },
  ): string {
    const { prompt_inputs, veo_config } = createAdDto;
    const sections: string[] = [script.full_text];

    if (script.title) {
      sections.unshift(`Ad title: ${script.title}`);
    }

    const generationContext: string[] = [];

    if (prompt_inputs.platform) {
      generationContext.push(`Platform: ${prompt_inputs.platform}`);
    }

    if (prompt_inputs.language) {
      generationContext.push(`Language: ${prompt_inputs.language}`);
    }

    if (veo_config.aspect_ratio) {
      generationContext.push(`Aspect ratio: ${veo_config.aspect_ratio}`);
    }

    if (veo_config.duration_sec) {
      generationContext.push(`Duration: ${veo_config.duration_sec} seconds`);
    }

    if (generationContext.length > 0) {
      sections.push(`Generation context:\n- ${generationContext.join('\n- ')}`);
    }

    return sections.join('\n\n');
  }

  private async processJob(
    businessId: string,
    projectId: string,
    createAdDto: CreateAdDto,
  ): Promise<void> {
    try {
      // 1. Brief generation stage
      await this.jobStoreService.update(businessId, projectId, {
        status: 'processing',
        progress: 10,
        stages: {
          scrape: 'done',
          brief: 'running',
          script: 'pending',
          scenes: 'pending',
          assets: 'pending',
          audio: 'pending',
          subtitles: 'pending',
          render: 'pending',
        },
      });

      const brief = await this.briefGenerationService.generate(createAdDto);

      // 2. Script generation stage
      await this.jobStoreService.update(businessId, projectId, {
        progress: 30,
        creativeBrief: brief,
        stages: {
          scrape: 'done',
          brief: 'done',
          script: 'running',
          scenes: 'pending',
          assets: 'pending',
          audio: 'pending',
          subtitles: 'pending',
          render: 'pending',
        },
      });

      const script = this.scriptGenerationService.generate(brief);

      // 3. Asset generation stage (Vertex AI)
      await this.jobStoreService.update(businessId, projectId, {
        progress: 50,
        script: script,
        stages: {
          scrape: 'done',
          brief: 'done',
          script: 'done',
          scenes: 'running',
          assets: 'running',
          audio: 'pending',
          subtitles: 'pending',
          render: 'pending',
        },
      });

      const composedPrompt = this.buildPromptFromScript(createAdDto, script);
      const generatedAsset = await this.vertexAiService.generateVideoFromPrompt(
        composedPrompt,
        {
          aspectRatio: createAdDto.veo_config.aspect_ratio,
          durationSeconds: createAdDto.veo_config.duration_sec,
          negativePrompt: createAdDto.veo_config.negative_prompt,
          personGeneration: createAdDto.veo_config.person_generation,
          enhancePrompt: createAdDto.veo_config.enhance_prompt,
        },
      );

      if (!generatedAsset || !generatedAsset.downloadUrl) {
        throw new Error('Vertex AI did not return a downloadable video URL');
      }

      // 4. Storage & Finalization
      await this.jobStoreService.update(businessId, projectId, {
        progress: 80,
        stages: {
          scrape: 'done',
          brief: 'done',
          script: 'done',
          scenes: 'done',
          assets: 'done',
          audio: 'done',
          subtitles: 'done',
          render: 'running',
        },
      });

      const storageKey = `businesses/${businessId}/projects/${projectId}/output/final.mp4`;
      await this.gcsStorageService.importGeneratedVideo(
        generatedAsset.downloadUrl,
        storageKey,
      );

      await this.jobStoreService.update(businessId, projectId, {
        status: 'completed',
        progress: 100,
        output: {
          videoStorageKey: storageKey,
        },
        stages: {
          scrape: 'done',
          brief: 'done',
          script: 'done',
          scenes: 'done',
          assets: 'done',
          audio: 'done',
          subtitles: 'done',
          render: 'done',
        },
      });
    } catch (error) {
      let message = 'Video generation failed';
      let failedStage = 'unknown';

      if (error instanceof Error) {
        message = error.message;
        // Try to determine which stage failed based on the error message
        if (message.includes('brief')) {
          failedStage = 'brief';
        } else if (message.includes('script')) {
          failedStage = 'script';
        } else if (
          message.includes('asset') ||
          message.includes('Veo') ||
          message.includes('Imagen')
        ) {
          failedStage = 'assets';
        } else if (message.includes('voice') || message.includes('TTS')) {
          failedStage = 'audio';
        } else if (message.includes('render')) {
          failedStage = 'render';
        }
      }

      await this.jobStoreService.update(businessId, projectId, {
        status: 'failed',
        error: message,
        failedStage,
      });
    }
  }
}
