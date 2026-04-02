/**
 * PlatformMapper - Bidirectional platform name mapping
 *
 * Single source of truth for platform name conversions between
 * agent format (instagram_reels) and ads format (instagram)
 */

export type AgentPlatform = 'tiktok' | 'instagram_reels' | 'youtube_shorts';
export type AdsPlatform = 'tiktok' | 'instagram' | 'youtube';

export class PlatformMapper {
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
   * Convert agent platform format to ads platform format
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
   * Convert ads platform format to agent platform format
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
   * Validate if value is a valid agent platform
   */
  static isValidAgentPlatform(value: string): value is AgentPlatform {
    return value in this.AGENT_TO_ADS;
  }

  /**
   * Validate if value is a valid ads platform
   */
  static isValidAdsPlatform(value: string): value is AdsPlatform {
    return value in this.ADS_TO_AGENT;
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
