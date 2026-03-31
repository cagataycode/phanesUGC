import { Test, TestingModule } from '@nestjs/testing';
import { SceneStructuringService } from '../src/ads/services/scene-structuring.service';
import { GeminiService } from '../src/ai/gemini.service';
import { CreateAdDto } from '../src/ads/dto/create-ad.dto';
import { CreativeBrief } from '../src/ads/types/creative-brief';
import { GeneratedScript } from '../src/ads/types/generated-script';
import { VeoScenePrompt } from '../src/ads/types/veo-scene-prompt';

describe('SceneStructuringService', () => {
  let service: SceneStructuringService;
  let geminiService: jest.Mocked<GeminiService>;

  const mockCreateAdDto: CreateAdDto = {
    prompt_inputs: {
      platform: 'tiktok',
      language: 'en',
      tone: 'energetic',
      target_audience: 'young adults',
      cta: 'Shop Now',
      product_info: {
        name: 'Wireless Earbuds Pro',
        description: 'Premium wireless earbuds with noise cancellation',
        benefits: ['Crystal clear sound', 'All-day battery', 'Comfortable fit'],
      },
    },
    veo_config: {
      aspect_ratio: '9:16',
      negative_prompt: 'no blurry faces',
    },
  } as CreateAdDto;

  const mockBrief: CreativeBrief = {
    tone: 'energetic',
    language: 'en',
    duration_sec: 8,
    platform: 'tiktok',
    visual_style: 'cinematic',
    aspect_ratio: '9:16',
    key_message: 'Experience premium sound quality',
  };

  const mockScript: GeneratedScript = {
    title: 'Earbuds Launch',
    hook: 'Ready for the best sound of your life?',
    body: 'These earbuds deliver crystal clear audio with all-day comfort.',
    cta: 'Shop Now',
    full_text:
      'Ready for the best sound of your life? These earbuds deliver crystal clear audio with all-day comfort. Shop Now',
    visual_description: 'Product showcase with dynamic camera movement',
  };

  const mockGeminiResponse: VeoScenePrompt = {
    scene_id: 1,
    project_id: 'test-project',
    duration_seconds: 8,
    aspect_ratio: '9:16',
    prompt: {
      intent:
        'Close-up product showcase of wireless earbuds with dynamic reveal',
      shot: {
        type: 'product_showcase',
        framing: 'close-up centered on product',
        camera_angle: 'slightly elevated at 30 degrees',
        camera_motion: 'slow_push_in',
        lens_feel: '35mm cinematic lens',
        composition: 'product centered with negative space on top',
      },
      subject: {
        type: 'product',
        description: 'sleek black wireless earbuds in white charging case',
        action: 'case opens to reveal earbuds with LED indicator',
        identity_notes: null,
      },
      environment: {
        location: 'modern minimalist studio',
        props: ['marble surface', 'soft fabric'],
        atmosphere: 'clean and premium',
        time_of_day: null,
      },
      lighting: {
        style: 'soft studio key light from upper left',
        color_temperature: 'neutral white 5500K',
        practical_lights: null,
      },
      audio: {
        speech_text: mockScript.full_text,
        speech_style: 'energetic, upbeat, clear',
        ambient_sound: 'subtle studio tone',
        music_suggestion: null,
      },
      style: {
        visual_style: 'cinematic',
        color_palette: 'neutral tones with black accents',
        rendering_quality: 'photorealistic, high detail, 4K',
        aesthetic_reference: 'Apple product launch aesthetic',
      },
      text_overlay: {
        enabled: true,
        text: 'Premium Sound',
        position: 'top_third',
        style_hint: 'bold sans-serif white',
      },
      cta: {
        enabled: true,
        text: 'Shop Now',
        url_hint: null,
      },
    },
    transition_in: 'cut',
    transition_out: 'fade',
    negative_prompt:
      'no text burned into video, no watermark, no logo, no split screen',
    generation_config: {
      model: 'veo-3.1-generate-001',
      seed: null,
      safety_filter: 'standard',
      retry_count: 0,
      priority: 'normal',
    },
  };

  beforeEach(async () => {
    const mockGeminiService = {
      generateContent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SceneStructuringService,
        {
          provide: GeminiService,
          useValue: mockGeminiService,
        },
      ],
    }).compile();

    service = module.get<SceneStructuringService>(SceneStructuringService);
    geminiService = module.get(GeminiService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('structureSingleScene', () => {
    it('should successfully structure a scene with Gemini', async () => {
      geminiService.generateContent.mockResolvedValue(mockGeminiResponse);

      const result = await service.structureSingleScene(
        mockCreateAdDto,
        mockBrief,
        mockScript,
      );

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(geminiService.generateContent).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(geminiService.generateContent).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
      );

      // Verify the prompts contain expected content
      const mockCalls = geminiService.generateContent.mock.calls;
      expect(mockCalls[0][0]).toContain('You are a video ad scene director');
      expect(mockCalls[0][1]).toContain(
        'Generate a single 8-second scene prompt',
      );

      expect(result).toBeDefined();
      expect(result.scene_id).toBe(1);
      expect(result.duration_seconds).toBe(8);
      expect(result.aspect_ratio).toBe('9:16');
      expect(result.prompt.audio.speech_text).toBe(mockScript.full_text);
    });

    it('should validate and enrich the scene with correct values', async () => {
      geminiService.generateContent.mockResolvedValue(mockGeminiResponse);

      const result = await service.structureSingleScene(
        mockCreateAdDto,
        mockBrief,
        mockScript,
      );

      // Check enrichment
      expect(result.duration_seconds).toBe(8);
      expect(result.scene_id).toBe(1);
      expect(result.aspect_ratio).toBe(mockCreateAdDto.veo_config.aspect_ratio);
      expect(result.generation_config.model).toBe('veo-3.1-generate-001');
      expect(result.transition_in).toBe('cut');
      expect(result.transition_out).toBe('fade');
    });

    it('should ensure CTA is enabled and populated', async () => {
      const responseWithoutCTA = {
        ...mockGeminiResponse,
        prompt: {
          ...mockGeminiResponse.prompt,
          cta: { enabled: false, text: '', url_hint: null },
        },
      };

      geminiService.generateContent.mockResolvedValue(responseWithoutCTA);

      const result = await service.structureSingleScene(
        mockCreateAdDto,
        mockBrief,
        mockScript,
      );

      expect(result.prompt.cta.enabled).toBe(true);
      expect(result.prompt.cta.text).toBe('Shop Now');
    });

    it('should use script CTA as fallback if no CTA provided', async () => {
      const dtoWithoutCTA = {
        ...mockCreateAdDto,
        prompt_inputs: {
          ...mockCreateAdDto.prompt_inputs,
          cta: undefined,
        },
      };

      const responseWithoutCTA = {
        ...mockGeminiResponse,
        prompt: {
          ...mockGeminiResponse.prompt,
          cta: { enabled: false, text: '', url_hint: null },
        },
      };

      geminiService.generateContent.mockResolvedValue(responseWithoutCTA);

      const result = await service.structureSingleScene(
        dtoWithoutCTA,
        mockBrief,
        mockScript,
      );

      expect(result.prompt.cta.text).toBe(mockScript.cta);
    });

    it('should ensure speech_text contains full script', async () => {
      const responseWithShortSpeech = {
        ...mockGeminiResponse,
        prompt: {
          ...mockGeminiResponse.prompt,
          audio: {
            ...mockGeminiResponse.prompt.audio,
            speech_text: 'Short',
          },
        },
      };

      geminiService.generateContent.mockResolvedValue(responseWithShortSpeech);

      const result = await service.structureSingleScene(
        mockCreateAdDto,
        mockBrief,
        mockScript,
      );

      expect(result.prompt.audio.speech_text).toBe(mockScript.full_text);
    });

    it('should merge base negative prompt with user negative prompt', async () => {
      geminiService.generateContent.mockResolvedValue(mockGeminiResponse);

      const result = await service.structureSingleScene(
        mockCreateAdDto,
        mockBrief,
        mockScript,
      );

      expect(result.negative_prompt).toContain(
        'no text burned into video, no watermark, no logo',
      );
      expect(result.negative_prompt).toContain('no blurry faces');
    });

    it('should throw error if Gemini fails', async () => {
      geminiService.generateContent.mockRejectedValue(
        new Error('Gemini API error'),
      );

      await expect(
        service.structureSingleScene(mockCreateAdDto, mockBrief, mockScript),
      ).rejects.toThrow('Failed to structure scene with Gemini');
    });

    it('should throw error if Gemini returns invalid structure', async () => {
      geminiService.generateContent.mockResolvedValue({
        scene_id: 1,
        // Missing prompt field
      } as any);

      await expect(
        service.structureSingleScene(mockCreateAdDto, mockBrief, mockScript),
      ).rejects.toThrow(
        'Gemini returned invalid scene structure - missing prompt field',
      );
    });

    it('should throw error if Gemini returns null', async () => {
      geminiService.generateContent.mockResolvedValue(null as any);

      await expect(
        service.structureSingleScene(mockCreateAdDto, mockBrief, mockScript),
      ).rejects.toThrow('Gemini returned invalid scene structure');
    });
  });

  describe('buildUserPrompt', () => {
    it('should include all technical constraints in user prompt', async () => {
      geminiService.generateContent.mockResolvedValue(mockGeminiResponse);

      await service.structureSingleScene(
        mockCreateAdDto,
        mockBrief,
        mockScript,
      );

      const userPrompt = geminiService.generateContent.mock.calls[0][1];

      expect(userPrompt).toContain('Platform: tiktok');
      expect(userPrompt).toContain('Aspect Ratio: 9:16');
      expect(userPrompt).toContain('Duration: 8 seconds');
      expect(userPrompt).toContain('Language: en');
    });

    it('should include product information in user prompt', async () => {
      geminiService.generateContent.mockResolvedValue(mockGeminiResponse);

      await service.structureSingleScene(
        mockCreateAdDto,
        mockBrief,
        mockScript,
      );

      const userPrompt = geminiService.generateContent.mock.calls[0][1];

      expect(userPrompt).toContain('Wireless Earbuds Pro');
      expect(userPrompt).toContain(
        'Premium wireless earbuds with noise cancellation',
      );
      expect(userPrompt).toContain('Crystal clear sound');
    });

    it('should include creative direction in user prompt', async () => {
      geminiService.generateContent.mockResolvedValue(mockGeminiResponse);

      await service.structureSingleScene(
        mockCreateAdDto,
        mockBrief,
        mockScript,
      );

      const userPrompt = geminiService.generateContent.mock.calls[0][1];

      expect(userPrompt).toContain('Tone: energetic');
      expect(userPrompt).toContain('Visual Style: cinematic');
      expect(userPrompt).toContain('Target Audience: young adults');
    });

    it('should include full script in user prompt', async () => {
      geminiService.generateContent.mockResolvedValue(mockGeminiResponse);

      await service.structureSingleScene(
        mockCreateAdDto,
        mockBrief,
        mockScript,
      );

      const userPrompt = geminiService.generateContent.mock.calls[0][1];

      expect(userPrompt).toContain(mockScript.title);
      expect(userPrompt).toContain(mockScript.hook);
      expect(userPrompt).toContain(mockScript.body);
      expect(userPrompt).toContain(mockScript.full_text);
    });

    it('should handle missing optional fields gracefully', async () => {
      const minimalDto = {
        prompt_inputs: {
          platform: 'instagram',
          language: 'en',
        },
        veo_config: {
          aspect_ratio: '1:1',
        },
      } as CreateAdDto;

      const minimalBrief = {
        tone: 'direct',
        language: 'en',
        duration_sec: 8,
        platform: 'instagram',
        aspect_ratio: '1:1',
      } as CreativeBrief;

      const minimalScript = {
        full_text: 'Simple ad text',
      } as GeneratedScript;

      geminiService.generateContent.mockResolvedValue(mockGeminiResponse);

      await service.structureSingleScene(
        minimalDto,
        minimalBrief,
        minimalScript,
      );

      const userPrompt = geminiService.generateContent.mock.calls[0][1];

      expect(userPrompt).toContain('Not provided');
      expect(userPrompt).toContain('not specified — generate one');
    });
  });

  describe('validateAndEnrich', () => {
    it('should force duration to 8 seconds', async () => {
      const responseWithWrongDuration = {
        ...mockGeminiResponse,
        duration_seconds: 10,
      };

      geminiService.generateContent.mockResolvedValue(
        responseWithWrongDuration,
      );

      const result = await service.structureSingleScene(
        mockCreateAdDto,
        mockBrief,
        mockScript,
      );

      expect(result.duration_seconds).toBe(8);
    });

    it('should set scene_id to 1', async () => {
      const responseWithWrongId = {
        ...mockGeminiResponse,
        scene_id: 5,
      };

      geminiService.generateContent.mockResolvedValue(responseWithWrongId);

      const result = await service.structureSingleScene(
        mockCreateAdDto,
        mockBrief,
        mockScript,
      );

      expect(result.scene_id).toBe(1);
    });

    it('should set correct generation config', async () => {
      geminiService.generateContent.mockResolvedValue(mockGeminiResponse);

      const result = await service.structureSingleScene(
        mockCreateAdDto,
        mockBrief,
        mockScript,
      );

      expect(result.generation_config).toEqual({
        model: 'veo-3.1-generate-001',
        seed: null,
        safety_filter: 'standard',
        retry_count: 0,
        priority: 'normal',
      });
    });

    it('should preserve existing negative prompt and add base', async () => {
      const responseWithCustomNegative = {
        ...mockGeminiResponse,
        negative_prompt: 'no animals',
      };

      geminiService.generateContent.mockResolvedValue(
        responseWithCustomNegative,
      );

      const result = await service.structureSingleScene(
        mockCreateAdDto,
        mockBrief,
        mockScript,
      );

      expect(result.negative_prompt).toContain('no text burned into video');
      expect(result.negative_prompt).toContain('no animals');
      expect(result.negative_prompt).toContain('no blurry faces');
    });
  });
});
