import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAuth } from 'google-auth-library';
import { Env } from '../config/env';

export interface GeneratedVideoAsset {
  providerJobId: string;
  providerStatus: 'queued' | 'processing' | 'completed';
  downloadUrl: string | null;
}

@Injectable()
export class VertexAiService {
  private readonly project: string;
  private readonly location: string;
  private readonly auth: GoogleAuth;

  constructor(private readonly configService: ConfigService<Env>) {
    this.project = this.configService.get('GCP_PROJECT_ID', { infer: true })!;
    this.location = this.configService.get('VERTEX_AI_LOCATION', {
      infer: true,
    })!;
    const clientEmail = this.configService.get('FIREBASE_CLIENT_EMAIL', {
      infer: true,
    })!;
    const privateKey = this.configService
      .get('FIREBASE_PRIVATE_KEY', { infer: true })!
      .replace(/\n/g, '\n');

    const googleAuth = new GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      projectId: this.project,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    this.auth = googleAuth;
  }

  async generateVideoFromPrompt(prompt: string): Promise<GeneratedVideoAsset> {
    const accessToken = await this.getAccessToken();
    const endpoint = `https://${this.location}-aiplatform.googleapis.com/v1beta1/projects/${this.project}/locations/${this.location}/publishers/google/models/veo-3.1-generate-preview:generateVideos`;

    const operationResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
      }),
    });

    if (!operationResponse.ok) {
      throw new Error(await operationResponse.text());
    }

    const operation = (await operationResponse.json()) as {
      name?: string;
      done?: boolean;
      response?: {
        generatedVideos?: Array<{
          video?: {
            uri?: string;
          };
        }>;
      };
    };

    let polledOperation = operation;

    while (!polledOperation.done) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const pollResponse = await fetch(
        `https://${this.location}-aiplatform.googleapis.com/v1beta1/${polledOperation.name}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!pollResponse.ok) {
        throw new Error(await pollResponse.text());
      }

      polledOperation = (await pollResponse.json()) as typeof operation;
    }

    if (!polledOperation.response?.generatedVideos?.length) {
      throw new Error('Vertex AI returned no generated video asset');
    }

    const generatedVideo = polledOperation.response.generatedVideos[0];
    const downloadUrl = generatedVideo.video?.uri ?? null;

    return {
      providerJobId: polledOperation.name ?? crypto.randomUUID(),
      providerStatus: 'completed',
      downloadUrl,
    };
  }

  private async getAccessToken(): Promise<string> {
    const client = await this.auth.getClient();
    const tokenResponse = await client.getAccessToken();

    if (!tokenResponse.token) {
      throw new Error('Failed to acquire Google access token for Vertex AI');
    }

    return tokenResponse.token;
  }
}
