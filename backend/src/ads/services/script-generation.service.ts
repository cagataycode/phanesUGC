import { Injectable, Logger } from '@nestjs/common';
import { GeminiService } from '../../ai/gemini.service';
import { CreativeBrief } from '../types/creative-brief';
import { GeneratedScript } from '../types/generated-script';

const SCRIPT_GENERATION_SYSTEM_PROMPT = `You are an expert short-form video ad scriptwriter specializing in TikTok, Instagram Reels, and YouTube Shorts.

## Your Role
Generate a compelling 8-second ad script that:
- Grabs attention immediately (hook)
- Delivers key message concisely (body)
- Ends with clear call-to-action (CTA)
- Fits naturally when spoken aloud in 8 seconds

## Script Structure
- Hook: 1-2 seconds (attention-grabbing opening)
- Body: 4-5 seconds (key benefit/message)
- CTA: 1-2 seconds (clear action)

## Writing Guidelines
- Use conversational language
- Keep sentences short and punchy
- Match the specified tone
- Focus on ONE key benefit
- Make it platform-appropriate
- Ensure it sounds natural when spoken

## Output Format
Return ONLY a valid JSON object with this exact structure:
{
  "title": "Brief descriptive title",
  "hook": "Attention-grabbing opening line",
  "body": "Main message with key benefit",
  "cta": "Clear call to action",
  "full_text": "Complete script as one paragraph",
  "visual_description": "Brief visual direction for the scene"
}

## Example Output
{
  "title": "SoundPro Earbuds TikTok Ad",
  "hook": "These earbuds changed everything for me.",
  "body": "Crystal clear sound, all-day comfort, and they just work.",
  "cta": "Shop now and hear the difference.",
  "full_text": "These earbuds changed everything for me. Crystal clear sound, all-day comfort, and they just work. Shop now and hear the difference.",
  "visual_description": "Product showcase with lifestyle context, emphasizing premium quality and ease of use"
}`;

@Injectable()
export class ScriptGenerationService {
  private readonly logger = new Logger(ScriptGenerationService.name);

  constructor(private readonly geminiService: GeminiService) {}

  async generate(brief: CreativeBrief): Promise<GeneratedScript> {
    const userPrompt = this.buildUserPrompt(brief);

    this.logger.log('Generating script with Gemini');

    try {
      const script = (await this.geminiService.generateContent(
        SCRIPT_GENERATION_SYSTEM_PROMPT,
        userPrompt,
      )) as GeneratedScript;

      // Validate response
      if (!script || !script.full_text) {
        this.logger.error(
          `Gemini returned invalid script: ${JSON.stringify(script)}`,
        );
        throw new Error('Gemini returned invalid script structure');
      }

      this.logger.log(
        `Script generated: ${script.full_text.length} chars, title: "${script.title}"`,
      );

      return script;
    } catch (error) {
      this.logger.error(
        `Gemini script generation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Re-throw to fail the job rather than use bad fallback
      throw new Error(
        `Failed to generate script with Gemini: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private buildUserPrompt(brief: CreativeBrief): string {
    const parts: string[] = [];

    parts.push('Generate an 8-second ad script with the following context:\n');

    if (brief.product_name) {
      parts.push(`Product: ${brief.product_name}`);
    }

    if (brief.offer) {
      parts.push(`Offer/Description: ${brief.offer}`);
    }

    if (brief.key_message) {
      parts.push(`Key Message: ${brief.key_message}`);
    }

    if (brief.benefits && brief.benefits.length > 0) {
      parts.push(`Benefits: ${brief.benefits.join(', ')}`);
    }

    if (brief.audience) {
      parts.push(`Target Audience: ${brief.audience}`);
    }

    if (brief.tone) {
      parts.push(`Tone: ${brief.tone}`);
    }

    if (brief.platform) {
      parts.push(`Platform: ${brief.platform}`);
    }

    if (brief.cta) {
      parts.push(`Preferred CTA: ${brief.cta}`);
    }

    parts.push('\nRequirements:');
    parts.push('- Must fit naturally in 8 seconds when spoken');
    parts.push('- Strong hook that grabs attention immediately');
    parts.push('- Focus on ONE key benefit');
    parts.push('- Clear, actionable CTA');
    parts.push(
      `- Match ${brief.tone || 'direct'} tone throughout`,
    );

    return parts.join('\n');
  }
}
