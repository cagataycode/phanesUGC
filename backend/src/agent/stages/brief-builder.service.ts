import { Injectable, Logger } from '@nestjs/common';
import { NormalizedRequest } from '../contracts/normalized-request';
import { ProductContext } from '../contracts/product-context';
import { CreativeBrief } from '../contracts/creative-brief';
import { GeminiService } from '../../ai/gemini.service';

/**
 * BriefBuilderService - Builds creative brief using AI
 *
 * Uses Gemini to synthesize normalized request + product context into a structured brief
 */
@Injectable()
export class BriefBuilderService {
  private readonly logger = new Logger(BriefBuilderService.name);

  constructor(private readonly gemini: GeminiService) {}

  async build(
    request: NormalizedRequest,
    context: ProductContext,
  ): Promise<CreativeBrief> {
    this.logger.log(`Building creative brief for job ${request.jobId}`);

    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(request, context);

    try {
      const response = await this.gemini.generateContent(
        systemPrompt,
        userPrompt,
      );

      const brief = this.parseResponse(response, request);
      this.logger.log(`Creative brief generated for job ${request.jobId}`);
      return brief;
    } catch (error) {
      this.logger.error(
        `Failed to generate creative brief: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Fallback to basic brief
      return this.buildFallbackBrief(request, context);
    }
  }

  private buildSystemPrompt(): string {
    return `You are an expert advertising strategist specializing in short-form video ads for social media platforms (TikTok, Instagram Reels, YouTube Shorts).

Your task is to analyze a product and user intent, then create a structured creative brief that will guide video ad production.

Output a JSON object with this exact structure:
{
  "productName": "string",
  "productCategory": "string (optional)",
  "offer": "string - main value proposition",
  "audience": "string - target audience description",
  "painPoints": ["string array - problems the product solves"],
  "keyBenefits": ["string array - 3-5 key benefits"],
  "tone": "direct" | "professional" | "casual" | "enthusiastic",
  "cta": "string - call to action",
  "visualStyle": "dynamic" | "minimalist" | "bold" | "cinematic",
  "keyMessage": "string - the ONE thing viewers should remember"
}

Guidelines:
- Keep it concise - this is for 8-second videos
- Focus on ONE clear message
- Match tone to platform (TikTok = casual, LinkedIn = professional)
- CTA should be action-oriented (e.g., "Shop now", "Learn more", "Try free")
- Visual style should match product category and audience`;
  }

  private buildUserPrompt(
    request: NormalizedRequest,
    context: ProductContext,
  ): string {
    return `Create a creative brief for this ad:

USER INTENT:
${request.prompt}

PRODUCT INFORMATION:
- Name: ${context.name}
- Description: ${context.description || 'Not provided'}
- Category: ${context.category || 'Not specified'}
- Key Benefits: ${context.benefits.length > 0 ? context.benefits.join(', ') : 'Not provided'}
- Pricing: ${context.pricing || 'Not provided'}
- Special Offers: ${context.offers || 'None'}

PLATFORM CONSTRAINTS:
- Platform: ${request.platform}
- Duration: ${request.durationSec} seconds
- Aspect Ratio: ${request.aspectRatio}
- Language: ${request.language}

USER PREFERENCES:
- Tone: ${request.tone || 'Not specified'}
- Target Audience: ${request.targetAudience || 'Not specified'}
- CTA: ${request.cta || 'Not specified'}
- Visual Style: ${request.visualStyle || 'Not specified'}

Analyze this information and create a strategic creative brief that will guide the video production.`;
  }

  private parseResponse(
    response: unknown,
    request: NormalizedRequest,
  ): CreativeBrief {
    const data = response as Record<string, unknown>;

    return {
      productName:
        typeof data.productName === 'string' ? data.productName : 'Product',
      productCategory:
        typeof data.productCategory === 'string'
          ? data.productCategory
          : undefined,
      offer: typeof data.offer === 'string' ? data.offer : request.prompt,
      audience:
        typeof data.audience === 'string' ? data.audience : 'General audience',
      painPoints: Array.isArray(data.painPoints)
        ? data.painPoints.map(String)
        : [],
      keyBenefits: Array.isArray(data.keyBenefits)
        ? data.keyBenefits.map(String)
        : [],
      tone: this.validateTone(data.tone),
      cta:
        typeof data.cta === 'string' ? data.cta : request.cta || 'Learn more',
      visualStyle: this.validateVisualStyle(data.visualStyle),
      keyMessage:
        typeof data.keyMessage === 'string'
          ? data.keyMessage
          : typeof data.offer === 'string'
            ? data.offer
            : request.prompt,
      targetPlatform: request.platform,
      targetDuration: request.durationSec,
      targetAspectRatio: request.aspectRatio,
      language: request.language,
      createdAt: new Date(),
    };
  }

  private validateTone(
    tone: unknown,
  ): 'direct' | 'professional' | 'casual' | 'enthusiastic' {
    const validTones = ['direct', 'professional', 'casual', 'enthusiastic'];
    if (typeof tone === 'string' && validTones.includes(tone)) {
      return tone as 'direct' | 'professional' | 'casual' | 'enthusiastic';
    }
    return 'enthusiastic'; // Default
  }

  private validateVisualStyle(
    style: unknown,
  ): 'dynamic' | 'minimalist' | 'bold' | 'cinematic' {
    const validStyles = ['dynamic', 'minimalist', 'bold', 'cinematic'];
    if (typeof style === 'string' && validStyles.includes(style)) {
      return style as 'dynamic' | 'minimalist' | 'bold' | 'cinematic';
    }
    return 'dynamic'; // Default
  }

  private buildFallbackBrief(
    request: NormalizedRequest,
    context: ProductContext,
  ): CreativeBrief {
    this.logger.warn('Using fallback brief generation');

    return {
      productName: context.name,
      productCategory: context.category,
      offer: request.prompt,
      audience: request.targetAudience || 'General audience',
      painPoints: [],
      keyBenefits: context.benefits,
      tone: 'enthusiastic',
      cta: request.cta || 'Learn more',
      visualStyle: 'dynamic',
      keyMessage: request.prompt,
      targetPlatform: request.platform,
      targetDuration: request.durationSec,
      targetAspectRatio: request.aspectRatio,
      language: request.language,
      createdAt: new Date(),
    };
  }
}
