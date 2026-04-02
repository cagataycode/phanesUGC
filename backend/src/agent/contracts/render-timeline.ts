/**
 * RenderTimeline - Deterministic Remotion render specification
 *
 * This is a pure data structure with no AI or ambiguity.
 * Remotion consumes this to produce the final video.
 */
export interface RenderTimeline {
  /** Job identifier */
  jobId: string;

  /** Video source */
  videoSource: {
    gcsPath: string;
    durationSec: number;
    width: number;
    height: number;
  };

  /** Subtitle configuration */
  subtitles: {
    enabled: boolean;
    segments: Array<{
      id: string;
      text: string;
      startSec: number;
      endSec: number;
      lines: string[];
    }>;
    style: 'standard' | 'kinetic';
  };

  /** Text overlays */
  overlays?: Array<{
    text: string;
    startSec: number;
    endSec: number;
    position: string;
    style: string;
  }>;

  /** Background music */
  backgroundMusic?: {
    enabled: boolean;
    trackUrl?: string;
    volume: number;
  };

  /** CTA overlay */
  ctaOverlay?: {
    enabled: boolean;
    text: string;
    startSec: number;
    endSec: number;
  };

  /** Output configuration */
  output: {
    fps: number;
    width: number;
    height: number;
    durationInFrames: number;
  };

  /** Timestamp when timeline was assembled */
  assembledAt: Date;
}
