import { Injectable, Logger } from '@nestjs/common';
import { VeoPrompt } from '../contracts/veo-prompt';
import { VeoOutput } from '../contracts/veo-output';
import { VertexAiService } from '../../ai/vertex-ai.service';
import { GcsStorageService } from '../../storage/gcs-storage.service';
import { StructuredLoggerService } from '../../monitoring/structured-logger.service';
import { PerformanceMonitorService } from '../../monitoring/performance-monitor.service';

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
    private readonly structuredLogger: StructuredLoggerService,
    private readonly performanceMonitor: PerformanceMonitorService,
  ) {}

  async generate(
    prompt: VeoPrompt,
    correlationId?: string,
  ): Promise<VeoOutput> {
    this.logger.log(`Generating video for project ${prompt.projectId}`);

    const context = {
      correlationId: correlationId || 'unknown',
      jobId: prompt.projectId,
      sceneId: prompt.sceneId,
    };

    this.structuredLogger.log('Starting Veo video generation', {
      ...context,
      aspectRatio: prompt.aspectRatio,
      durationSeconds: prompt.durationSeconds,
      model: prompt.generationConfig.model,
    });

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
        enhancePrompt: true,
      },
    );

    if (!result.downloadUrl) {
      this.structuredLogger.error(
        'Veo generation completed but no video URL returned',
        new Error('No video URL in Veo response'),
        context,
      );
      throw new Error('Veo generation completed but no video URL returned');
    }

    // Import video to our GCS bucket
    const importResult = await this.gcsStorage.importGeneratedVideo(
      result.downloadUrl,
      `${prompt.projectId}/scene-${prompt.sceneId}.mp4`,
    );

    const generationTimeSec = (Date.now() - startTime) / 1000;
    const latency = Date.now() - startTime;

    // Calculate expected resolution based on aspect ratio
    const resolution = this.getResolutionForAspectRatio(prompt.aspectRatio);

    const output: VeoOutput = {
      jobId: prompt.projectId,
      sceneId: prompt.sceneId,
      gcsPath: importResult.path,
      actualDurationSec: prompt.durationSeconds, // Veo should match requested duration
      resolution,
      fps: 24, // Veo 3.1 outputs 24 fps
      fileSizeBytes: importResult.sizeBytes,
      veoOperationId: result.providerJobId,
      metadata: {
        model: prompt.generationConfig.model,
        seed: prompt.generationConfig.seed ?? undefined,
        generationTimeSec,
      },
      generatedAt: new Date(),
    };

    // Log performance metrics
    this.performanceMonitor.trackLatency(
      'veo',
      'generate-video',
      latency,
      {
        ...context,
        model: prompt.generationConfig.model,
        durationSeconds: prompt.durationSeconds,
        aspectRatio: prompt.aspectRatio,
        fileSizeMB: (importResult.sizeBytes / 1024 / 1024).toFixed(2),
        operationId: result.providerJobId,
      },
      'success',
    );

    this.structuredLogger.log('Veo video generation completed', {
      ...context,
      gcsPath: importResult.path,
      durationSeconds: prompt.durationSeconds,
      fileSizeMB: (importResult.sizeBytes / 1024 / 1024).toFixed(2),
      generationTimeSec: generationTimeSec.toFixed(2),
    });

    this.logger.log(
      `Video generated successfully: ${importResult.path} (${prompt.durationSeconds}s, ${(importResult.sizeBytes / 1024 / 1024).toFixed(2)}MB)`,
    );

    return output;
  }

  /**
   * Generate video with idempotency support
   * Checks for existing attempts before calling Veo
   */
  async generateWithIdempotency(
    prompt: VeoPrompt,
    existingAttempts?: Array<{
      attemptId: string;
      gcsPath: string;
      timestamp: Date;
    }>,
    correlationId?: string,
  ): Promise<{
    output: VeoOutput;
    attemptId: string;
    isReused: boolean;
  }> {
    const attemptId = `${prompt.projectId}-${prompt.sceneId}-${Date.now()}`;

    const context = {
      correlationId: correlationId || 'unknown',
      jobId: prompt.projectId,
      sceneId: prompt.sceneId,
    };

    // Check if we have a recent successful attempt (within last 5 minutes)
    if (existingAttempts && existingAttempts.length > 0) {
      const recentAttempt = existingAttempts.find((attempt) => {
        // Handle Firestore Timestamp objects (after round-trip from Firestore)
        const timestamp = this.toDate(attempt.timestamp);
        const ageMs = Date.now() - timestamp.getTime();
        return ageMs < 5 * 60 * 1000; // 5 minutes
      });

      if (recentAttempt) {
        this.logger.log(
          `Reusing existing Veo output from attempt ${recentAttempt.attemptId} (idempotency)`,
        );

        this.structuredLogger.log('Reusing cached Veo output (idempotency)', {
          ...context,
          attemptId: recentAttempt.attemptId,
          gcsPath: recentAttempt.gcsPath,
        });

        // Reconstruct VeoOutput from cached attempt
        const resolution = this.getResolutionForAspectRatio(prompt.aspectRatio);
        const output: VeoOutput = {
          jobId: prompt.projectId,
          sceneId: prompt.sceneId,
          gcsPath: recentAttempt.gcsPath,
          actualDurationSec: prompt.durationSeconds,
          resolution,
          fps: 24,
          fileSizeBytes: 0,
          veoOperationId: recentAttempt.attemptId,
          metadata: {
            model: prompt.generationConfig.model,
            seed: prompt.generationConfig.seed ?? undefined,
            generationTimeSec: 0,
          },
          generatedAt: this.toDate(recentAttempt.timestamp),
        };

        return {
          output,
          attemptId: recentAttempt.attemptId,
          isReused: true,
        };
      }
    }

    // No recent attempt found, generate new video
    this.structuredLogger.log(
      'No cached Veo output found, generating new video',
      context,
    );
    const output = await this.generate(prompt, correlationId);

    return {
      output,
      attemptId,
      isReused: false,
    };
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

  /**
   * Convert Firestore Timestamp to Date
   * Handles Date, Firestore Timestamp, string, and number formats.
   * Returns the Unix epoch for invalid or missing values so callers do not
   * mistakenly treat an unparseable timestamp as fresh.
   */
  private toDate(value: unknown): Date {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? new Date(0) : value;
    }
    // Firestore Timestamp has toDate() method
    if (value && typeof value === 'object' && 'toDate' in value) {
      const date = (value as { toDate: () => Date }).toDate();
      return Number.isNaN(date.getTime()) ? new Date(0) : date;
    }
    // Handle string or number timestamps
    if (typeof value === 'string' || typeof value === 'number') {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? new Date(0) : date;
    }
    // Fallback to a non-fresh sentinel if invalid or missing
    return new Date(0);
  }
}
