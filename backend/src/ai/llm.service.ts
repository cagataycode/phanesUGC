import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  CreativeBriefDto,
  ScriptDto,
  SceneDto,
} from '../ads/dto/ad-response.dto';
import { CreateAdDto } from '../ads/dto/create-ad.dto';

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly model;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY not configured - using mock mode');
      this.genAI = null as unknown as GoogleGenerativeAI;
      this.model = null;
    } else {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-pro-preview-0506' });
    }
  }

  /**
   * Generate a creative brief from user inputs
   */
  async generateCreativeBrief(dto: CreateAdDto): Promise<CreativeBriefDto> {
    this.logger.log('Generating creative brief');

    if (!this.model) {
      return this.getMockCreativeBrief(dto);
    }

    const prompt = this.buildBriefPrompt(dto);

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Parse JSON response
      const brief = JSON.parse(text) as CreativeBriefDto;
      return brief;
    } catch (error) {
      this.logger.error('Failed to generate creative brief', error);
      // Fallback to mock
      return this.getMockCreativeBrief(dto);
    }
  }

  /**
   * Generate a script from the creative brief
   */
  async generateScript(brief: CreativeBriefDto): Promise<ScriptDto> {
    this.logger.log('Generating script');

    if (!this.model) {
      return this.getMockScript(brief);
    }

    const prompt = this.buildScriptPrompt(brief);

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Parse JSON response
      const script = JSON.parse(text) as ScriptDto;
      return script;
    } catch (error) {
      this.logger.error('Failed to generate script', error);
      // Fallback to mock
      return this.getMockScript(brief);
    }
  }

  /**
   * Plan scenes from the script
   */
  async planScenes(script: ScriptDto, brief: CreativeBriefDto): Promise<SceneDto[]> {
    this.logger.log('Planning scenes');

    if (!this.model) {
      return this.getMockScenes(script, brief);
    }

    const prompt = this.buildScenePrompt(script, brief);

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Parse JSON response
      const scenes = JSON.parse(text) as SceneDto[];
      return scenes;
    } catch (error) {
      this.logger.error('Failed to plan scenes', error);
      // Fallback to mock
      return this.getMockScenes(script, brief);
    }
  }

  /**
   * Build prompt for creative brief generation
   */
  private buildBriefPrompt(dto: CreateAdDto): string {
    return `
You are a creative brief generator for short-form video ads. Generate a structured creative brief from the following inputs:

- Prompt: ${dto.prompt}
- Platform: ${dto.platform}
- Aspect Ratio: ${dto.aspect_ratio}
- Duration: ${dto.duration_sec} seconds
- Language: ${dto.language || 'en'}
- Tone: ${dto.tone || 'direct'}
- Target Audience: ${dto.target_audience || 'general'}
- CTA: ${dto.cta || 'Learn more'}
- Product Info: ${JSON.stringify(dto.product_info || {})}
- URLs to scrape: ${JSON.stringify(dto.urls || [])}

Generate a creative brief in JSON format with these fields:
{
  "product_name": string,
  "offer": string,
  "audience": string,
  "pain_points": string[],
  "benefits": string[],
  "tone": string,
  "language": string,
  "duration_sec": number,
  "platform": string,
  "cta": string,
  "visual_style": string,
  "aspect_ratio": string
}

Return ONLY valid JSON, no explanation.
`;
  }

  /**
   * Build prompt for script generation
   */
  private buildScriptPrompt(brief: CreativeBriefDto): string {
    return `
You are a professional copywriter for short-form video ads. Generate a video script from the following creative brief:

${JSON.stringify(brief, null, 2)}

Generate a script in JSON format with these fields:
{
  "title": string - A catchy title for the ad,
  "hook": string - The opening hook to grab attention,
  "voiceover_lines": [
    {"scene": number, "text": string}
  ] - Each line for a scene,
  "cta": string - The call to action
}

Requirements:
- Strong opening hook (first 3 seconds)
- Concise body that fits ${brief.duration_sec} seconds
- Clear CTA at the end
- Subtitle-friendly sentence lengths
- Natural, conversational tone

Return ONLY valid JSON, no explanation.
`;
  }

  /**
   * Build prompt for scene planning
   */
  private buildScenePrompt(script: ScriptDto, brief: CreativeBriefDto): string {
    return `
You are a video scene planner. Convert the following script into detailed scene instructions:

Script: ${JSON.stringify(script, null, 2)}
Brief: ${JSON.stringify(brief, null, 2)}

Generate scenes in JSON format as an array:
[
  {
    "scene_id": number,
    "duration_sec": number,
    "visual_type": "stock_video" | "user_upload" | "generated" | "image",
    "visual_prompt": string - Description for visual generation,
    "overlay_text": string - Optional on-screen text,
    "camera_motion": string - e.g., "slow_push_in", "static", "pan_left",
    "transition_in": string - e.g., "cut", "fade", "dissolve",
    "transition_out": string
  }
]

Requirements:
- Each scene should be 4-8 seconds
- Match visuals to the voiceover content
- Include subtitle-safe overlay regions
- Aspect ratio: ${brief.aspect_ratio}

Return ONLY valid JSON array, no explanation.
`;
  }

  // Mock implementations for development
  private getMockCreativeBrief(dto: CreateAdDto): CreativeBriefDto {
    return {
      product_name: dto.product_info?.name || 'Product',
      offer: dto.prompt,
      audience: dto.target_audience || 'general',
      pain_points: ['Time-consuming ad creation', 'Complex video editing'],
      benefits: dto.product_info?.benefits || ['Save time', 'Easy to use'],
      tone: dto.tone || 'direct',
      language: dto.language || 'en',
      duration_sec: dto.duration_sec,
      platform: dto.platform,
      cta: dto.cta || 'Learn more',
      visual_style: 'modern, clean, energetic',
      aspect_ratio: dto.aspect_ratio,
    };
  }

  private getMockScript(brief: CreativeBriefDto): ScriptDto {
    const scenes = Math.ceil(brief.duration_sec / 6);
    const voiceoverLines: { scene: number; text: string }[] = [];

    for (let i = 1; i <= scenes; i++) {
      voiceoverLines.push({
        scene: i,
        text: `Scene ${i}: ${brief.benefits[0] || 'Amazing product'} that helps you ${brief.pain_points[0] || 'save time'}.`,
      });
    }

    return {
      title: `Ad for ${brief.product_name}`,
      hook: `Stop scrolling! This ${brief.product_name} changes everything.`,
      voiceover_lines: voiceoverLines,
      cta: brief.cta,
    };
  }

  private getMockScenes(script: ScriptDto, brief: CreativeBriefDto): SceneDto[] {
    return script.voiceover_lines.map((line, index) => ({
      scene_id: line.scene,
      duration_sec: 6,
      visual_type: 'stock_video' as const,
      visual_prompt: `${brief.visual_style} - ${line.text}`,
      overlay_text: line.text.substring(0, 30),
      camera_motion: 'slow_push_in',
      transition_in: 'cut',
      transition_out: 'fade',
    }));
  }
}
