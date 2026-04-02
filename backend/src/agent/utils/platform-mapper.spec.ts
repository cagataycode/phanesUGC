import { PlatformMapper, AgentPlatform, AdsPlatform } from './platform-mapper';

describe('PlatformMapper', () => {
  describe('toAdsFormat', () => {
    it('should convert tiktok to tiktok', () => {
      expect(PlatformMapper.toAdsFormat('tiktok')).toBe('tiktok');
    });

    it('should convert instagram_reels to instagram', () => {
      expect(PlatformMapper.toAdsFormat('instagram_reels')).toBe('instagram');
    });

    it('should convert youtube_shorts to youtube', () => {
      expect(PlatformMapper.toAdsFormat('youtube_shorts')).toBe('youtube');
    });

    it('should throw error for invalid platform', () => {
      expect(() =>
        PlatformMapper.toAdsFormat('invalid' as AgentPlatform),
      ).toThrow('Invalid agent platform: invalid');
    });
  });

  describe('toAgentFormat', () => {
    it('should convert tiktok to tiktok', () => {
      expect(PlatformMapper.toAgentFormat('tiktok')).toBe('tiktok');
    });

    it('should convert instagram to instagram_reels', () => {
      expect(PlatformMapper.toAgentFormat('instagram')).toBe('instagram_reels');
    });

    it('should convert youtube to youtube_shorts', () => {
      expect(PlatformMapper.toAgentFormat('youtube')).toBe('youtube_shorts');
    });

    it('should throw error for invalid platform', () => {
      expect(() =>
        PlatformMapper.toAgentFormat('invalid' as AdsPlatform),
      ).toThrow('Invalid ads platform: invalid');
    });
  });

  describe('isValidAgentPlatform', () => {
    it('should return true for valid agent platforms', () => {
      expect(PlatformMapper.isValidAgentPlatform('tiktok')).toBe(true);
      expect(PlatformMapper.isValidAgentPlatform('instagram_reels')).toBe(true);
      expect(PlatformMapper.isValidAgentPlatform('youtube_shorts')).toBe(true);
    });

    it('should return false for invalid platforms', () => {
      expect(PlatformMapper.isValidAgentPlatform('instagram')).toBe(false);
      expect(PlatformMapper.isValidAgentPlatform('youtube')).toBe(false);
      expect(PlatformMapper.isValidAgentPlatform('invalid')).toBe(false);
    });
  });

  describe('isValidAdsPlatform', () => {
    it('should return true for valid ads platforms', () => {
      expect(PlatformMapper.isValidAdsPlatform('tiktok')).toBe(true);
      expect(PlatformMapper.isValidAdsPlatform('instagram')).toBe(true);
      expect(PlatformMapper.isValidAdsPlatform('youtube')).toBe(true);
    });

    it('should return false for invalid platforms', () => {
      expect(PlatformMapper.isValidAdsPlatform('instagram_reels')).toBe(false);
      expect(PlatformMapper.isValidAdsPlatform('youtube_shorts')).toBe(false);
      expect(PlatformMapper.isValidAdsPlatform('invalid')).toBe(false);
    });
  });

  describe('getAgentPlatforms', () => {
    it('should return all agent platforms', () => {
      const platforms = PlatformMapper.getAgentPlatforms();
      expect(platforms).toEqual([
        'tiktok',
        'instagram_reels',
        'youtube_shorts',
      ]);
    });
  });

  describe('getAdsPlatforms', () => {
    it('should return all ads platforms', () => {
      const platforms = PlatformMapper.getAdsPlatforms();
      expect(platforms).toEqual(['tiktok', 'instagram', 'youtube']);
    });
  });

  describe('bidirectional conversion', () => {
    it('should maintain consistency in round-trip conversions', () => {
      const agentPlatforms = PlatformMapper.getAgentPlatforms();

      agentPlatforms.forEach((agentPlatform) => {
        const adsPlatform = PlatformMapper.toAdsFormat(agentPlatform);
        const backToAgent = PlatformMapper.toAgentFormat(adsPlatform);
        expect(backToAgent).toBe(agentPlatform);
      });
    });
  });
});
