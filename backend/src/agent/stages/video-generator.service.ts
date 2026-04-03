import { Injectable, Logger } from '@nestjs/common';
import { VeoPrompt } from '../contracts/veo-prompt';
import { VeoOutput } from '../contracts/veo-output';
import { VertexAiService } from '../../ai/vertex-ai.service';
import { GcsStorageService } from '../../storage/gcs-storage.service';

/**
 * VideoGeneratorService - Generates video using Veo 3.1
 *
 * Calls Veo 3.1 API with structured prompt and imports to GCS
 */
@Injectable()
export class VideoGeneratorService {
  private readonly logger = new Logger(VideoGeneratorService.name);

  constructor(
    private readonly vertexAi: VertexAiService,
    private readonly gcsStorage: GcsStorageService,
  ) {}

  async generate(prompt: VeoPrompt): Promise<VeoOutput> {
    this.logger.log(`Generating video for project ${prompt.projectId}`);

    const startTime = Date.now();

    // Build the natural language prompt from structured VeoPrompt
    const veoPromptString = this.buildVeoPromptString(prompt);
    const negativePrompt = prompt.negativePrompt;

    this.logger.debug(
      `Veo prompt: ${veoPromptString.substring(0, 200)}... (${veoPromptString.length} chars)`,
    );

    // Call Veo 3.1 via VertexAiService
    const result = await this.vertexAi.generateVideoFromPrompt(
      veoPromptString,
      {
        aspectRatio: prompt.aspectRatio,
        durationSeconds: prompt.durationSeconds as 8 | 15 | 30 | 60,
        negativePrompt,
        personGeneration: 'allow_adult',
        enhancePrompt: false, // We provide structured prompts, no enhancement needed
      },
    );

    if (!result.downloadUrl) {
      throw new Error('Veo generation completed but no video URL returned');
    }

    // Import video to our GCS bucket
    const gcsPath = await this.gcsStorage.importGeneratedVideo(
      result.downloadUrl,
      `${prompt.projectId}/scene-${prompt.sceneId}.mp4`,
    );

    const generationTimeSec = (Date.now() - startTime) / 1000;

    // Calculate expected resolution based on aspect ratio
    const resolution = this.getResolutionForAspectRatio(prompt.aspectRatio);

    const output: VeoOutput = {
      jobId: prompt.projectId,
      sceneId: prompt.sceneId,
      gcsPath,
      actualDurationSec: prompt.durationSeconds, // Veo should match requested duration
      resolution,
      fps: 24, // Veo 3.1 outputs 24 fps
      fileSizeBytes: 0, // Will be populated when we add metadata extraction
      veoOperationId: result.providerJobId,
      metadata: {
        model: prompt.generationConfig.model,
        seed: prompt.generationConfig.seed ?? undefined,
        generationTimeSec,
      },
      generatedAt: new Date(),
    };

    this.logger.log(
      `Video generated successfully: ${gcsPath} (${prompt.durationSeconds}s)`,
    );

    return output;
  }

  /**
   * Get expected resolution for aspect ratio (Veo 3.1 supports 16:9 and 9:16 only)
   */
  private getResolutionForAspectRatio(aspectRatio: string): {
    width: number;
    height: number;
  } {
    switch (aspectRatio) {
      case '9:16':
        return { width: 1080, height: 1920 };
      case '16:9':
        return { width: 1920, height: 1080 };
      default:
        // Default to portrait for unsupported aspect ratios
        this.logger.warn(
          `Unsupported aspect ratio ${aspectRatio}, defaulting to 9:16`,
        );
        return { width: 1080, height: 1920 };
    }
  }

  /**
   * Build natural language prompt string from structured VeoPrompt
   */
  private buildVeoPromptString(scene: VeoPrompt): string {
    const p = scene.prompt;
    const parts: string[] = [];

    // Core visual intent
    parts.push(p.intent);

    // Shot details
    parts.push(`${p.shot.framing}.`);
    parts.push(`Camera angle: ${p.shot.cameraAngle}.`);
    if (p.shot.cameraMotion !== 'static') {
      parts.push(`Camera motion: ${p.shot.cameraMotion.replace(/_/g, ' ')}.`);
    }
    parts.push(`${p.shot.lensFeel}.`);

    // Subject action
    if (p.subject.action) {
      parts.push(p.subject.action);
    }

    // Identity persistence (for person subjects across scenes)
    if (p.subject.identityNotes) {
      parts.push(p.subject.identityNotes);
    }

    // Environment
    parts.push(`Setting: ${p.environment.location}.`);
    if (p.environment.props.length > 0) {
      parts.push(`Props: ${p.environment.props.join(', ')}.`);
    }
    parts.push(`Atmosphere: ${p.environment.atmosphere}.`);
    if (p.environment.timeOfDay) {
      parts.push(`Time of day: ${p.environment.timeOfDay}.`);
    }

    // Lighting
    parts.push(`Lighting: ${p.lighting.style}.`);
    parts.push(`Color temperature: ${p.lighting.colorTemperature}.`);
    if (p.lighting.practicalLights) {
      parts.push(`Practical lights: ${p.lighting.practicalLights}.`);
    }

    // Audio/speech direction
    parts.push(`The speaker says: "${p.audio.speechText}"`);
    parts.push(`Voice style: ${p.audio.speechStyle}.`);
    if (p.audio.ambientSound) {
      parts.push(`Ambient sound: ${p.audio.ambientSound}.`);
    }

    // Style
    parts.push(
      `Visual style: ${p.style.visualStyle}, ${p.style.renderingQuality}.`,
    );
    parts.push(`Color palette: ${p.style.colorPalette}.`);
    parts.push(`Aesthetic: ${p.style.aestheticReference}.`);

    return parts.join(' ');
  }
}
