import { Injectable } from '@nestjs/common';

export interface GeneratedVideoAsset {
  providerJobId: string;
  providerStatus: 'queued' | 'processing' | 'completed';
  downloadUrl: string | null;
}

@Injectable()
export class VertexAiService {
  async generateVideoFromPrompt(prompt: string): Promise<GeneratedVideoAsset> {
    void prompt;

    return {
      providerJobId: crypto.randomUUID(),
      providerStatus: 'completed',
      downloadUrl: null,
    };
  }
}
