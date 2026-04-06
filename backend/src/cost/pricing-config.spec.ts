import { PRICING_CONFIG } from './pricing-config';

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

    it('should have positive pricing values', () => {
      expect(PRICING_CONFIG.veo.fast).toBeGreaterThan(0);
      expect(PRICING_CONFIG.veo.standard).toBeGreaterThan(0);
      expect(PRICING_CONFIG.claude.inputTokens).toBeGreaterThan(0);
      expect(PRICING_CONFIG.claude.outputTokens).toBeGreaterThan(0);
      expect(PRICING_CONFIG.gemini.inputTokens).toBeGreaterThan(0);
      expect(PRICING_CONFIG.gemini.outputTokens).toBeGreaterThan(0);
    });

    it('should have Veo standard pricing higher than fast', () => {
      expect(PRICING_CONFIG.veo.standard).toBeGreaterThan(
        PRICING_CONFIG.veo.fast,
      );
    });

    it('should have Claude output tokens more expensive than input', () => {
      expect(PRICING_CONFIG.claude.outputTokens).toBeGreaterThan(
        PRICING_CONFIG.claude.inputTokens,
      );
    });

    it('should have Gemini output tokens more expensive than input', () => {
      expect(PRICING_CONFIG.gemini.outputTokens).toBeGreaterThan(
        PRICING_CONFIG.gemini.inputTokens,
      );
    });
  });
});
