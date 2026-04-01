import { VeoPrompt } from '../contracts/veo-prompt';
import { VeoOutput } from '../contracts/veo-output';

/**
 * VideoGenerationAdapter - Interface for Veo 3.1 video generation
 *
 * Abstracts the video generation service for testability and vendor-swapping
 */
export interface VideoGenerationAdapter {
  /**
   * Generate video from structured Veo prompt
   *
   * @param prompt - Veo-ready structured prompt
   * @returns Generated video metadata and GCS path
   */
  generateVideo(prompt: VeoPrompt): Promise<VeoOutput>;

  /**
   * Check generation status (for async operations)
   *
   * @param operationId - Veo operation identifier
   * @returns Current status and output (if complete)
   */
  checkStatus(operationId: string): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    output?: VeoOutput;
    error?: string;
  }>;
}
