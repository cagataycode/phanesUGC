import { Injectable, Logger } from '@nestjs/common';
import { FirestoreService } from '../firebase/firestore.service';
import { StructuredLoggerService } from '../monitoring/structured-logger.service';
import { SubscriptionTier } from './quota.service';

export interface RateLimitConfig {
  requestsPerMinute: number;
  concurrentJobs: number;
}

export interface RateLimitStatus {
  allowed: boolean;
  requestsRemaining: number;
  resetTime: Date;
  retryAfter?: number; // seconds
}

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);

  // Rate limit configs per tier
  private readonly rateLimitConfigs: Record<SubscriptionTier, RateLimitConfig> =
    {
      [SubscriptionTier.FREE]: {
        requestsPerMinute: 10,
        concurrentJobs: 1,
      },
      [SubscriptionTier.STARTER]: {
        requestsPerMinute: 20,
        concurrentJobs: 2,
      },
      [SubscriptionTier.PRO]: {
        requestsPerMinute: 50,
        concurrentJobs: 5,
      },
      [SubscriptionTier.ENTERPRISE]: {
        requestsPerMinute: 100,
        concurrentJobs: 10,
      },
    };

  constructor(
    private readonly firestore: FirestoreService,
    private readonly structuredLogger: StructuredLoggerService,
  ) {}

  /**
   * Check if request is within rate limit
   */
  async checkRateLimit(
    businessId: string,
    tier: SubscriptionTier,
  ): Promise<RateLimitStatus> {
    const config = this.rateLimitConfigs[tier];
    const now = new Date();
    const windowStart = new Date(now.getTime() - 60000); // 1 minute ago

    try {
      const rateLimitRef = this.firestore
        .collection('businesses')
        .doc(businessId)
        .collection('rate_limits')
        .doc('current');

      const rateLimitDoc = await rateLimitRef.get();

      if (!rateLimitDoc.exists) {
        // First request, allow it
        return {
          allowed: true,
          requestsRemaining: config.requestsPerMinute - 1,
          resetTime: new Date(now.getTime() + 60000),
        };
      }

      const data = rateLimitDoc.data();

      const requests = (data?.requests || []) as Array<{
        timestamp: FirebaseFirestore.Timestamp;
      }>;

      // Filter requests within the current window
      const recentRequests = requests.filter((req) => {
        const reqTime = req.timestamp.toDate();
        return reqTime > windowStart;
      });

      const requestCount = recentRequests.length;

      if (requestCount >= config.requestsPerMinute) {
        // Rate limit exceeded
        const oldestRequest = recentRequests[0].timestamp.toDate();
        const resetTime = new Date(oldestRequest.getTime() + 60000);
        const retryAfter = Math.ceil(
          (resetTime.getTime() - now.getTime()) / 1000,
        );

        this.structuredLogger.log('Rate limit exceeded', {
          correlationId: 'rate-limit-check',
          businessId,
          tier,
          requestCount,
          limit: config.requestsPerMinute,
        });

        return {
          allowed: false,
          requestsRemaining: 0,
          resetTime,
          retryAfter,
        };
      }

      // Within rate limit - calculate reset time based on oldest request
      const resetTime =
        recentRequests.length > 0
          ? new Date(recentRequests[0].timestamp.toDate().getTime() + 60000)
          : new Date(now.getTime() + 60000);

      return {
        allowed: true,
        requestsRemaining: config.requestsPerMinute - requestCount - 1,
        resetTime,
      };
    } catch (error) {
      this.logger.error(
        `Failed to check rate limit: ${error instanceof Error ? error.message : String(error)}`,
      );
      // On error, allow the request (fail open)
      return {
        allowed: true,
        requestsRemaining: config.requestsPerMinute,
        resetTime: new Date(now.getTime() + 60000),
      };
    }
  }

  /**
   * Check if business has available concurrent job slots
   */
  async checkConcurrentJobs(
    businessId: string,
    tier: SubscriptionTier,
  ): Promise<boolean> {
    const config = this.rateLimitConfigs[tier];

    try {
      // Query for active agent jobs in the correct collection
      const activeJobsSnapshot = await this.firestore
        .getFirestore()
        .collection('businesses')
        .doc(businessId)
        .collection('agent_jobs')
        .where('status', 'in', ['pending', 'processing', 'phase2_started'])
        .get();

      const activeJobCount = activeJobsSnapshot.size;

      if (activeJobCount >= config.concurrentJobs) {
        this.structuredLogger.log('Concurrent job limit reached', {
          correlationId: 'concurrent-job-check',
          businessId,
          tier,
          activeJobCount,
          limit: config.concurrentJobs,
        });
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(
        `Failed to check concurrent jobs: ${error instanceof Error ? error.message : String(error)}`,
      );
      // On error, allow the request (fail open)
      return true;
    }
  }

  /**
   * Record a request for rate limiting
   */
  async recordRequest(businessId: string): Promise<void> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 60000); // 1 minute ago

    try {
      const rateLimitRef = this.firestore
        .collection('businesses')
        .doc(businessId)
        .collection('rate_limits')
        .doc('current');

      await this.firestore.runTransaction(async (transaction) => {
        const rateLimitDoc = await transaction.get(rateLimitRef);

        if (!rateLimitDoc.exists) {
          // Create new rate limit document
          transaction.set(rateLimitRef, {
            requests: [{ timestamp: now }],
            updatedAt: now,
          });
        } else {
          const data = rateLimitDoc.data();

          const requests = (data?.requests || []) as Array<{
            timestamp: FirebaseFirestore.Timestamp;
          }>;

          // Filter out old requests and add new one
          const recentRequests = requests
            .filter((req) => req.timestamp.toDate() > windowStart)
            .map((req) => ({ timestamp: req.timestamp }));

          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          recentRequests.push({ timestamp: now as any });

          transaction.update(rateLimitRef, {
            requests: recentRequests,
            updatedAt: now,
          });
        }
      });
    } catch (error) {
      this.logger.error(
        `Failed to record request: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Don't throw - this is non-critical
    }
  }

  /**
   * Clean up stale rate limit entries (called by scheduled function)
   */
  async cleanupStaleEntries(): Promise<void> {
    this.logger.log('Starting rate limit cleanup');

    try {
      const cutoffTime = new Date(Date.now() - 3600000); // 1 hour ago

      // Query for stale rate limit documents

      const staleDocsSnapshot = await this.firestore
        .getFirestore()
        .collectionGroup('rate_limits')

        .where('updatedAt', '<', cutoffTime)

        .get();

      const batch = this.firestore.getFirestore().batch();
      let deleteCount = 0;

      staleDocsSnapshot.forEach((doc: any) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
        batch.delete(doc.ref);
        deleteCount++;
      });

      if (deleteCount > 0) {
        await batch.commit();
        this.logger.log(`Cleaned up ${deleteCount} stale rate limit entries`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to cleanup stale entries: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Get rate limit config for a tier
   */
  getRateLimitConfig(tier: SubscriptionTier): RateLimitConfig {
    return this.rateLimitConfigs[tier];
  }
}
