import { Injectable, Logger } from '@nestjs/common';
import { FirestoreService } from '../firebase/firestore.service';
import { StructuredLoggerService } from '../monitoring/structured-logger.service';

export enum SubscriptionTier {
  FREE = 'free',
  STARTER = 'starter',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

export interface TierLimits {
  monthlyVideos: number;
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
      concurrentJobs: 1,
      maxVideoDuration: 5,
      prioritySupport: false,
    },
    [SubscriptionTier.STARTER]: {
      monthlyVideos: 20,
      concurrentJobs: 2,
      maxVideoDuration: 10,
      prioritySupport: false,
    },
    [SubscriptionTier.PRO]: {
      monthlyVideos: 40,
      concurrentJobs: 5,
      maxVideoDuration: 10,
      prioritySupport: true,
    },
    [SubscriptionTier.ENTERPRISE]: {
      monthlyVideos: -1, // unlimited
      concurrentJobs: 10,
      maxVideoDuration: 10,
      prioritySupport: true,
    },
  };

  constructor(
    private readonly firestore: FirestoreService,
    private readonly structuredLogger: StructuredLoggerService,
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

      const data = businessDoc.data();
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
   */
  async checkQuota(businessId: string): Promise<QuotaUsage> {
    const tier = await this.getSubscriptionTier(businessId);
    const limits = this.getTierLimits(tier);

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
      tier,
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
   * Increment usage counter for a business
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
