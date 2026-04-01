/**
 * SubtitleData - Script-derived subtitles with timing
 *
 * Generated algorithmically from the script, then scaled to match
 * the actual Veo output duration.
 */
export interface SubtitleSegment {
  /** Unique identifier */
  id: string;

  /** Subtitle text */
  text: string;

  /** Start time in seconds */
  startSec: number;

  /** End time in seconds */
  endSec: number;

  /** Display lines (for multi-line subtitles) */
  lines: string[];

  /** Style hint */
  style?: 'standard' | 'kinetic';
}

export interface SubtitleData {
  /** Job identifier */
  jobId: string;

  /** All subtitle segments */
  segments: SubtitleSegment[];

  /** Planned duration (from script) */
  plannedDurationSec: number;

  /** Actual duration (from Veo output) */
  actualDurationSec: number;

  /** Scaling factor applied */
  scalingFactor: number;

  /** Subtitle style */
  style: 'standard' | 'kinetic';

  /** Timestamp when subtitles were generated */
  generatedAt: Date;
}
