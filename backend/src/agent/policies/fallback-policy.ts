/**
 * FallbackPolicy - Provides graceful degradation when operations fail
 *
 * Implements fallback strategies for different failure scenarios
 * to maintain system functionality with reduced quality.
 */

import { Logger } from '@nestjs/common';
import { NormalizedRequest } from '../contracts/normalized-request';
import { ProductContext } from '../contracts/product-context';
import { CreativeBrief } from '../contracts/creative-brief';
import { ScenarioSet, Scenario } from '../contracts/scenario';
import { AgentConstants } from '../utils';

export interface FallbackConfig {
  enableFallbacks: boolean;
  logFallbacks: boolean;
}

export class FallbackPolicy {
  private readonly logger = new Logger(FallbackPolicy.name);

  constructor(private readonly config: FallbackConfig) {}

  /**
   * Fallback for scraping failure
   * Returns manual inputs only with low confidence
   */
  handleScrapingFailure(
    request: NormalizedRequest,
    error: unknown,
  ): ProductContext {
    if (!this.config.enableFallbacks) {
      throw error;
    }

    this.logFallback('scraping', request.jobId, error);

    // Use manual product inputs as fallback
    return {
      source: 'manual',
      name: request.product?.name || 'Product',
      description: request.product?.description || request.prompt,
      category: 'General',
      benefits: request.product?.benefits || [],
      confidence: 0.3, // Low confidence since we're using manual inputs
      scrapedUrls: request.product?.urls,
      acquiredAt: new Date(),
    };
  }

  /**
   * Fallback for brief generation failure
   * Returns simplified brief from template
   */
  async handleBriefFailure(
    request: NormalizedRequest,
    productContext: ProductContext,
    error: unknown,
  ): Promise<CreativeBrief> {
    if (!this.config.enableFallbacks) {
      throw error;
    }

    this.logFallback('brief generation', request.jobId, error);

    // Generate simplified brief from template
    return Promise.resolve({
      productName: productContext.name,
      productCategory: productContext.category,
      offer: 'Special offer',
      audience: request.targetAudience || 'General audience',
      painPoints: [],
      keyBenefits: productContext.benefits.slice(0, 3),
      tone: (request.tone || 'direct') as
        | 'direct'
        | 'professional'
        | 'casual'
        | 'enthusiastic',
      cta: request.cta || 'Learn more',
      visualStyle: 'cinematic',
      keyMessage: `Discover ${productContext.name}`,
      targetPlatform: request.platform,
      targetDuration: request.durationSec,
      targetAspectRatio: request.aspectRatio,
      language: request.language,
      createdAt: new Date(),
    });
  }

  /**
   * Fallback for scenario generation failure
   * Returns single default scenario (padded to 4 scenarios)
   */
  async handleScenarioFailure(
    jobId: string,
    brief: CreativeBrief,
    error: unknown,
  ): Promise<ScenarioSet> {
    if (!this.config.enableFallbacks) {
      throw error;
    }

    this.logFallback('scenario generation', jobId, error);

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + AgentConstants.SCENARIO_EXPIRY_HOURS * 60 * 60 * 1000,
    );

    // Generate single default scenario, repeated 4 times
    const defaultScenario: Scenario = {
      scenarioId: 1,
      title: `${brief.productName} Showcase`,
      hook: `Discover ${brief.productName}`,
      angle: 'product showcase',
      tone: 'educational',
      visualDirection: `${brief.visualStyle} product presentation`,
      ctaText: brief.cta,
      summary: `A ${brief.tone} video showcasing ${brief.productName} with focus on key benefits. ${brief.keyMessage}`,
      generatedAt: now,
    };

    // Create 4 scenarios (required by type)
    return Promise.resolve({
      jobId,
      scenarios: [
        defaultScenario,
        { ...defaultScenario, scenarioId: 2 },
        { ...defaultScenario, scenarioId: 3 },
        { ...defaultScenario, scenarioId: 4 },
      ] as [Scenario, Scenario, Scenario, Scenario],
      generatedAt: now,
      expiresAt,
    });
  }

  /**
   * No fallback for video generation - mark as failed
   * Video generation is critical and cannot be degraded
   */
  handleVideoFailure(error: unknown): never {
    this.logger.error('Video generation failed with no fallback available');
    throw error;
  }

  /**
   * Log fallback activation
   */
  private logFallback(operation: string, jobId: string, error: unknown): void {
    if (!this.config.logFallbacks) {
      return;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);

    this.logger.warn(
      `Fallback activated for ${operation} (job: ${jobId}): ${errorMessage}`,
    );
  }
}
