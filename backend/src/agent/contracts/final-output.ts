/**
 * FinalOutput - Complete rendered video with metadata
 *
 * The final artifact delivered to the user.
 */
export interface QualityReport {
  /** Quality gate name */
  gate: string;

  /** Gate result */
  status: 'pass' | 'warn' | 'fail';

  /** Issues found (if any) */
  issues: string[];

  /** Timestamp when gate was checked */
  checkedAt: Date;
}

export interface FinalOutput {
  /** Job identifier */
  jobId: string;

  /** Signed URL for the final MP4 */
  videoUrl: string;

  /** Thumbnail URL */
  thumbnailUrl?: string;

  /** GCS storage path */
  gcsPath: string;

  /** Video metadata */
  metadata: {
    durationSec: number;
    width: number;
    height: number;
    fileSizeBytes: number;
    fps: number;
  };

  /** Subtitle segments (for display/editing) */
  subtitles: Array<{
    text: string;
    startSec: number;
    endSec: number;
  }>;

  /** Full transcript */
  transcript: string;

  /** Quality reports from all gates */
  qualityReports: QualityReport[];

  /** Overall quality score (0-1) */
  qualityScore: number;

  /** Timestamp when output was finalized */
  finalizedAt: Date;
}
