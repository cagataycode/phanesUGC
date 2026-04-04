import {
  PRICING_CONFIG,
  SUBSCRIPTION_TIERS,
  getSubscriptionTier,
  isValidTierName,
} from './pricing-config';

describe('PricingConfig', () => {
  describe('PRICING_CONFIG', () => {
    it('should have Veo pricing', () => {
      expect(PRICING_CONFIG.veo.fast).toBe(0.15);
      expect(PRICING_CONFIG.veo.standard).toBe(0.4);
    });

    it('should have Claude pricing', () => {
      expect(PRICING_CONFIG.claude.inputTokens).toBe(3.0 / 1_000_000);
      expect(PRICING_CONFIG.claude.outputTokens).toBe(15.0 / 1_000_000);
    });

    it('should have Gemini pricing', () => {
      expect(PRICING_CONFIG.gemini.inputTokens).toBe(1.25 / 1_000_000);
      expect(PRICING_CONFIG.gemini.outputTokens).toBe(10.0 / 1_000_000);
    });
  });

  describe('SUBSCRIPTION_TIERS', () => {
    it('should have free tier configuration', () => {
      const free = SUBSCRIPTION_TIERS.free;
      expect(free.name).toBe('free');
      expect(free.monthlyVideoLimit).toBe(2);
      expect(free.concurrentJobLimit).toBe(2);
      expect(free.requestsPerMinute).toBe(10);
      expect(free.features).toContain('watermark');
    });

    it('should have starter tier configuration', () => {
      const starter = SUBSCRIPTION_TIERS.starter;
      expect(starter.name).toBe('starter');
      expect(starter.monthlyVideoLimit).toBe(20);
      expect(starter.concurrentJobLimit).toBe(3);
      expect(starter.requestsPerMinute).toBe(10);
      expect(starter.features).toContain('no_watermark');
    });

    it('should have pro tier configuration', () => {
      const pro = SUBSCRIPTION_TIERS.pro;
      expect(pro.name).toBe('pro');
      expect(pro.monthlyVideoLimit).toBe(40);
      expect(pro.concurrentJobLimit).toBe(5);
      expect(pro.requestsPerMinute).toBe(10);
      expect(pro.features).toContain('analytics');
    });

    it('should have enterprise tier configuration', () => {
      const enterprise = SUBSCRIPTION_TIERS.enterprise;
      expect(enterprise.name).toBe('enterprise');
      expect(enterprise.monthlyVideoLimit).toBe(-1);
      expect(enterprise.concurrentJobLimit).toBe(10);
      expect(enterprise.requestsPerMinute).toBe(20);
      expect(enterprise.features).toContain('custom_branding');
    });
  });

  describe('getSubscriptionTier', () => {
    it('should return free tier configuration', () => {
      const tier = getSubscriptionTier('free');
      expect(tier.name).toBe('free');
      expect(tier.monthlyVideoLimit).toBe(2);
    });

    it('should return starter tier configuration', () => {
      const tier = getSubscriptionTier('starter');
      expect(tier.name).toBe('starter');
      expect(tier.monthlyVideoLimit).toBe(20);
    });

    it('should return pro tier configuration', () => {
      const tier = getSubscriptionTier('pro');
      expect(tier.name).toBe('pro');
      expect(tier.monthlyVideoLimit).toBe(40);
    });

    it('should return enterprise tier configuration', () => {
      const tier = getSubscriptionTier('enterprise');
      expect(tier.name).toBe('enterprise');
      expect(tier.monthlyVideoLimit).toBe(-1);
    });
  });

  describe('isValidTierName', () => {
    it('should return true for valid tier names', () => {
      expect(isValidTierName('free')).toBe(true);
      expect(isValidTierName('starter')).toBe(true);
      expect(isValidTierName('pro')).toBe(true);
      expect(isValidTierName('enterprise')).toBe(true);
    });

    it('should return false for invalid tier names', () => {
      expect(isValidTierName('invalid')).toBe(false);
      expect(isValidTierName('premium')).toBe(false);
      expect(isValidTierName('')).toBe(false);
    });
  });
});
