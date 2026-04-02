import { RenderTimeline } from '../contracts/render-timeline';
import { FinalOutput } from '../contracts/final-output';

/**
 * RendererAdapter - Interface for Remotion video rendering
 *
 * Abstracts the render engine for testability
 */
export interface RendererAdapter {
  /**
   * Render final video from timeline specification
   *
   * @param timeline - Deterministic render specification
   * @returns Final rendered output with metadata
   */
  render(timeline: RenderTimeline): Promise<FinalOutput>;

  /**
   * Check render status (for async operations)
   *
   * @param renderId - Render operation identifier
   * @returns Current status and output (if complete)
   */
  checkStatus(renderId: string): Promise<{
    status: 'pending' | 'rendering' | 'completed' | 'failed';
    output?: FinalOutput;
    error?: string;
    progress?: number;
  }>;
}
