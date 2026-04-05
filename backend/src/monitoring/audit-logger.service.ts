import { Injectable } from '@nestjs/common';
import { FirestoreService } from '../firebase/firestore.service';

@Injectable()
export class AuditLoggerService {
  constructor(private readonly firestore: FirestoreService) {}

  async logQuotaExceeded(
    businessId: string,
    userId: string,
    tier: string,
    ip: string,
  ) {
    await this.firestore.collection('audit_logs').add({
      event: 'quota_exceeded',
      businessId,
      userId,
      tier,
      ip,
      timestamp: new Date(),
    });
  }

  async logCostTracked(
    businessId: string,
    jobId: string,
    cost: number,
    service: string,
  ) {
    await this.firestore.collection('audit_logs').add({
      event: 'cost_tracked',
      businessId,
      jobId,
      cost,
      service,
      timestamp: new Date(),
    });
  }

  async logUnauthorizedAccess(businessId: string, userId: string, ip: string) {
    await this.firestore.collection('audit_logs').add({
      event: 'unauthorized_access_attempt',
      businessId,
      userId,
      ip,
      timestamp: new Date(),
      severity: 'high',
    });
  }

  async logJobCreated(
    businessId: string,
    userId: string,
    jobId: string,
    ip: string,
  ) {
    await this.firestore.collection('audit_logs').add({
      event: 'job_created',
      businessId,
      userId,
      jobId,
      ip,
      timestamp: new Date(),
    });
  }

  async logRateLimitExceeded(
    businessId: string,
    userId: string,
    tier: string,
    ip: string,
  ) {
    await this.firestore.collection('audit_logs').add({
      event: 'rate_limit_exceeded',
      businessId,
      userId,
      tier,
      ip,
      timestamp: new Date(),
    });
  }
}
