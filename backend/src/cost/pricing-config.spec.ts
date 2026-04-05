import { PRICING_CONFIG } from './pricing-config';

describe('PricingConfig', () => {
  describe('PRICING_CONFIG', () => {
    // Note: These tests assert pricing structure and invariants, not exact values.
    // Exact pricing values change as vendors update rates. Tests should focus on
    // structural correctness and relative relationships rather than specific numbers.

    it('should have Veo pricing structure', () => {
      expect(PRICING_CONFIG.veo).toBeDefined();
      expect(PRICING_CONFIG.veo.fast).toBeDefined();
      expect(PRICING_CONFIG.veo.standard).toBeDefined();
    });

    it('should have Claude pricing structure', () => {
      expect(PRICING_CONFIG.claude).toBeDefined();
      expect(PRICING_CONFIG.claude.inputTokens).toBeDefined();
      expect(PRICING_CONFIG.claude.outputTokens).toBeDefined();
    });

    it('should have Gemini pricing structure', () => {
      expect(PRICING_CONFIG.gemini).toBeDefined();
      expect(PRICING_CONFIG.gemini.inputTokens).toBeDefined();
      expect(PRICING_CONFIG.gemini.outputTokens).toBeDefined();
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
