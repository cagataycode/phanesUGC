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

/**
 * Subscription Tier Configuration
 */
export const SUBSCRIPTION_TIERS = {
  free: {
    name: 'free' as const,
    monthlyVideoLimit: 2,
    concurrentJobLimit: 2,
    requestsPerMinute: 10,
    features: ['watermark', 'basic_support'],
  },
  starter: {
    name: 'starter' as const,
    monthlyVideoLimit: 20,
    concurrentJobLimit: 3,
    requestsPerMinute: 10,
    features: ['no_watermark', 'email_support'],
  },
  pro: {
    name: 'pro' as const,
    monthlyVideoLimit: 40,
    concurrentJobLimit: 5,
    requestsPerMinute: 10,
    features: ['no_watermark', 'priority_support', 'analytics'],
  },
  enterprise: {
    name: 'enterprise' as const,
    monthlyVideoLimit: -1, // unlimited, use custom limit from subscription
    concurrentJobLimit: 10,
    requestsPerMinute: 20,
    features: [
      'no_watermark',
      'dedicated_support',
      'analytics',
      'custom_branding',
    ],
  },
} as const;

/**
 * Type definitions
 */
export type SubscriptionTierName = keyof typeof SUBSCRIPTION_TIERS;

export interface SubscriptionTier {
  name: SubscriptionTierName;
  monthlyVideoLimit: number;
  concurrentJobLimit: number;
  requestsPerMinute: number;
  features: readonly string[];
}

/**
 * Get subscription tier configuration by name
 */
export function getSubscriptionTier(
  tierName: SubscriptionTierName,
): SubscriptionTier {
  return SUBSCRIPTION_TIERS[tierName];
}

/**
 * Check if a tier name is valid
 */
export function isValidTierName(
  tierName: string,
): tierName is SubscriptionTierName {
  return tierName in SUBSCRIPTION_TIERS;
}
