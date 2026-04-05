import { Injectable, Logger } from '@nestjs/common';
import { FirestoreService } from '../firebase/firestore.service';
import { StructuredLoggerService } from '../monitoring/structured-logger.service';
import { PerformanceMonitorService } from '../monitoring/performance-monitor.service';
import { PRICING_CONFIG } from './pricing-config';
import { LogContext } from '../monitoring/types';

/**
 * API Call Cost Details
 */
export interface ApiCallCost {
  service: 'veo' | 'claude' | 'gemini';
  operation: string;
  inputTokens?: number;
  outputTokens?: number;
  durationSeconds?: number;
  cost: number;
  timestamp: Date;
}

/**
 * Cost Breakdown Summary
 */
export interface CostBreakdown {
  veoGeneration: number;
  claudeCalls: number;
  geminiCalls: number;
  totalCost: number;
  currency: 'USD';
}

/**
 * CostTrackerService - Tracks and calculates API costs
 *
 * Features:
 * - Calculate costs for Veo, Claude, and Gemini
 * - Track API calls and update job state
 * - Aggregate monthly costs per business
 * - Integrate with monitoring for metrics
 */
@Injectable()
export class CostTrackerService {
  private readonly logger = new Logger(CostTrackerService.name);

  constructor(
    private readonly firestore: FirestoreService,
    private readonly structuredLogger: StructuredLoggerService,
    private readonly performanceMonitor: PerformanceMonitorService,
  ) {}

  /**
   * Calculate Veo video generation cost
   * @param durationSec Video duration in seconds
   * @param quality Quality tier (fast or standard)
   * @returns Cost in USD
   */
  calculateVeoCost(
    durationSec: number,
    quality: 'fast' | 'standard' = 'fast',
  ): number {
    const pricePerSecond = PRICING_CONFIG.veo[quality];
    const cost = durationSec * pricePerSecond;

    this.logger.debug(
      `Veo cost calculation: ${durationSec}s * ${pricePerSecond}/s = ${cost.toFixed(4)}`,
    );

    return cost;
  }

  /**
   * Calculate Claude API cost based on token usage
   * @param inputTokens Number of input tokens
   * @param outputTokens Number of output tokens
   * @returns Cost in USD
   */
  calculateClaudeCost(inputTokens: number, outputTokens: number): number {
    const inputCost = inputTokens * PRICING_CONFIG.claude.inputTokens;
    const outputCost = outputTokens * PRICING_CONFIG.claude.outputTokens;
    const totalCost = inputCost + outputCost;

    this.logger.debug(
      `Claude cost calculation: ${inputTokens} input + ${outputTokens} output = ${totalCost.toFixed(4)}`,
    );

    return totalCost;
  }

  /**
   * Calculate Gemini API cost based on token usage
   * @param inputTokens Number of input tokens
   * @param outputTokens Number of output tokens
   * @returns Cost in USD
   */
  calculateGeminiCost(inputTokens: number, outputTokens: number): number {
    const inputCost = inputTokens * PRICING_CONFIG.gemini.inputTokens;
    const outputCost = outputTokens * PRICING_CONFIG.gemini.outputTokens;
    const totalCost = inputCost + outputCost;

    this.logger.debug(
      `Gemini cost calculation: ${inputTokens} input + ${outputTokens} output = ${totalCost.toFixed(4)}`,
    );

    return totalCost;
  }

  /**
   * Track an API call and update job state
   * Uses Firestore transaction to prevent race conditions when multiple API calls
   * are tracked concurrently for the same job (read-modify-write pattern).
   * @param jobId Job identifier
   * @param businessId Business identifier
   * @param call API call cost details
   */
  async trackApiCall(
    jobId: string,
    businessId: string,
    call: ApiCallCost,
  ): Promise<void> {
    const context: LogContext = {
      correlationId: jobId,
      jobId,
      businessId,
      service: call.service,
      operation: call.operation,
    };

    try {
      const jobRef = this.firestore
        .getFirestore()
        .collection('businesses')
        .doc(businessId)
        .collection('agent_jobs')
        .doc(jobId);

      // Use transaction to prevent race conditions when tracking concurrent API calls
      await this.firestore
        .getFirestore()
        .runTransaction(async (transaction) => {
          const jobDoc = await transaction.get(jobRef);

          if (!jobDoc.exists) {
            this.logger.warn(`Job ${jobId} not found, skipping cost tracking`);
            return;
          }

          const jobData = jobDoc.data() as Record<string, any> | undefined;

          // Initialize or update apiCalls array
          const apiCalls = (jobData?.apiCalls as ApiCallCost[]) || [];
          apiCalls.push({
            service: call.service,
            operation: call.operation,
            inputTokens: call.inputTokens,
            outputTokens: call.outputTokens,
            durationSeconds: call.durationSeconds,
            cost: call.cost,
            timestamp: call.timestamp,
          });

          // Calculate cost breakdown
          const costBreakdown = this.calculateCostBreakdown(apiCalls);

          // Update job document atomically
          transaction.update(jobRef, {
            apiCalls,
            costBreakdown,
            updatedAt: new Date(),
          });
        });

      // Log the API call (outside transaction)
      this.structuredLogger.log(
        `API call tracked: ${call.service}.${call.operation} - ${call.cost.toFixed(4)}`,
        context,
      );

      // Track metrics (outside transaction)
      this.performanceMonitor.trackCount(
        `cost.${call.service}`,
        call.cost,
        context,
      );

      // Update monthly cost aggregate
      await this.updateMonthlyCost(businessId, call.cost);
    } catch (error) {
      this.structuredLogger.error(
        'Failed to track API call cost',
        error,
        context,
      );
      throw error;
    }
  }

  /**
   * Get cost breakdown for a job
   * @param jobId Job identifier
   * @param businessId Business identifier
   * @returns Cost breakdown
   */
  async getJobCost(jobId: string, businessId: string): Promise<CostBreakdown> {
    const jobRef = this.firestore
      .getFirestore()
      .collection('businesses')
      .doc(businessId)
      .collection('agent_jobs')
      .doc(jobId);

    const jobDoc = await jobRef.get();
    if (!jobDoc.exists) {
      throw new Error(`Job ${jobId} not found`);
    }

    const jobData = jobDoc.data() as Record<string, any> | undefined;
    return (
      (jobData?.costBreakdown as CostBreakdown) || {
        veoGeneration: 0,
        claudeCalls: 0,
        geminiCalls: 0,
        totalCost: 0,
        currency: 'USD',
      }
    );
  }

  /**
   * Get monthly cost for a business
   * @param businessId Business identifier
   * @param yearMonth Year-month string (e.g., "2026-04")
   * @returns Total cost for the month
   */
  async getBusinessMonthlyCost(
    businessId: string,
    yearMonth?: string,
  ): Promise<number> {
    const month = yearMonth || this.getCurrentYearMonth();

    const businessRef = this.firestore
      .getFirestore()
      .collection('businesses')
      .doc(businessId);

    const businessDoc = await businessRef.get();
    if (!businessDoc.exists) {
      return 0;
    }

    const businessData = businessDoc.data() as Record<string, any> | undefined;
    const monthlyCosts = businessData?.monthlyCosts as
      | Record<string, number>
      | undefined;
    return (monthlyCosts?.[month] as number) || 0;
  }

  /**
   * Calculate cost breakdown from API calls
   * @param apiCalls Array of API call costs
   * @returns Cost breakdown
   */
  private calculateCostBreakdown(apiCalls: ApiCallCost[]): CostBreakdown {
    const breakdown: CostBreakdown = {
      veoGeneration: 0,
      claudeCalls: 0,
      geminiCalls: 0,
      totalCost: 0,
      currency: 'USD',
    };

    for (const call of apiCalls) {
      switch (call.service) {
        case 'veo':
          breakdown.veoGeneration += call.cost;
          break;
        case 'claude':
          breakdown.claudeCalls += call.cost;
          break;
        case 'gemini':
          breakdown.geminiCalls += call.cost;
          break;
      }
      breakdown.totalCost += call.cost;
    }

    return breakdown;
  }

  /**
   * Update monthly cost aggregate for a business
   * @param businessId Business identifier
   * @param cost Cost to add
   */
  private async updateMonthlyCost(
    businessId: string,
    cost: number,
  ): Promise<void> {
    const month = this.getCurrentYearMonth();

    const businessRef = this.firestore
      .getFirestore()
      .collection('businesses')
      .doc(businessId);

    try {
      // Use Firestore transaction to safely increment
      await this.firestore
        .getFirestore()
        .runTransaction(async (transaction) => {
          const businessDoc = await transaction.get(businessRef);

          if (!businessDoc.exists) {
            this.logger.warn(
              `Business ${businessId} not found, skipping monthly cost update`,
            );
            return;
          }

          const businessData = businessDoc.data() as
            | Record<string, any>
            | undefined;
          const monthlyCosts =
            (businessData?.monthlyCosts as Record<string, number>) || {};
          const currentMonthCost = monthlyCosts[month] || 0;

          transaction.update(businessRef, {
            [`monthlyCosts.${month}`]: currentMonthCost + cost,
          });
        });

      this.logger.debug(
        `Updated monthly cost for ${businessId}: +${cost.toFixed(4)}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update monthly cost for ${businessId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Don't throw - monthly cost is not critical
    }
  }

  /**
   * Get current year-month string
   * @returns Year-month string (e.g., "2026-04")
   */
  private getCurrentYearMonth(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
}
