import { Injectable, Logger } from '@nestjs/common';
import { LlmService } from '../../ai/llm.service';
import { CreateAdDto } from '../dto/create-ad.dto';
import { CreativeBrief } from '../types/creative-brief';

const BRIEF_GENERATION_SYSTEM_PROMPT = `You are an expert advertising strategist specializing in short-form social video ads.

## Your Role
Create a structured creative brief that will guide script and scene generation for an 8-second social media ad.

## Brief Requirements
- Translate user's creative vision into actionable direction
- Infer missing information from context
- Be specific and concrete
- Focus on ONE key message
- Match platform and audience expectations

## Output Format
Return ONLY a valid JSON object with this exact structure:
{
  "product_name": "Product name or 'Not specified'",
  "offer": "Main value proposition or offer",
  "audience": "Target audience description",
  "pain_points": ["pain point 1", "pain point 2"],
  "benefits": ["benefit 1", "benefit 2", "benefit 3"],
  "tone": "direct|professional|casual|enthusiastic",
  "language": "en",
  "duration_sec": 8,
  "platform": "tiktok|instagram|youtube",
  "cta": "Call to action text",
  "visual_style": "cinematic|minimalist|bold|dynamic",
  "aspect_ratio": "9:16",
  "key_message": "The ONE thing viewers should remember"
}

## Example Output
{
  "product_name": "SoundPro Wireless Earbuds",
  "offer": "Premium wireless earbuds with active noise cancellation",
  "audience": "Young professionals who value quality audio",
  "pain_points": ["Uncomfortable earbuds", "Poor sound quality", "Short battery life"],
  "benefits": ["Crystal clear sound", "All-day comfort", "24-hour battery"],
  "tone": "casual",
  "language": "en",
  "duration_sec": 8,
  "platform": "tiktok",
  "cta": "Shop now",
  "visual_style": "cinematic",
  "aspect_ratio": "9:16",
  "key_message": "Premium sound quality that lasts all day"
}

## CRITICAL: Duration is ALWAYS 8 seconds
The system currently only supports 8-second ads. Always set duration_sec to 8.`;

@Injectable()
export class BriefGenerationService {
  private readonly logger = new Logger(BriefGenerationService.name);

  constructor(private readonly llmService: LlmService) {}

  async generate(createAdDto: CreateAdDto): Promise<CreativeBrief> {
    const { prompt_inputs, veo_config } = createAdDto;

    const userPrompt = this.buildUserPrompt(createAdDto);

    this.logger.log('Generating creative brief with LLM');

    try {
      const brief = (await this.llmService.generateContent(
        BRIEF_GENERATION_SYSTEM_PROMPT,
        userPrompt,
      )) as CreativeBrief;

      // Validate response
      if (!brief || typeof brief !== 'object') {
        this.logger.error(
          `LLM returned invalid brief: ${JSON.stringify(brief)}`,
        );
        throw new Error('LLM returned invalid brief structure');
      }

      // Ensure required fields from input are preserved
      brief.duration_sec = 8; // MVP: Always 8 seconds
      brief.platform = prompt_inputs.platform;
      brief.aspect_ratio = veo_config.aspect_ratio;
      brief.language = prompt_inputs.language;

      this.logger.log(
        `Brief generated: product="${brief.product_name}", tone="${brief.tone}", key_message="${brief.key_message}"`,
      );

      return brief;
    } catch (error) {
      this.logger.error(
        `LLM brief generation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Re-throw to fail the job after LlmService has already exhausted its internal provider fallback
      throw new Error(
        `Failed to generate brief with LLM: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private buildUserPrompt(createAdDto: CreateAdDto): string {
    const { prompt_inputs, veo_config } = createAdDto;
    const parts: string[] = [];

    parts.push(
      `Create a creative brief for an 8-second ${prompt_inputs.platform} ad.\n`,
    );

    parts.push('## User Input');
    parts.push(
      `Creative Direction: ${typeof prompt_inputs.prompt === 'string' ? prompt_inputs.prompt : JSON.stringify(prompt_inputs.prompt)}`,
    );

    if (prompt_inputs.product_info?.name) {
      parts.push(`\n## Product Information`);
      parts.push(`Name: ${prompt_inputs.product_info.name}`);

      if (prompt_inputs.product_info.description) {
        parts.push(`Description: ${prompt_inputs.product_info.description}`);
      }

      if (
        prompt_inputs.product_info.benefits &&
        prompt_inputs.product_info.benefits.length > 0
      ) {
        parts.push(
          `Benefits: ${prompt_inputs.product_info.benefits.join(', ')}`,
        );
      }
    }

    parts.push('\n## Preferences');
    if (prompt_inputs.target_audience) {
      parts.push(`Target Audience: ${prompt_inputs.target_audience}`);
    }
    if (prompt_inputs.tone) {
      parts.push(`Tone: ${prompt_inputs.tone}`);
    }
    if (prompt_inputs.cta) {
      parts.push(`CTA: ${prompt_inputs.cta}`);
    }

    parts.push('\n## Technical Constraints');
    parts.push(`Platform: ${prompt_inputs.platform}`);
    parts.push(`Duration: 8 seconds (FIXED)`);
    parts.push(`Aspect Ratio: ${veo_config.aspect_ratio}`);
    parts.push(`Language: ${prompt_inputs.language}`);

    parts.push(
      '\n## Task\nGenerate a complete creative brief that captures the essence of this ad and provides clear direction for script and scene generation.',
    );

    return parts.join('\n');
  }
}
