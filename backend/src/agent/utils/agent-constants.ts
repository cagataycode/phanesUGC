/**
 * AgentConstants - Centralized constants for agent module
 *
 * Single source of truth for all agent-related constants
 */
export const AgentConstants = {
  // Timing
  SCENARIO_EXPIRY_HOURS: 24,
  MAX_RETRIES: 2,
  RETRY_DELAY_MS: 1000,
  RETRY_BACKOFF_MULTIPLIER: 2,

  // Durations
  DEFAULT_DURATION_SEC: 8,
  MIN_DURATION_SEC: 5,
  MAX_DURATION_SEC: 60,

  // Quality thresholds
  MIN_QUALITY_SCORE: 0.6,
  WARN_QUALITY_SCORE: 0.8,

  // Defaults
  DEFAULT_LANGUAGE: 'en',
  DEFAULT_PLATFORM: 'tiktok' as const,
  DEFAULT_ASPECT_RATIO: '9:16' as const,
  DEFAULT_SUBTITLE_STYLE: 'standard' as const,
} as const;
