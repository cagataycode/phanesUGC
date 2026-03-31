import { Injectable, Logger } from '@nestjs/common';
import path from 'node:path';
import { CreateAdDto } from './dto/create-ad.dto';
import { JobStoreService } from './services/job-store.service';
import { BriefGenerationService } from './services/brief-generation.service';
import { ScriptGenerationService } from './services/script-generation.service';
import { VertexAiService } from '../ai/vertex-ai.service';
import { GcsStorageService } from '../storage/gcs-storage.service';
import { RenderService } from '../render/render.service';

import {
  generateSubtitlesFromScenes,
  scaleSubtitleTimestamps,
  SimpleScene,
} from '../render/subtitles/subtitle-chunker';
import { GeneratedScript } from './types/generated-script';
import { VideoUtilsService } from '../common/video-utils.service';

@Injectable()
export class AdsService {
  private readonly logger = new Logger(AdsService.name);

  constructor(
    private readonly briefGenerationService: BriefGenerationService,
    private readonly scriptGenerationService: ScriptGenerationService,
    private readonly jobStoreService: JobStoreService,
    private readonly vertexAiService: VertexAiService,
    private readonly gcsStorageService: GcsStorageService,
    private readonly renderService: RenderService,
    private readonly videoUtilsService: VideoUtilsService,
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

    let source_video_url: string | undefined;
    if (job.output?.sourceVideoStorageKey) {
      source_video_url = await this.gcsStorageService.createSignedVideoUrl(
        job.output.sourceVideoStorageKey,
      );
    }

    const thumbnail_url = job.output?.thumbnailStorageKey
      ? await this.gcsStorageService.createSignedVideoUrl(
          job.output.thumbnailStorageKey,
        )
      : undefined;

    return {
      video_url,
      source_video_url,
      thumbnail_url,
      script: (job.script as unknown as Record<string, unknown>) ?? null,
      creativeBrief: job.creativeBrief ?? null,
      subtitles: job.subtitleSegments ?? [],
      transcript: job.script?.full_text ? [{ text: job.script.full_text }] : [],
      metadata: job.metadata ?? {},
      generationConfig: {
        platform: job.platform ?? undefined,
        aspectRatio: job.aspectRatio ?? undefined,
        durationSec: job.durationSec ?? undefined,
      },
      timestamps: {
        createdAt: job.createdAt?.toDate?.()?.toISOString() ?? null,
        updatedAt: job.updatedAt?.toDate?.()?.toISOString() ?? null,
      },
      pipeline: {
        status: job.status,
        stages: job.stages ?? {},
      },
    };
  }

  private buildPromptFromScript(
    createAdDto: CreateAdDto,
    script: GeneratedScript,
  ): string {
    const { prompt_inputs, veo_config } = createAdDto;
    const sections: string[] = [];

    // 1. Start with the user's original creative prompt
    const userPrompt =
      typeof prompt_inputs.prompt === 'string'
        ? prompt_inputs.prompt
        : JSON.stringify(prompt_inputs.prompt);
    if (userPrompt) {
      sections.push(`**User's Creative Vision**:
${userPrompt}`);
    }

    // 2. Add the visual direction
    if (script.visual_description) {
      sections.push(`**Visual Direction**:
${script.visual_description}`);
    }

    // 3. Add the ad script text
    if (script.full_text) {
      sections.push(`**Ad Script**:
${script.full_text}`);
    }

    // 4. Add generation context
    const generationContext: string[] = [];
    if (prompt_inputs.platform) {
      generationContext.push(`- Platform: ${prompt_inputs.platform}`);
    }
    if (prompt_inputs.language) {
      generationContext.push(`- Language: ${prompt_inputs.language}`);
    }
    if (veo_config.aspect_ratio) {
      generationContext.push(`- Aspect ratio: ${veo_config.aspect_ratio}`);
    }
    if (veo_config.duration_sec) {
      generationContext.push(`- Duration: ${veo_config.duration_sec} seconds`);
    }

    if (generationContext.length > 0) {
      sections.push(
        `**Technical Constraints**:\n${generationContext.join('\n')}`,
      );
    }

    return sections.join('\n\n');
  }

  private simulateScenes(
    script: GeneratedScript,
    totalDuration: number,
  ): SimpleScene[] {
    const sentences =
      script.full_text.match(/[^.!?]+[.!?]*/g)?.map((s) => s.trim()) ?? [];
    if (sentences.length === 0) {
      return [{ narration: script.full_text, duration_sec: totalDuration }];
    }

    const totalLength = sentences.reduce((sum, s) => sum + s.length, 0);
    const scenes: SimpleScene[] = sentences.map((sentence) => ({
      narration: sentence,
      duration_sec: (sentence.length / totalLength) * totalDuration,
    }));

    return scenes;
  }

  private async processJob(
    businessId: string,
    projectId: string,
    createAdDto: CreateAdDto,
  ): Promise<void> {
    this.logger.log(
      `Starting job processing for project ${projectId} (business: ${businessId})`,
    );
    try {
      // 1. Brief generation stage
      this.logger.debug(`[${projectId}] Stage 1: Brief generation`);
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
      this.logger.debug(`[${projectId}] Stage 2: Script generation`);
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
      this.logger.debug(`[${projectId}] Stage 3: Asset generation (Vertex AI)`);
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
      this.logger.log(`[${projectId}] Requesting Vertex AI video generation`);
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

      this.logger.log(
        `[${projectId}] Video generated by Vertex AI. Importing to GCS...`,
      );
      const sourceVideoStorageKey = `businesses/${businessId}/projects/${projectId}/output/source.mp4`;
      await this.gcsStorageService.importGeneratedVideo(
        generatedAsset.downloadUrl,
        sourceVideoStorageKey,
      );

      // Ensure public dir exists (will silently succeed if it does)
      const publicDir = path.resolve(
        process.cwd(),
        'src/render/remotion/public',
      );
      await import('node:fs/promises').then((fs) =>
        fs.mkdir(publicDir, { recursive: true }),
      );

      const fileName = `source-${projectId}.mp4`;
      const localSourcePath = path.join(publicDir, fileName);

      try {
        this.logger.log(
          `[${projectId}] Downloading source video for local rendering: ${localSourcePath}`,
        );
        await this.gcsStorageService.downloadFile(
          sourceVideoStorageKey,
          localSourcePath,
        );

        let actualDurationSec = createAdDto.veo_config.duration_sec;
        try {
          actualDurationSec =
            await this.videoUtilsService.getVideoDuration(localSourcePath);
        } catch (error) {
          this.logger.warn(
            `[${projectId}] Failed to extract video duration, falling back to planned duration: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        const plannedDurationSec = createAdDto.veo_config.duration_sec;

        this.logger.log(
          `[${projectId}] Video duration check: Planned=${plannedDurationSec}s, Actual=${actualDurationSec}s`,
        );

        const simulatedScenes = this.simulateScenes(script, plannedDurationSec);
        const subtitleSegments = generateSubtitlesFromScenes(simulatedScenes);

        const scalingFactor =
          plannedDurationSec > 0 && Number.isFinite(plannedDurationSec)
            ? actualDurationSec / plannedDurationSec
            : 1;

        const correctedSubtitleSegments =
          scalingFactor !== 1
            ? scaleSubtitleTimestamps(subtitleSegments, scalingFactor)
            : subtitleSegments;

        const videoUrlForRemotion = fileName;
        const preparedRenderRequest = this.renderService.prepareRenderRequest({
          videoUrl: videoUrlForRemotion,
          phrases: correctedSubtitleSegments,
          fps: 30,
          durationInFrames: Math.round(actualDurationSec * 30),
          width:
            createAdDto.veo_config.aspect_ratio === '9:16' ||
            createAdDto.veo_config.aspect_ratio === '1:1'
              ? 1080
              : 1920,
          height:
            createAdDto.veo_config.aspect_ratio === '16:9' ||
            createAdDto.veo_config.aspect_ratio === '1:1'
              ? 1080
              : 1920,
          subtitleStyle: createAdDto.prompt_inputs.subtitle_style ?? 'kinetic',
        });

        // 4. Storage & Finalization
        this.logger.debug(`[${projectId}] Stage 4: Subtitle rendering`);
        await this.jobStoreService.update(businessId, projectId, {
          progress: 80,
          subtitleSegments: correctedSubtitleSegments,
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
        this.logger.log(
          `[${projectId}] Starting Remotion subtitled video render`,
        );
        const renderedOutput = await this.renderService.renderToTempFile({
          ...preparedRenderRequest,
          phrases: correctedSubtitleSegments,
        });

        try {
          this.logger.log(
            `[${projectId}] Render finished. Uploading to GCS: ${storageKey}`,
          );
          await this.gcsStorageService.uploadLocalFile(
            renderedOutput.outputPath,
            storageKey,
          );
        } finally {
          await renderedOutput.cleanup();
        }

        this.logger.log(`[${projectId}] Job completed successfully`);
        await this.jobStoreService.update(businessId, projectId, {
          status: 'completed',
          progress: 100,
          subtitleSegments: correctedSubtitleSegments,
          output: {
            videoStorageKey: storageKey,
            sourceVideoStorageKey,
          },
          metadata: {
            renderRequest: {
              fps: preparedRenderRequest.fps,
              durationInFrames: preparedRenderRequest.durationInFrames,
              phraseCount: correctedSubtitleSegments.length,
            },
            subtitleScaling: {
              plannedDurationSec,
              actualDurationSec,
              scalingFactor,
            },
            simulatedScenes,
          } as never,
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
      } finally {
        await import('node:fs/promises').then((fs) =>
          fs.rm(localSourcePath, { force: true }),
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Video generation failed';
      this.logger.error(
        `[${projectId}] Job processing failed: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );

      let failedStage = 'unknown';
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

      await this.jobStoreService.update(businessId, projectId, {
        status: 'failed',
        error: message,
        failedStage,
      });
    }
  }
}
