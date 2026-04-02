import { FallbackPolicy } from './fallback-policy';
import { NormalizedRequest } from '../contracts/normalized-request';
import { ProductContext } from '../contracts/product-context';
import { CreativeBrief } from '../contracts/creative-brief';

describe('FallbackPolicy', () => {
  let policy: FallbackPolicy;

  beforeEach(() => {
    policy = new FallbackPolicy({
      enableFallbacks: true,
      logFallbacks: true,
    });
  });

  describe('handleScrapingFailure', () => {
    it('should return fallback product context with manual inputs', () => {
      const request: NormalizedRequest = {
        jobId: 'test-job',
        businessId: 'test-business',
        prompt: 'Test product ad',
        platform: 'tiktok',
        aspectRatio: '9:16',
        durationSec: 8,
        language: 'en',
        product: {
          name: 'Test Product',
          description: 'Test description',
          benefits: ['Benefit 1', 'Benefit 2'],
          urls: ['https://example.com'],
        },
        tone: 'casual',
        cta: 'Shop now',
        subtitleStyle: 'kinetic',
        disableBackgroundMusic: false,
        disableCaptions: false,
        disableCtaOverlay: false,
      };

      const error = new Error('Scraping failed');
      const result = policy.handleScrapingFailure(request, error);

      expect(result.name).toBe('Test Product');
      expect(result.description).toBe('Test description');
      expect(result.benefits).toEqual(['Benefit 1', 'Benefit 2']);
      expect(result.confidence).toBe(0.3);
      expect(result.source).toBe('manual');
    });

    it('should use defaults when product info is missing', () => {
      const request: NormalizedRequest = {
        jobId: 'test-job',
        businessId: 'test-business',
        prompt: 'Test ad',
        platform: 'tiktok',
        aspectRatio: '9:16',
        durationSec: 8,
        language: 'en',
        tone: 'casual',
        cta: 'Shop now',
        subtitleStyle: 'kinetic',
        disableBackgroundMusic: false,
        disableCaptions: false,
        disableCtaOverlay: false,
      };

      const error = new Error('Scraping failed');
      const result = policy.handleScrapingFailure(request, error);

      expect(result.name).toBe('Product');
      expect(result.description).toBe('Test ad');
      expect(result.benefits).toEqual([]);
    });

    it('should throw error when fallbacks are disabled', () => {
      const disabledPolicy = new FallbackPolicy({
        enableFallbacks: false,
        logFallbacks: false,
      });

      const request: NormalizedRequest = {
        jobId: 'test-job',
        businessId: 'test-business',
        prompt: 'Test ad',
        platform: 'tiktok',
        aspectRatio: '9:16',
        durationSec: 8,
        language: 'en',
        tone: 'casual',
        cta: 'Shop now',
        subtitleStyle: 'kinetic',
        disableBackgroundMusic: false,
        disableCaptions: false,
        disableCtaOverlay: false,
      };

      const error = new Error('Scraping failed');

      expect(() =>
        disabledPolicy.handleScrapingFailure(request, error),
      ).toThrow('Scraping failed');
    });
  });

  describe('handleBriefFailure', () => {
    it('should return fallback brief from template', async () => {
      const request: NormalizedRequest = {
        jobId: 'test-job',
        businessId: 'test-business',
        prompt: 'Test ad',
        platform: 'instagram_reels',
        aspectRatio: '9:16',
        durationSec: 8,
        language: 'en',
        targetAudience: 'Young adults',
        tone: 'enthusiastic',
        cta: 'Buy now',
        subtitleStyle: 'kinetic',
        disableBackgroundMusic: false,
        disableCaptions: false,
        disableCtaOverlay: false,
      };

      const productContext: ProductContext = {
        name: 'Test Product',
        description: 'Test description',
        category: 'Electronics',
        benefits: ['Benefit 1', 'Benefit 2', 'Benefit 3', 'Benefit 4'],
        sourceUrl: 'https://example.com',
        scrapedAt: new Date(),
        confidence: 0.9,
      };

      const error = new Error('Brief generation failed');
      const result = await policy.handleBriefFailure(
        request,
        productContext,
        error,
      );

      expect(result.productName).toBe('Test Product');
      expect(result.productCategory).toBe('Electronics');
      expect(result.audience).toBe('Young adults');
      expect(result.tone).toBe('enthusiastic');
      expect(result.cta).toBe('Buy now');
      expect(result.keyBenefits).toEqual([
        'Benefit 1',
        'Benefit 2',
        'Benefit 3',
      ]);
    });

    it('should use defaults when optional fields are missing', async () => {
      const request: NormalizedRequest = {
        jobId: 'test-job',
        businessId: 'test-business',
        prompt: 'Test ad',
        platform: 'tiktok',
        aspectRatio: '9:16',
        durationSec: 8,
        language: 'en',
        subtitleStyle: 'kinetic',
        disableBackgroundMusic: false,
        disableCaptions: false,
        disableCtaOverlay: false,
      };

      const productContext: ProductContext = {
        name: 'Test Product',
        description: 'Test description',
        category: 'General',
        benefits: [],
        sourceUrl: 'https://example.com',
        scrapedAt: new Date(),
        confidence: 0.9,
      };

      const error = new Error('Brief generation failed');
      const result = await policy.handleBriefFailure(
        request,
        productContext,
        error,
      );

      expect(result.audience).toBe('General audience');
      expect(result.tone).toBe('direct');
      expect(result.cta).toBe('Learn more');
    });
  });

  describe('handleScenarioFailure', () => {
    it('should return 4 default scenarios', async () => {
      const brief: CreativeBrief = {
        productName: 'Test Product',
        productCategory: 'Electronics',
        offer: 'Special offer',
        audience: 'Young adults',
        painPoints: [],
        keyBenefits: ['Benefit 1'],
        tone: 'casual',
        cta: 'Shop now',
        visualStyle: 'dynamic',
        keyMessage: 'Test message',
        targetPlatform: 'tiktok',
        targetDuration: 8,
        targetAspectRatio: '9:16',
        language: 'en',
        createdAt: new Date(),
      };

      const error = new Error('Scenario generation failed');
      const result = await policy.handleScenarioFailure(
        'test-job',
        brief,
        error,
      );

      expect(result.jobId).toBe('test-job');
      expect(result.scenarios).toHaveLength(4);
      expect(result.scenarios[0].scenarioId).toBe(1);
      expect(result.scenarios[0].title).toBe('Test Product Showcase');
      expect(result.scenarios[0].tone).toBe('educational');
      expect(result.scenarios[1].scenarioId).toBe(2);
      expect(result.scenarios[2].scenarioId).toBe(3);
      expect(result.scenarios[3].scenarioId).toBe(4);
    });
  });

  describe('handleVideoFailure', () => {
    it('should always throw error', () => {
      const error = new Error('Video generation failed');

      expect(() => policy.handleVideoFailure(error)).toThrow(
        'Video generation failed',
      );
    });
  });
});
