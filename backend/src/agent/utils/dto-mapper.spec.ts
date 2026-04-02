import { DtoMapper } from './dto-mapper';
import { NormalizedRequest } from '../contracts/normalized-request';
import { ProductContext } from '../contracts/product-context';
import { CreativeBrief } from '../contracts/creative-brief';
import { AdScript } from '../contracts/ad-script';
import { CreativeBrief as AdsCreativeBrief } from '../../ads/types/creative-brief';
import { GeneratedScript } from '../../ads/types/generated-script';
import { VeoScenePrompt } from '../../ads/types/veo-scene-prompt';

describe('DtoMapper', () => {
  describe('toCreateAdDto', () => {
    it('should convert NormalizedRequest and ProductContext to CreateAdDto', () => {
      const request: NormalizedRequest = {
        jobId: 'test-job',
        businessId: 'test-business',
        prompt: 'Test prompt',
        platform: 'instagram_reels',
        aspectRatio: '9:16',
        durationSec: 8,
        language: 'en',
        product: {
          name: 'Test Product',
          description: 'Test description',
          urls: ['https://example.com'],
        },
        targetAudience: 'Young adults',
        tone: 'casual',
        cta: 'Shop now',
        subtitleStyle: 'kinetic',
        disableBackgroundMusic: false,
        disableCaptions: false,
        disableCtaOverlay: false,
      };

      const productContext: ProductContext = {
        name: 'Test Product',
        description: 'Test description',
        category: 'Electronics',
        benefits: ['Benefit 1', 'Benefit 2'],
        sourceUrl: 'https://example.com',
        scrapedAt: new Date(),
        confidence: 0.9,
      };

      const result = DtoMapper.toCreateAdDto(request, productContext);

      expect(result.businessId).toBe('test-business');
      expect(result.productId).toBe('agent-generated');
      expect(result.createdBy).toBe('agent');
      expect(result.prompt_inputs.prompt).toBe('Test prompt');
      expect(result.prompt_inputs.platform).toBe('instagram');
      expect(result.prompt_inputs.language).toBe('en');
      expect(result.prompt_inputs.product_info?.name).toBe('Test Product');
      expect(result.veo_config.aspect_ratio).toBe('9:16');
      expect(result.veo_config.duration_sec).toBe(8);
    });

    it('should use brief values when provided', () => {
      const request: NormalizedRequest = {
        jobId: 'test-job',
        businessId: 'test-business',
        prompt: 'Test prompt',
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

      const productContext: ProductContext = {
        name: 'Test Product',
        description: 'Test description',
        category: 'Electronics',
        benefits: [],
        sourceUrl: 'https://example.com',
        scrapedAt: new Date(),
        confidence: 0.9,
      };

      const brief: CreativeBrief = {
        productName: 'Test Product',
        productCategory: 'Electronics',
        offer: 'Special offer',
        audience: 'Young adults',
        painPoints: [],
        keyBenefits: [],
        tone: 'enthusiastic',
        cta: 'Buy now',
        visualStyle: 'dynamic',
        keyMessage: 'Test message',
        targetPlatform: 'tiktok',
        targetDuration: 8,
        targetAspectRatio: '9:16',
        language: 'en',
        createdAt: new Date(),
      };

      const result = DtoMapper.toCreateAdDto(request, productContext, brief);

      expect(result.prompt_inputs.tone).toBe('enthusiastic');
      expect(result.prompt_inputs.cta).toBe('Buy now');
    });
  });

  describe('toAdsBrief', () => {
    it('should convert agent CreativeBrief to ads CreativeBrief', () => {
      const agentBrief: CreativeBrief = {
        productName: 'Test Product',
        productCategory: 'Electronics',
        offer: 'Special offer',
        audience: 'Young adults',
        painPoints: ['Pain 1', 'Pain 2'],
        keyBenefits: ['Benefit 1', 'Benefit 2'],
        tone: 'casual',
        cta: 'Shop now',
        visualStyle: 'dynamic',
        keyMessage: 'Test message',
        targetPlatform: 'instagram_reels',
        targetDuration: 8,
        targetAspectRatio: '9:16',
        language: 'en',
        createdAt: new Date(),
      };

      const result = DtoMapper.toAdsBrief(agentBrief);

      expect(result.product_name).toBe('Test Product');
      expect(result.offer).toBe('Special offer');
      expect(result.audience).toBe('Young adults');
      expect(result.pain_points).toEqual(['Pain 1', 'Pain 2']);
      expect(result.benefits).toEqual(['Benefit 1', 'Benefit 2']);
      expect(result.tone).toBe('casual');
      expect(result.cta).toBe('Shop now');
      expect(result.visual_style).toBe('dynamic');
      expect(result.key_message).toBe('Test message');
      expect(result.platform).toBe('instagram'); // Converted from agent format
      expect(result.duration_sec).toBe(8);
      expect(result.aspect_ratio).toBe('9:16');
      expect(result.language).toBe('en');
    });
  });

  describe('toAgentBrief', () => {
    it('should convert ads CreativeBrief to agent CreativeBrief', () => {
      const adsBrief: AdsCreativeBrief = {
        product_name: 'Test Product',
        offer: 'Special offer',
        audience: 'Young adults',
        pain_points: ['Pain 1', 'Pain 2'],
        benefits: ['Benefit 1', 'Benefit 2'],
        tone: 'casual',
        cta: 'Shop now',
        visual_style: 'dynamic',
        key_message: 'Test message',
        platform: 'instagram', // Ads format
        duration_sec: 8,
        aspect_ratio: '9:16',
        language: 'en',
      };

      const productContext: ProductContext = {
        name: 'Test Product',
        description: 'Test description',
        category: 'Electronics',
        benefits: [],
        sourceUrl: 'https://example.com',
        scrapedAt: new Date(),
        confidence: 0.9,
      };

      const result = DtoMapper.toAgentBrief(adsBrief, productContext);

      expect(result.productName).toBe('Test Product');
      expect(result.productCategory).toBe('Electronics');
      expect(result.offer).toBe('Special offer');
      expect(result.audience).toBe('Young adults');
      expect(result.painPoints).toEqual(['Pain 1', 'Pain 2']);
      expect(result.keyBenefits).toEqual(['Benefit 1', 'Benefit 2']);
      expect(result.tone).toBe('casual');
      expect(result.cta).toBe('Shop now');
      expect(result.visualStyle).toBe('dynamic');
      expect(result.keyMessage).toBe('Test message');
      expect(result.targetPlatform).toBe('instagram_reels');
      expect(result.targetDuration).toBe(8);
      expect(result.targetAspectRatio).toBe('9:16');
      expect(result.language).toBe('en');
    });

    it('should use defaults for missing fields', () => {
      const adsBrief: AdsCreativeBrief = {
        platform: 'tiktok',
        duration_sec: 8,
        aspect_ratio: '9:16',
        language: 'en',
      };

      const productContext: ProductContext = {
        name: 'Test Product',
        description: 'Test description',
        category: 'Electronics',
        benefits: [],
        sourceUrl: 'https://example.com',
        scrapedAt: new Date(),
        confidence: 0.9,
      };

      const result = DtoMapper.toAgentBrief(adsBrief, productContext);

      expect(result.productName).toBe('Test Product');
      expect(result.offer).toBe('Special offer');
      expect(result.audience).toBe('General audience');
      expect(result.tone).toBe('direct');
      expect(result.cta).toBe('Learn more');
      expect(result.visualStyle).toBe('cinematic');
      expect(result.keyMessage).toBe('Discover our product');
    });
  });

  describe('toAdsScript', () => {
    it('should convert agent AdScript to ads GeneratedScript', () => {
      const agentScript: AdScript = {
        jobId: 'test-job',
        scenarioId: 1,
        title: 'Test Script',
        hook: 'Test hook',
        voiceoverLines: [
          { text: 'Line 1', estimatedDurationSec: 4, scene: 1 },
          { text: 'Line 2', estimatedDurationSec: 4, scene: 1 },
        ],
        cta: 'Shop now',
        fullText: 'Line 1 Line 2',
        visualDescription: 'Test visual',
        totalEstimatedDuration: 8,
        generatedAt: new Date(),
      };

      const result = DtoMapper.toAdsScript(agentScript);

      expect(result.title).toBe('Test Script');
      expect(result.hook).toBe('Test hook');
      expect(result.body).toBe('Line 1 Line 2');
      expect(result.cta).toBe('Shop now');
      expect(result.full_text).toBe('Line 1 Line 2');
      expect(result.visual_description).toBe('Test visual');
    });
  });

  describe('toAgentScript', () => {
    it('should convert ads GeneratedScript to agent AdScript', () => {
      const adsScript: GeneratedScript = {
        title: 'Test Script',
        hook: 'Test hook',
        body: 'Test body',
        cta: 'Shop now',
        full_text: 'Full text',
        visual_description: 'Test visual',
      };

      const result = DtoMapper.toAgentScript(adsScript, 'test-job', 1);

      expect(result.jobId).toBe('test-job');
      expect(result.scenarioId).toBe(1);
      expect(result.title).toBe('Test Script');
      expect(result.hook).toBe('Test hook');
      expect(result.cta).toBe('Shop now');
      expect(result.fullText).toBe('Full text');
      expect(result.visualDescription).toBe('Test visual');
      expect(result.voiceoverLines).toHaveLength(1);
      expect(result.voiceoverLines[0].text).toBe('Full text');
      expect(result.totalEstimatedDuration).toBe(8);
    });

    it('should use defaults for missing fields', () => {
      const adsScript: GeneratedScript = {
        full_text: 'Full text',
      };

      const result = DtoMapper.toAgentScript(adsScript, 'test-job', 1);

      expect(result.title).toBe('Untitled');
      expect(result.hook).toBe('');
      expect(result.cta).toBe('Learn more');
    });
  });

  describe('toAgentVeoPrompt', () => {
    it('should convert ads VeoScenePrompt to agent VeoPrompt', () => {
      const scenePrompt: VeoScenePrompt = {
        scene_id: 1,
        duration_seconds: 8,
        aspect_ratio: '9:16',
        prompt: {
          intent: 'Test intent',
          shot: {
            type: 'close-up',
            framing: 'tight',
            camera_angle: 'eye-level',
            camera_motion: 'static',
            lens_feel: '50mm',
            composition: 'centered',
          },
          subject: {
            type: 'product',
            description: 'Test product',
            action: 'displayed',
          },
          environment: {
            location: 'studio',
            props: ['prop1'],
            atmosphere: 'clean',
          },
          lighting: {
            style: 'soft',
            color_temperature: 'warm',
          },
          audio: {
            speech_text: 'Test speech',
            speech_style: 'conversational',
          },
          style: {
            visual_style: 'modern',
            color_palette: '#000000', // String, not array
            rendering_quality: 'high',
            aesthetic_reference: 'minimalist',
          },
          text_overlay: {
            enabled: false,
          },
          cta: {
            enabled: false,
          },
        },
        transition_in: 'fade',
        transition_out: 'fade',
        negative_prompt: 'Test negative',
        generation_config: {
          model: 'veo-3.1',
          safety_filter: 'medium',
          retry_count: 0,
          priority: 'normal',
        },
      };

      const result = DtoMapper.toAgentVeoPrompt('test-job', scenePrompt);

      expect(result.sceneId).toBe(1);
      expect(result.projectId).toBe('test-job');
      expect(result.durationSeconds).toBe(8);
      expect(result.aspectRatio).toBe('9:16');
      expect(result.prompt.intent).toBe('Test intent');
      expect(result.prompt.shot.type).toBe('close-up');
      expect(result.prompt.subject.type).toBe('product');
      expect(result.prompt.audio.speechText).toBe('Test speech');
      expect(result.transitionIn).toBe('fade');
      expect(result.negativePrompt).toBe('Test negative');
      expect(result.generationConfig.model).toBe('veo-3.1');
    });
  });
});
