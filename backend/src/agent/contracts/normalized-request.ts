/**
 * NormalizedRequest - Validated and defaulted user input
 *
 * This is the first artifact in the pipeline. All user inputs are validated,
 * required fields are enforced, and optional fields get sensible defaults.
 */
export interface NormalizedRequest {
  /** Unique job identifier */
  jobId: string;

  /** Business/user identifier */
  businessId: string;

  /** Raw user prompt - free text creative direction */
  prompt: string;

  /** Target platform for the ad */
  platform: 'tiktok' | 'instagram_reels' | 'youtube_shorts';

  /** Video aspect ratio */
  aspectRatio: '9:16' | '16:9' | '1:1';

  /** Video duration in seconds (MVP: always 8) */
  durationSec: 8;

  /** Language code (ISO 639-1) */
  language: string;

  /** Product context - can be enriched by scraping */
  product?: {
    name?: string;
    description?: string;
    benefits?: string[];
    urls?: string[];
    pricing?: string;
    offers?: string;
  };

  /** Creative preferences */
  tone?: string;
  targetAudience?: string;
  cta?: string;
  visualStyle?: string;
  subtitleStyle?: 'standard' | 'kinetic';

  /** Feature toggles */
  disableBackgroundMusic?: boolean;
  disableCaptions?: boolean;
  disableCtaOverlay?: boolean;

  /** Timestamp when request was normalized */
  normalizedAt: Date;
}
