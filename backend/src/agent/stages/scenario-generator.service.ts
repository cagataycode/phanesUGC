import { Injectable, Logger } from '@nestjs/common';
import { CreativeBrief } from '../contracts/creative-brief';
import { Scenario, ScenarioSet } from '../contracts/scenario';
import { LlmService } from '../../ai/llm.service';

/**
 * ScenarioGeneratorService - Generates 4 creative scenarios using AI
 *
 * Uses LLM to produce 4 distinct creative directions from the brief
 */
@Injectable()
export class ScenarioGeneratorService {
  private readonly logger = new Logger(ScenarioGeneratorService.name);

  constructor(private readonly llm: LlmService) {}

  async generate(jobId: string, brief: CreativeBrief): Promise<ScenarioSet> {
    this.logger.log(`Generating scenarios for job ${jobId}`);

    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(brief);

    try {
      const response = await this.llm.generateContent(
        systemPrompt,
        userPrompt,
      );

      const scenarios = this.parseResponse(response);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

      this.logger.log(`Generated 4 scenarios for job ${jobId}`);

      return {
        jobId,
        scenarios: scenarios as [Scenario, Scenario, Scenario, Scenario],
        generatedAt: now,
        expiresAt,
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate scenarios: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Fallback to default scenarios
      return this.buildFallbackScenarios(jobId, brief);
    }
  }

  private buildSystemPrompt(): string {
    return `You are an expert creative director specializing in short-form video ads.

Your task is to generate 4 DISTINCT creative scenarios for a video ad. Each scenario represents a different creative approach to selling the same product.

Output a JSON array with exactly 4 scenario objects, each with this structure:
{
  "scenarioId": 1-4,
  "title": "string - short creative direction name (e.g., 'Problem/Solution', 'Social Proof')",
  "hook": "string - the opening line that grabs attention (max 10 words)",
  "angle": "string - persuasion strategy (e.g., 'problem/solution', 'social proof', 'urgency', 'educational', 'aspirational', 'humor')",
  "tone": "funny" | "serious" | "aspirational" | "urgent" | "educational",
  "visualDirection": "string - brief description of visual style (1 sentence)",
  "ctaText": "string - call to action",
  "summary": "string - 2-3 sentence description of what the ad will look like"
}

IMPORTANT RULES:
1. Each scenario MUST use a DIFFERENT persuasion angle
2. Each scenario MUST have a DIFFERENT tone
3. Hooks must be attention-grabbing and platform-appropriate
4. Keep it concise - this is for 8-second videos
5. Visual directions should be specific and actionable

Common persuasion angles:
- Problem/Solution: Show pain point, introduce product as solution
- Social Proof: Leverage testimonials, popularity, FOMO
- Urgency: Limited time offers, scarcity, act now
- Educational: How it works, tips, demonstrations
- Aspirational: Lifestyle upgrade, dream outcome
- Humor: Funny situations, relatable moments`;
  }

  private buildUserPrompt(brief: CreativeBrief): string {
    return `Generate 4 distinct creative scenarios for this ad:

CREATIVE BRIEF:
- Product: ${brief.productName}
- Category: ${brief.productCategory || 'Not specified'}
- Offer: ${brief.offer}
- Target Audience: ${brief.audience}
- Pain Points: ${brief.painPoints.join(', ') || 'None specified'}
- Key Benefits: ${brief.keyBenefits.join(', ')}
- Desired Tone: ${brief.tone}
- CTA: ${brief.cta}
- Visual Style: ${brief.visualStyle}
- Key Message: ${brief.keyMessage}

PLATFORM CONSTRAINTS:
- Platform: ${brief.targetPlatform}
- Duration: ${brief.targetDuration} seconds
- Aspect Ratio: ${brief.targetAspectRatio}
- Language: ${brief.language}

Create 4 scenarios that approach this product from completely different creative angles. Make each one unique and compelling.`;
  }

  private parseResponse(response: unknown): Scenario[] {
    const data = response as unknown[];

    if (!Array.isArray(data) || data.length !== 4) {
      throw new Error('Expected array of 4 scenarios');
    }

    return data.map((item, index) => {
      // Type guard for scenario-like object
      const isScenarioLike = (obj: unknown): obj is Partial<Scenario> => {
        return typeof obj === 'object' && obj !== null;
      };

      if (!isScenarioLike(item)) {
        throw new Error(`Invalid scenario at index ${index}`);
      }

      const scenario = item;
      const now = new Date();

      return {
        scenarioId:
          typeof scenario.scenarioId === 'number'
            ? scenario.scenarioId
            : index + 1,
        title:
          typeof scenario.title === 'string'
            ? scenario.title
            : `Scenario ${index + 1}`,
        hook:
          typeof scenario.hook === 'string' ? scenario.hook : 'Check this out!',
        angle: typeof scenario.angle === 'string' ? scenario.angle : 'general',
        tone: this.validateTone(scenario.tone),
        visualDirection:
          typeof scenario.visualDirection === 'string'
            ? scenario.visualDirection
            : 'Dynamic product showcase',
        ctaText:
          typeof scenario.ctaText === 'string'
            ? scenario.ctaText
            : 'Learn more',
        summary:
          typeof scenario.summary === 'string'
            ? scenario.summary
            : 'A compelling ad showcasing the product.',
        generatedAt: now,
      };
    });
  }

  private validateTone(
    tone: unknown,
  ): 'funny' | 'serious' | 'aspirational' | 'urgent' | 'educational' {
    const validTones = [
      'funny',
      'serious',
      'aspirational',
      'urgent',
      'educational',
    ];
    if (typeof tone === 'string' && validTones.includes(tone)) {
      return tone as
        | 'funny'
        | 'serious'
        | 'aspirational'
        | 'urgent'
        | 'educational';
    }
    return 'serious'; // Default
  }

  private buildFallbackScenarios(
    jobId: string,
    brief: CreativeBrief,
  ): ScenarioSet {
    this.logger.warn('Using fallback scenario generation');

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const scenarios: [Scenario, Scenario, Scenario, Scenario] = [
      {
        scenarioId: 1,
        title: 'Problem/Solution',
        hook: `Struggling with ${brief.painPoints[0] || 'this problem'}?`,
        angle: 'problem/solution',
        tone: 'serious',
        visualDirection:
          'Show the problem, then introduce the product as the solution',
        ctaText: brief.cta,
        summary: `Start by highlighting a common pain point, then show how ${brief.productName} solves it effortlessly.`,
        generatedAt: now,
      },
      {
        scenarioId: 2,
        title: 'Social Proof',
        hook: 'Join thousands who already love this!',
        angle: 'social proof',
        tone: 'aspirational',
        visualDirection: 'Show happy customers and testimonials',
        ctaText: brief.cta,
        summary: `Leverage social proof and testimonials to build trust and show that ${brief.productName} is the popular choice.`,
        generatedAt: now,
      },
      {
        scenarioId: 3,
        title: 'Urgency',
        hook: 'Limited time offer!',
        angle: 'urgency',
        tone: 'urgent',
        visualDirection: 'Fast-paced visuals with countdown timer',
        ctaText: brief.cta,
        summary: `Create urgency with limited-time offers and scarcity to drive immediate action.`,
        generatedAt: now,
      },
      {
        scenarioId: 4,
        title: 'Educational',
        hook: "Here's how it works...",
        angle: 'educational',
        tone: 'educational',
        visualDirection: 'Step-by-step demonstration of the product',
        ctaText: brief.cta,
        summary: `Educate viewers on how ${brief.productName} works and demonstrate its key benefits in action.`,
        generatedAt: now,
      },
    ];

    return {
      jobId,
      scenarios,
      generatedAt: now,
      expiresAt,
    };
  }
}
