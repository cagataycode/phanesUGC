import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { Env } from '../config/env';

export interface GeneratedVideoAsset {
  providerJobId: string;
  providerStatus: 'queued' | 'processing' | 'completed';
  downloadUrl: string | null;
}

export interface GenerateVideoOptions {
  aspectRatio?: '16:9' | '9:16' | '1:1';
  durationSeconds?: 8 | 15 | 30 | 60;
  negativePrompt?: string;
  personGeneration?: 'allow_all' | 'allow_adult';
  enhancePrompt?: boolean;
}

interface GeneratedVideoOperation {
  name?: string;
  done?: boolean;
  error?: unknown;
  metadata?: unknown;
  response?: {
    generatedVideos?: Array<{
      video?: {
        uri?: string;
      };
    }>;
  };
}

@Injectable()
export class VertexAiService {
  private readonly logger = new Logger(VertexAiService.name);
  private readonly project: string;
  private readonly location: string;
  private readonly modelId: string;
  private readonly outputGcsUri?: string;
  private readonly client: GoogleGenAI;

  constructor(private readonly configService: ConfigService<Env>) {
    this.project = this.configService.get('GCP_PROJECT_ID', { infer: true })!;
    this.location = this.configService.get('VERTEX_AI_LOCATION', {
      infer: true,
    })!;
    this.modelId = this.configService.get('VERTEX_AI_MODEL_ID', {
      infer: true,
    })!;
    const firebaseClientEmail = this.configService.get<string>(
      'FIREBASE_CLIENT_EMAIL',
    );
    const firebasePrivateKey = this.configService.get<string>(
      'FIREBASE_PRIVATE_KEY',
    );
    const vertexApiKey = this.configService.get<string>('VERTEX_AI_API_KEY');
    this.outputGcsUri = this.configService.get('VERTEX_OUTPUT_GCS_URI', {
      infer: true,
    });

    if (firebaseClientEmail && firebasePrivateKey) {
      this.client = new GoogleGenAI({
        vertexai: true,
        project: this.project,
        location: this.location,
        googleAuthOptions: {
          credentials: {
            client_email: firebaseClientEmail,
            private_key: firebasePrivateKey.replace(/\n/g, '\n'),
          },
          projectId: this.project,
          scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        },
      });

      this.logger.log(
        `Initialized Vertex client with Firebase service-account auth ${firebaseClientEmail}`,
      );
      return;
    }

    if (vertexApiKey) {
      process.env.GOOGLE_GENAI_USE_VERTEXAI = 'true';
      process.env.GOOGLE_CLOUD_PROJECT = '';
      process.env.GOOGLE_CLOUD_LOCATION = '';
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '';
      process.env.GOOGLE_API_KEY = vertexApiKey;
      process.env.GEMINI_API_KEY = vertexApiKey;

      this.client = new GoogleGenAI({
        vertexai: false,
        apiKey: vertexApiKey,
      });

      this.logger.log(
        'Initialized Vertex client with explicit Vertex API key in API-key mode',
      );
      return;
    }

    throw new Error(
      'Vertex AI auth is not configured. Set either VERTEX_AI_CLIENT_EMAIL + VERTEX_AI_PRIVATE_KEY or VERTEX_AI_API_KEY.',
    );
  }

  async generateVideoFromPrompt(
    prompt: string,
    options: GenerateVideoOptions = {},
  ): Promise<GeneratedVideoAsset> {
    const requestConfig = {
      numberOfVideos: 1,
      prompt,
      ...(options.negativePrompt
        ? { negativePrompt: options.negativePrompt }
        : {}),
      ...(options.aspectRatio ? { aspectRatio: options.aspectRatio } : {}),
      ...(options.durationSeconds
        ? { durationSeconds: options.durationSeconds }
        : {}),
      ...(options.personGeneration
        ? { personGeneration: options.personGeneration }
        : {}),
      ...(typeof options.enhancePrompt === 'boolean'
        ? { enhancePrompt: options.enhancePrompt }
        : {}),
      ...(this.outputGcsUri ? { outputGcsUri: this.outputGcsUri } : {}),
    };

    this.logger.log(
      `Submitting Veo request with model=${this.modelId} location=${this.location} outputGcsUri=${this.outputGcsUri ?? 'not-set'}`,
    );

    let operation: GeneratedVideoOperation;

    try {
      operation = (await this.client.models.generateVideos({
        model: this.modelId,
        prompt,
        config: requestConfig,
      })) as GeneratedVideoOperation;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Veo submission failed for model=${this.modelId} location=${this.location}: ${message}`,
      );
      throw error;
    }

    let polledOperation = operation;

    this.logger.log(
      `Veo operation accepted name=${polledOperation.name ?? 'unknown'} done=${String(polledOperation.done ?? false)} metadata=${JSON.stringify(polledOperation.metadata ?? null)}`,
    );

    while (!polledOperation.done) {
      await new Promise((resolve) => setTimeout(resolve, 10000));
      polledOperation = (await this.client.operations.getVideosOperation({
        operation: polledOperation as never,
      })) as GeneratedVideoOperation;

      this.logger.log(
        `Veo operation poll name=${polledOperation.name ?? 'unknown'} done=${String(polledOperation.done ?? false)} metadata=${JSON.stringify(polledOperation.metadata ?? null)}`,
      );
    }

    if (polledOperation.error) {
      const providerError = JSON.stringify(polledOperation.error);
      this.logger.error(`Veo operation failed: ${providerError}`);
      throw new Error(`Vertex AI video generation failed: ${providerError}`);
    }

    if (!polledOperation.response?.generatedVideos?.length) {
      this.logger.error(
        `Veo operation completed without generated videos. operation=${polledOperation.name ?? 'unknown'} metadata=${JSON.stringify(polledOperation.metadata ?? null)} response=${JSON.stringify(polledOperation.response ?? null)}`,
      );
      throw new Error('Vertex AI returned no generated video asset');
    }

    const generatedVideo = polledOperation.response.generatedVideos[0];
    const downloadUrl = generatedVideo.video?.uri ?? null;

    this.logger.log(
      `Veo generation completed operation=${polledOperation.name ?? 'unknown'} hasVideo=${Boolean(downloadUrl)}`,
    );

    return {
      providerJobId: polledOperation.name ?? crypto.randomUUID(),
      providerStatus: 'completed',
      downloadUrl,
    };
  }
}
