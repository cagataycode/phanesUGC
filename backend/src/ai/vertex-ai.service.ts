import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { Env } from '../config/env';

export interface GeneratedVideoAsset {
  providerJobId: string;
  providerStatus: 'queued' | 'processing' | 'completed';
  downloadUrl: string | null;
}

@Injectable()
export class VertexAiService {
  private readonly client: GoogleGenAI;
  private readonly project: string;
  private readonly location: string;

  constructor(private readonly configService: ConfigService<Env>) {
    this.project = this.configService.get('GCP_PROJECT_ID', { infer: true })!;
    this.location = this.configService.get('VERTEX_AI_LOCATION', { infer: true })!;

    this.client = new GoogleGenAI({
      vertexai: true,
      project: this.project,
      location: this.location,
    });
  }

  async generateVideoFromPrompt(prompt: string): Promise<GeneratedVideoAsset> {
    const operation = await this.client.models.generateVideos({
      model: 'veo-3.1-generate-preview',
      prompt,
    });

    let polledOperation = operation;

    while (!polledOperation.done) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      polledOperation = await this.client.operations.getVideosOperation({
        operation: polledOperation,
      });
    }

    const generatedVideo = polledOperation.response?.generatedVideos?.[0];
    const downloadUrl = generatedVideo?.video?.uri ?? null;

    return {
      providerJobId: polledOperation.name ?? crypto.randomUUID(),
      providerStatus: 'completed',
      downloadUrl,
    };
  }
}
