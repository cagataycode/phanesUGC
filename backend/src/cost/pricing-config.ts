/**
 * Pricing Configuration
 *
 * Centralized pricing for all external API services.
 * Update these values as pricing changes.
 *
 * Last updated: 2026-04-04
 * Sources:
 * - Veo 3.1: https://www.aifreeapi.com/en/posts/veo-3-1-pricing
 * - Claude Sonnet 4.6: https://apidog.com/blog/claude-sonnet-4-6-pricing/
 * - Gemini 2.5 Pro: https://langcopilot.com/llm-pricing/google/gemini-2.5-pro
 */

/**
 * API Pricing Configuration
 */
export const PRICING_CONFIG = {
  veo: {
    fast: 0.15, // $ per second
    standard: 0.4, // $ per second
  },
  claude: {
    inputTokens: 3.0 / 1_000_000, // $ per token ($3.00 per 1M tokens)
    outputTokens: 15.0 / 1_000_000, // $ per token ($15.00 per 1M tokens)
  },
  gemini: {
    inputTokens: 1.25 / 1_000_000, // $ per token ($1.25 per 1M tokens)
    outputTokens: 10.0 / 1_000_000, // $ per token ($10.00 per 1M tokens)
  },
} as const;
