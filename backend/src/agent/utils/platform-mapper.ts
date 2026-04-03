/**
 * PlatformMapper - Bidirectional platform name mapping
 *
 * Single source of truth for platform name conversions between
 * agent format (instagram_reels) and ads format (instagram)
 */

import { Logger } from '@nestjs/common';

export type AgentPlatform = 'tiktok' | 'instagram_reels' | 'youtube_shorts';
export type AdsPlatform = 'tiktok' | 'instagram' | 'youtube';

export class PlatformMapper {
  private static readonly logger = new Logger(PlatformMapper.name);

  private static readonly AGENT_TO_ADS: Record<AgentPlatform, AdsPlatform> = {
    tiktok: 'tiktok',
    instagram_reels: 'instagram',
    youtube_shorts: 'youtube',
  };

  private static readonly ADS_TO_AGENT: Record<AdsPlatform, AgentPlatform> = {
    tiktok: 'tiktok',
    instagram: 'instagram_reels',
    youtube: 'youtube_shorts',
  };

  /**
   * Convert agent platform format to ads platform format (throws on invalid)
   * tiktok → tiktok
   * instagram_reels → instagram
   * youtube_shorts → youtube
   */
  static toAdsFormat(agentPlatform: AgentPlatform): AdsPlatform {
    const mapped = this.AGENT_TO_ADS[agentPlatform];
    if (!mapped) {
      throw new Error(`Invalid agent platform: ${agentPlatform}`);
    }
    return mapped;
  }

  /**
   * Convert ads platform format to agent platform format (throws on invalid)
   * tiktok → tiktok
   * instagram → instagram_reels
   * youtube → youtube_shorts
   */
  static toAgentFormat(adsPlatform: AdsPlatform): AgentPlatform {
    const mapped = this.ADS_TO_AGENT[adsPlatform];
    if (!mapped) {
      throw new Error(`Invalid ads platform: ${adsPlatform}`);
    }
    return mapped;
  }

  /**
   * Safely convert agent platform to ads format with default fallback
   * Returns 'tiktok' and logs warning if platform is invalid
   */
  static toAdsFormatSafe(agentPlatform: string): AdsPlatform {
    if (this.isValidAgentPlatform(agentPlatform)) {
      return this.AGENT_TO_ADS[agentPlatform];
    }
    this.logger.warn(
      `Invalid agent platform "${agentPlatform}", defaulting to tiktok`,
    );
    return 'tiktok';
  }

  /**
   * Safely convert ads platform to agent format with default fallback
   * Returns 'tiktok' and logs warning if platform is invalid
   */
  static toAgentFormatSafe(adsPlatform: string): AgentPlatform {
    if (this.isValidAdsPlatform(adsPlatform)) {
      return this.ADS_TO_AGENT[adsPlatform];
    }
    this.logger.warn(
      `Invalid ads platform "${adsPlatform}", defaulting to tiktok`,
    );
    return 'tiktok';
  }

  /**
   * Validate if value is a valid agent platform
   */
  static isValidAgentPlatform(value: string): value is AgentPlatform {
    return Object.hasOwn(this.AGENT_TO_ADS, value);
  }

  /**
   * Validate if value is a valid ads platform
   */
  static isValidAdsPlatform(value: string): value is AdsPlatform {
    return Object.hasOwn(this.ADS_TO_AGENT, value);
  }

  /**
   * Get all valid agent platforms
   */
  static getAgentPlatforms(): AgentPlatform[] {
    return Object.keys(this.AGENT_TO_ADS) as AgentPlatform[];
  }

  /**
   * Get all valid ads platforms
   */
  static getAdsPlatforms(): AdsPlatform[] {
    return Object.keys(this.ADS_TO_AGENT) as AdsPlatform[];
  }
}
