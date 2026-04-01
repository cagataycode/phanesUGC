import { Injectable, Logger } from '@nestjs/common';
import { CreativeBrief } from '../contracts/creative-brief';
import { Scenario, ScenarioSet } from '../contracts/scenario';

/**
 * ScenarioGeneratorService - Generates 4 creative scenarios using AI
 *
 * Uses Gemini to produce 4 distinct creative directions from the brief
 */
@Injectable()
export class ScenarioGeneratorService {
  private readonly logger = new Logger(ScenarioGeneratorService.name);

  async generate(jobId: string, brief: CreativeBrief): Promise<ScenarioSet> {
    this.logger.log(`Generating scenarios for job ${jobId}`);

    // TODO: Implement Gemini-based scenario generation
    // For now, return 4 placeholder scenarios
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    const scenarios: [Scenario, Scenario, Scenario, Scenario] = [
      {
        scenarioId: 1,
        title: 'Problem/Solution',
        hook: 'Struggling with [problem]?',
        angle: 'problem/solution',
        tone: 'serious',
        visualDirection: 'Show problem, then solution',
        ctaText: brief.cta,
        summary:
          'Start with the pain point, then introduce the product as the solution.',
        generatedAt: now,
      },
      {
        scenarioId: 2,
        title: 'Social Proof',
        hook: 'Join thousands who already love this!',
        angle: 'social proof',
        tone: 'funny',
        visualDirection: 'Show happy customers and testimonials',
        ctaText: brief.cta,
        summary: 'Leverage social proof and testimonials to build trust.',
        generatedAt: now,
      },
      {
        scenarioId: 3,
        title: 'Urgency',
        hook: 'Limited time offer!',
        angle: 'urgency',
        tone: 'urgent',
        visualDirection: 'Fast-paced, countdown timer',
        ctaText: brief.cta,
        summary: 'Create urgency with limited-time offers and scarcity.',
        generatedAt: now,
      },
      {
        scenarioId: 4,
        title: 'Educational',
        hook: "Here's how it works...",
        angle: 'educational',
        tone: 'educational',
        visualDirection: 'Step-by-step demonstration',
        ctaText: brief.cta,
        summary: 'Educate viewers on how the product works and its benefits.',
        generatedAt: now,
      },
    ];

    return Promise.resolve({
      jobId,
      scenarios,
      generatedAt: now,
      expiresAt,
    });
  }
}
