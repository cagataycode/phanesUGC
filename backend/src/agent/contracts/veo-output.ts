/**
 * VeoOutput - Result from Veo 3.1 video generation
 *
 * Contains the generated video reference and metadata.
 */
export interface VeoOutput {
  /** Job identifier */
  jobId: string;

  /** Scene identifier */
  sceneId: number;

  /** GCS storage path */
  gcsPath: string;

  /** Actual video duration (may differ from requested) */
  actualDurationSec: number;

  /** Video resolution */
  resolution: {
    width: number;
    height: number;
  };

  /** File size in bytes */
  fileSizeBytes: number;

  /** Veo operation ID (for tracking) */
  veoOperationId?: string;

  /** Generation metadata */
  metadata?: {
    model: string;
    seed?: number;
    generationTimeSec: number;
  };

  /** Timestamp when video was generated */
  generatedAt: Date;
}
