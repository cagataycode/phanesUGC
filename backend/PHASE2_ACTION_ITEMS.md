# Phase 2: Critical Action Items

**Last Updated**: 2026-04-04  
**Status**: ⚠️ CRITICAL SECURITY FIXES REQUIRED

## Progress Summary
- ✅ All previous review fixes completed (test assertions, concurrent jobs query, quota timing, etc.)
- ❌ IDOR vulnerability still present
- ❌ Input validation not implemented
- ⚠️ Firestore security rules incomplete
- ❌ Audit logging not implemented

**See `PRODUCTION_READINESS_REVIEW.md` for comprehensive analysis**

---

## 🔴 BLOCKER: Do Not Deploy Without These Fixes

### 1. Fix IDOR Vulnerability (Severity: CRITICAL)
**File**: `backend/src/auth/business-ownership.guard.ts` (NEW)

Create authorization guard:
```typescript
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { FirestoreService } from '../firebase/firestore.service';

@Injectable()
export class BusinessOwnershipGuard implements CanActivate {
  constructor(private readonly firestore: FirestoreService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Extract businessId from params, query, or body
    const businessId = 
      request.params.businessId || 
      request.query.businessId || 
      request.body?.businessId;

    if (!businessId) {
      throw new ForbiddenException('Business ID required');
    }

    // Verify ownership
    const businessDoc = await this.firestore
      .collection('businesses')
      .doc(businessId)
      .get();

    if (!businessDoc.exists) {
      throw new ForbiddenException('Business not found');
    }

    const data = businessDoc.data();
    const isOwner = data.ownerId === user.uid;
    const isMember = data.members?.includes(user.uid);

    if (!isOwner && !isMember) {
      throw new ForbiddenException('Access denied to this business');
    }

    return true;
  }
}
```

**Apply to controller**:
```typescript
// backend/src/ads/ads.controller.ts
@Controller('ads')
@UseGuards(FirebaseAuthGuard, BusinessOwnershipGuard) // Add this
export class AdsController { ... }
```

---

### 2. Fix Race Condition in Quota Management (Severity: CRITICAL)
**File**: `backend/src/quota/quota.service.ts`

Replace `canCreateJob()` + `incrementUsage()` with atomic operation:

```typescript
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
    const result = await this.firestore.runTransaction(async (transaction) => {
      const usageDoc = await transaction.get(usageRef);
      const currentCount = usageDoc.exists 
        ? (usageDoc.data()?.videosCreated as number) || 0 
        : 0;

      // Check limit
      if (limits.monthlyVideos !== -1 && currentCount >= limits.monthlyVideos) {
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
    });

    if (!result.allowed) {
      const quota: QuotaUsage = {
        videosCreated: result.currentCount,
        videosRemaining: Math.max(0, limits.monthlyVideos - result.currentCount),
        resetDate: this.getNextMonthResetDate(),
        tier,
      };
      return { allowed: false, quota };
    }

    return { allowed: true };
  } catch (error) {
    this.logger.error(`Failed to increment quota: ${error}`);
    throw error;
  }
}
```

**Update controller**:
```typescript
// backend/src/ads/ads.controller.ts
@Post()
async createJob(@Body() createAdDto: CreateAdDto, @Res({ passthrough: true }) res: Response) {
  const businessId = createAdDto.businessId;
  
  // ... rate limit checks ...
  
  // Atomic quota check and increment
  const quotaResult = await this.quotaService.tryIncrementQuota(businessId);
  
  if (!quotaResult.allowed) {
    throw new HttpException({
      statusCode: HttpStatus.PAYMENT_REQUIRED,
      message: 'Monthly video quota exceeded',
      quota: quotaResult.quota,
    }, HttpStatus.PAYMENT_REQUIRED);
  }
  
  // Create the job
  const result = await this.adsService.createJob(createAdDto);
  
  // No need to increment usage separately anymore!
  
  return result;
}
```

---

### 3. Add Input Validation (Severity: CRITICAL)
**File**: `backend/src/ads/dto/create-ad.dto.ts`

```typescript
import { IsUUID, IsNotEmpty, IsString, MaxLength, IsEnum, IsOptional } from 'class-validator';

export class CreateAdDto {
  @IsUUID('4')
  @IsNotEmpty()
  businessId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  prompt: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  productName: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsEnum(['tiktok', 'instagram', 'youtube_shorts', 'facebook'])
  @IsNotEmpty()
  platform: string;

  @IsEnum(['9:16', '16:9', '1:1'])
  @IsNotEmpty()
  aspectRatio: string;

  // Add validation to all other fields
}
```

**Enable validation globally**:
```typescript
// backend/src/main.ts
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Add global validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // Strip unknown properties
    forbidNonWhitelisted: true, // Throw error on unknown properties
    transform: true, // Auto-transform payloads to DTO instances
    transformOptions: {
      enableImplicitConversion: false, // Explicit type conversion only
    },
  }));
  
  await app.listen(3000);
}
```

---

### 4. Deploy Firestore Security Rules (Severity: CRITICAL)
**File**: `backend/firestore.rules` (NEW)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isBusinessOwner(businessId) {
      return isAuthenticated() && 
        get(/databases/$(database)/documents/businesses/$(businessId)).data.ownerId == request.auth.uid;
    }
    
    function isBusinessMember(businessId) {
      return isAuthenticated() && 
        (get(/databases/$(database)/documents/businesses/$(businessId)).data.ownerId == request.auth.uid ||
         request.auth.uid in get(/databases/$(database)/documents/businesses/$(businessId)).data.members);
    }
    
    // Businesses
    match /businesses/{businessId} {
      allow read: if isBusinessMember(businessId);
      allow create: if isAuthenticated() && request.resource.data.ownerId == request.auth.uid;
      allow update: if isBusinessOwner(businessId);
      allow delete: if isBusinessOwner(businessId);
      
      // Usage subcollection - read-only for users
      match /usage/{month} {
        allow read: if isBusinessMember(businessId);
        allow write: if false; // Backend only
      }
      
      // Rate limits - backend only
      match /rate_limits/{doc} {
        allow read, write: if false;
      }
      
      // Agent jobs
      match /agent_jobs/{jobId} {
        allow read: if isBusinessMember(businessId);
        allow create: if isBusinessMember(businessId) && 
          request.resource.data.businessId == businessId;
        allow update, delete: if false; // Backend only
      }
    }
    
    // Audit logs - admin only
    match /audit_logs/{logId} {
      allow read, write: if false;
    }
    
    // System events - admin only
    match /system_events/{eventId} {
      allow read, write: if false;
    }
  }
}
```

**Deploy**:
```bash
firebase deploy --only firestore:rules
```

---

### 5. Add Rate Limiting to All Endpoints (Severity: HIGH)
**File**: `backend/src/ads/ads.controller.ts`

```typescript
// Apply rate limiting to read endpoints too
@Get()
async listJobs(
  @Query('businessId') businessId: string,
  @Res({ passthrough: true }) res: Response,
) {
  const tier = await this.quotaService.getSubscriptionTier(businessId);
  const rateLimitStatus = await this.rateLimiter.checkRateLimit(businessId, tier);
  
  // Add headers
  const config = this.rateLimiter.getRateLimitConfig(tier);
  res.setHeader('X-RateLimit-Limit', config.requestsPerMinute);
  res.setHeader('X-RateLimit-Remaining', rateLimitStatus.requestsRemaining);
  res.setHeader('X-RateLimit-Reset', rateLimitStatus.resetTime.toISOString());
  
  if (!rateLimitStatus.allowed) {
    res.setHeader('Retry-After', rateLimitStatus.retryAfter || 60);
    throw new HttpException(
      'Rate limit exceeded',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
  
  await this.rateLimiter.recordRequest(businessId);
  return this.adsService.listJobs(businessId);
}

// Repeat for all GET endpoints
```

**Better approach**: Create a rate limit interceptor:
```typescript
// backend/src/quota/interceptors/rate-limit.interceptor.ts
@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  constructor(
    private readonly quotaService: QuotaService,
    private readonly rateLimiter: RateLimiterService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    
    const businessId = request.params.businessId || request.query.businessId || request.body?.businessId;
    
    if (!businessId) {
      return next.handle();
    }
    
    const tier = await this.quotaService.getSubscriptionTier(businessId);
    const rateLimitStatus = await this.rateLimiter.checkRateLimit(businessId, tier);
    
    const config = this.rateLimiter.getRateLimitConfig(tier);
    response.setHeader('X-RateLimit-Limit', config.requestsPerMinute);
    response.setHeader('X-RateLimit-Remaining', rateLimitStatus.requestsRemaining);
    response.setHeader('X-RateLimit-Reset', rateLimitStatus.resetTime.toISOString());
    
    if (!rateLimitStatus.allowed) {
      response.setHeader('Retry-After', rateLimitStatus.retryAfter || 60);
      throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }
    
    await this.rateLimiter.recordRequest(businessId);
    
    return next.handle();
  }
}

// Apply to controller
@Controller('ads')
@UseInterceptors(RateLimitInterceptor)
export class AdsController { ... }
```

---

## 🟡 High Priority (Before Launch)

### 6. Add Audit Logging
**File**: `backend/src/monitoring/audit-logger.service.ts` (NEW)

```typescript
@Injectable()
export class AuditLoggerService {
  constructor(private readonly firestore: FirestoreService) {}

  async logQuotaExceeded(businessId: string, userId: string, tier: string, ip: string) {
    await this.firestore.collection('audit_logs').add({
      event: 'quota_exceeded',
      businessId,
      userId,
      tier,
      ip,
      timestamp: new Date(),
    });
  }

  async logCostTracked(businessId: string, jobId: string, cost: number, service: string) {
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
}
```

---

### 7. Add Cost Limits
**File**: `backend/src/quota/quota.service.ts`

```typescript
interface TierLimits {
  monthlyVideos: number;
  monthlyCostLimit: number; // Add this
  concurrentJobs: number;
  maxVideoDuration: number;
  prioritySupport: boolean;
}

private readonly tierLimits: Record<SubscriptionTier, TierLimits> = {
  [SubscriptionTier.FREE]: {
    monthlyVideos: 2,
    monthlyCostLimit: 5.00, // $5 max
    concurrentJobs: 1,
    maxVideoDuration: 5,
    prioritySupport: false,
  },
  [SubscriptionTier.STARTER]: {
    monthlyVideos: 20,
    monthlyCostLimit: 50.00, // $50 max
    concurrentJobs: 2,
    maxVideoDuration: 10,
    prioritySupport: false,
  },
  // ... etc
};

async checkCostLimit(businessId: string): Promise<boolean> {
  const tier = await this.getSubscriptionTier(businessId);
  const limits = this.getTierLimits(tier);
  
  if (limits.monthlyCostLimit === -1) return true;
  
  const currentCost = await this.costTracker.getBusinessMonthlyCost(businessId);
  return currentCost < limits.monthlyCostLimit;
}
```

---

## Testing Checklist

### Security Tests
- [ ] Test IDOR: User A cannot access User B's jobs
- [ ] Test race condition: 10 concurrent requests don't exceed quota
- [ ] Test input validation: Invalid UUIDs are rejected
- [ ] Test rate limiting: 11th request in 1 minute is blocked
- [ ] Test SQL injection: `businessId="'; DROP TABLE--"` is rejected

### Load Tests
- [ ] 100 concurrent job creations
- [ ] 1000 status polling requests per second
- [ ] Quota increment under high concurrency
- [ ] Rate limiter under high load

### Integration Tests
- [ ] Full flow: Create job → Track cost → Check quota → Increment usage
- [ ] Quota reset on month boundary
- [ ] Rate limit cleanup after 1 hour
- [ ] Firestore transaction conflicts

---

## Deployment Steps

1. **Deploy Firestore rules first**:
   ```bash
   firebase deploy --only firestore:rules
   ```

2. **Deploy code with security fixes**:
   ```bash
   npm run build
   npm run test
   gcloud app deploy
   ```

3. **Verify security**:
   - Test IDOR protection
   - Test rate limiting
   - Test input validation
   - Check audit logs

4. **Monitor for 24 hours**:
   - Watch error rates
   - Check quota accuracy
   - Verify no race conditions
   - Review audit logs

---

## Estimated Effort

- Critical fixes (1-5): 2-3 days
- High priority (6-7): 1-2 days
- Testing: 1-2 days
- **Total: 4-7 days**

## Next Steps

1. Review this document with team
2. Prioritize fixes based on risk
3. Create tickets for each action item
4. Implement fixes in order
5. Test thoroughly
6. Deploy to staging
7. Security audit
8. Deploy to production
