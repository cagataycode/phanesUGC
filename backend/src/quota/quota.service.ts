import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { FirestoreService } from '../firebase/firestore.service';
import { StructuredLoggerService } from '../monitoring/structured-logger.service';
import { CostTrackerService } from '../cost/cost-tracker.service';

export enum SubscriptionTier {
  FREE = 'free',
  STARTER = 'starter',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

export interface TierLimits {
  monthlyVideos: number;
  monthlyCostLimit: number; // USD
  concurrentJobs: number;
  maxVideoDuration: number; // seconds
  prioritySupport: boolean;
}

export interface QuotaUsage {
  videosCreated: number;
  videosRemaining: number;
  resetDate: Date;
  tier: SubscriptionTier;
}

@Injectable()
export class QuotaService {
  private readonly logger = new Logger(QuotaService.name);

  // Subscription tier limits
  private readonly tierLimits: Record<SubscriptionTier, TierLimits> = {
    [SubscriptionTier.FREE]: {
      monthlyVideos: 2,
      monthlyCostLimit: 5.0, // $5 max
      concurrentJobs: 1,
      maxVideoDuration: 5,
      prioritySupport: false,
    },
    [SubscriptionTier.STARTER]: {
      monthlyVideos: 20,
      monthlyCostLimit: 50.0, // $50 max
      concurrentJobs: 2,
      maxVideoDuration: 10,
      prioritySupport: false,
    },
    [SubscriptionTier.PRO]: {
      monthlyVideos: 40,
      monthlyCostLimit: 200.0, // $200 max
      concurrentJobs: 5,
      maxVideoDuration: 10,
      prioritySupport: true,
    },
    [SubscriptionTier.ENTERPRISE]: {
      monthlyVideos: -1, // Unlimited
      monthlyCostLimit: -1, // Unlimited
      concurrentJobs: 10,
      maxVideoDuration: 10,
      prioritySupport: true,
    },
  };

  constructor(
    private readonly firestore: FirestoreService,
    private readonly structuredLogger: StructuredLoggerService,
    @Inject(forwardRef(() => CostTrackerService))
    private readonly costTracker: CostTrackerService,
  ) {}

  /**
   * Get subscription tier for a business
   */
  async getSubscriptionTier(businessId: string): Promise<SubscriptionTier> {
    try {
      const businessDoc = await this.firestore
        .collection('businesses')
        .doc(businessId)
        .get();

      if (!businessDoc.exists) {
        this.logger.warn(
          `Business ${businessId} not found, defaulting to FREE`,
        );
        return SubscriptionTier.FREE;
      }

      const data = businessDoc.data() as
        | { subscription?: { tier?: string } }
        | undefined;
      const tierValue = data?.subscription?.tier;

      // Validate tier value
      const validTiers = Object.values(SubscriptionTier);
      if (tierValue && validTiers.includes(tierValue as SubscriptionTier)) {
        return tierValue as SubscriptionTier;
      }

      this.logger.warn(
        `Invalid tier "${tierValue}" for business ${businessId}, defaulting to FREE`,
      );
      return SubscriptionTier.FREE;
    } catch (error) {
      this.logger.error(
        `Failed to get subscription tier: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Default to FREE on error
      return SubscriptionTier.FREE;
    }
  }

  /**
   * Get tier limits for a subscription tier
   */
  getTierLimits(tier: SubscriptionTier): TierLimits {
    return this.tierLimits[tier];
  }

  /**
   * Check if business has quota available
   * @param businessId - Business ID
   * @param tier - Optional pre-fetched tier to avoid redundant Firestore reads
   */
  async checkQuota(
    businessId: string,
    tier?: SubscriptionTier,
  ): Promise<QuotaUsage> {
    const subscriptionTier =
      tier || (await this.getSubscriptionTier(businessId));
    const limits = this.getTierLimits(subscriptionTier);

    // Get current usage from Firestore
    const usageDoc = await this.firestore
      .collection('businesses')
      .doc(businessId)
      .collection('usage')
      .doc(this.getCurrentMonthKey())
      .get();

    const videosCreated: number = usageDoc.exists
      ? (usageDoc.data()?.videosCreated as number) || 0
      : 0;

    const videosRemaining =
      limits.monthlyVideos === -1
        ? -1 // unlimited
        : Math.max(0, limits.monthlyVideos - videosCreated);

    const resetDate = this.getNextMonthResetDate();

    return {
      videosCreated,
      videosRemaining,
      resetDate,
      tier: subscriptionTier,
    };
  }

  /**
   * Check if business can create a new job
   */
  async canCreateJob(businessId: string): Promise<boolean> {
    const quota = await this.checkQuota(businessId);

    // Unlimited quota
    if (quota.videosRemaining === -1) {
      return true;
    }

    // Check if quota available
    return quota.videosRemaining > 0;
  }

  /**
   * Atomically check and increment quota
   * Returns true if job can be created, false if quota exceeded
   */
  async tryIncrementQuota(businessId: string): Promise<{
    allowed: boolean;
    quota?: QuotaUsage;
  }> {
    const tier = await this.getSubscriptionTier(businessId);
    const limits = this.getTierLimits(tier);
    const monthKey = this.getCurrentMonthKey();

    const usageRef = this.firestore
      .collection('businesses')
      .doc(businessId)
      .collection('usage')
      .doc(monthKey);

    try {
      const result = await this.firestore.runTransaction(
        async (transaction) => {
          const usageDoc = await transaction.get(usageRef);
          const currentCount = usageDoc.exists
            ? (usageDoc.data()?.videosCreated as number) || 0
            : 0;

          // Check limit
          if (
            limits.monthlyVideos !== -1 &&
            currentCount >= limits.monthlyVideos
          ) {
            return { allowed: false, currentCount };
          }

          // Atomically increment
          if (!usageDoc.exists) {
            transaction.set(usageRef, {
              videosCreated: 1,
              month: monthKey,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          } else {
            transaction.update(usageRef, {
              videosCreated: currentCount + 1,
              updatedAt: new Date(),
            });
          }

          return { allowed: true, currentCount: currentCount + 1 };
        },
      );

      if (!result.allowed) {
        const quota: QuotaUsage = {
          videosCreated: result.currentCount,
          videosRemaining: Math.max(
            0,
            limits.monthlyVideos - result.currentCount,
          ),
          resetDate: this.getNextMonthResetDate(),
          tier,
        };
        return { allowed: false, quota };
      }

      this.structuredLogger.log('Quota usage incremented', {
        correlationId: 'quota-increment',
        businessId,
        month: monthKey,
      });

      return { allowed: true };
    } catch (error) {
      this.logger.error(
        `Failed to increment quota: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Decrement quota (rollback) when job creation fails after quota was incremented
   */
  async decrementQuota(businessId: string): Promise<void> {
    const monthKey = this.getCurrentMonthKey();

    const usageRef = this.firestore
      .collection('businesses')
      .doc(businessId)
      .collection('usage')
      .doc(monthKey);

    try {
      await this.firestore.runTransaction(async (transaction) => {
        const usageDoc = await transaction.get(usageRef);
        if (usageDoc.exists) {
          const currentCount = (usageDoc.data()?.videosCreated as number) || 0;
          if (currentCount > 0) {
            transaction.update(usageRef, {
              videosCreated: currentCount - 1,
              updatedAt: new Date(),
            });
          }
        }
      });

      this.structuredLogger.log('Quota usage decremented (rollback)', {
        correlationId: 'quota-decrement',
        businessId,
        month: monthKey,
      });
    } catch (error) {
      this.logger.error(
        `Failed to decrement quota: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Increment usage counter for a business
   * @deprecated Use tryIncrementQuota() instead for atomic check-and-increment
   */
  async incrementUsage(businessId: string): Promise<void> {
    const monthKey = this.getCurrentMonthKey();
    const usageRef = this.firestore
      .collection('businesses')
      .doc(businessId)
      .collection('usage')
      .doc(monthKey);

    try {
      await this.firestore.runTransaction(async (transaction) => {
        const usageDoc = await transaction.get(usageRef);

        if (!usageDoc.exists) {
          // Create new usage document
          transaction.set(usageRef, {
            videosCreated: 1,
            month: monthKey,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        } else {
          // Increment existing counter
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const currentCount = usageDoc.data()?.videosCreated || 0;

          transaction.update(usageRef, {
            videosCreated: currentCount + 1,
            updatedAt: new Date(),
          });
        }
      });

      this.structuredLogger.log('Quota usage incremented', {
        correlationId: 'quota-increment',
        businessId,
        month: monthKey,
      });
    } catch (error) {
      this.logger.error(
        `Failed to increment usage: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Reset monthly quotas for all businesses (called by scheduled function)
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async resetMonthlyQuotas(): Promise<void> {
    this.logger.log('Starting monthly quota reset');

    try {
      // This would typically be called by a Cloud Function
      // For now, we just log the action
      // The actual reset happens automatically by using month-based keys
      this.logger.log('Monthly quota reset completed');
    } catch (error) {
      this.logger.error(
        `Failed to reset monthly quotas: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Check if business is within monthly cost limit
   */
  async checkCostLimit(businessId: string): Promise<boolean> {
    const tier = await this.getSubscriptionTier(businessId);
    const limits = this.getTierLimits(tier);

    // Unlimited cost
    if (limits.monthlyCostLimit === -1) {
      return true;
    }

    try {
      const currentCost =
        await this.costTracker.getBusinessMonthlyCost(businessId);
      return currentCost < limits.monthlyCostLimit;
    } catch (error) {
      this.logger.error(
        `Failed to check cost limit: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Default to allowing on error to avoid blocking users
      return true;
    }
  }

  /**
   * Get current month key (YYYY-MM format)
   */
  private getCurrentMonthKey(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Get next month reset date
   */
  private getNextMonthResetDate(): Date {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth;
  }
}
