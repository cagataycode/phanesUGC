# Code Review Issues to Address

## Critical (Production Impact)

### 1. ✅ FIXED - Rate Limiter Timestamp Type Mismatch
**File**: `backend/src/quota/rate-limiter.service.ts`
**Issue**: `recordRequest()` stores `Date` objects but `checkRateLimit()` expects `FirebaseFirestore.Timestamp`
**Impact**: Rate limiter will fail at runtime after first request
**Fix**: Now using `Timestamp.fromDate()` consistently
**Commit**: 1a5d232

### 2. Quota Increment Before Job Creation
**File**: `backend/src/ads/ads.controller.ts`
**Issue**: Quota is incremented before `adsService.createJob()`. If job creation fails, quota is consumed with no rollback
**Impact**: Users lose quota on failed job creations
**Fix**: Either:
- Move increment after successful job creation
- Add compensating decrement on failure
- Use a "pending" state that's finalized after init

### 3. Firestore Rules Membership Mismatch
**File**: `backend/firestore.rules`
**Issue**: Rules check `businesses/{id}.members` array, but backend uses `businesses/{id}/members/{uid}` subcollection
**Impact**: Rules won't reflect actual membership, causing auth failures
**Fix**: Update rules to check subcollection:
```javascript
function isBusinessMember(businessId) {
  return isAuthenticated() && 
    (get(/databases/$(database)/documents/businesses/$(businessId)).data.ownerId == request.auth.uid ||
     exists(/databases/$(database)/documents/businesses/$(businessId)/members/$(request.auth.uid)));
}
```

### 4. Concurrent Jobs Query Wrong Collection
**File**: `backend/src/quota/rate-limiter.service.ts`
**Issue**: `checkConcurrentJobs()` queries `agent_jobs` with `status` field, but those docs use `stage` + `videoGenerationStatus`
**Impact**: Concurrent job limit is never enforced (always returns 0)
**Fix**: Update query to match actual schema or query the correct collection

## High Priority (Test Failures)

### 5. E2E Tests Missing Auth Mocking
**Files**: `backend/test/security.e2e-spec.ts`, `load.e2e-spec.ts`, `integration.e2e-spec.ts`
**Issue**: Tests don't mock `firebase-admin` token verification
**Impact**: All e2e tests fail with 401 before reaching controller logic
**Fix**: Add at top of each file:
```typescript
jest.mock('firebase-admin', () => ({
  auth: () => ({
    verifyIdToken: jest.fn().mockResolvedValue({ uid: 'test-uid' }),
  }),
}));
```

### 6. E2E Tests Using Old DTO Format
**Files**: All three e2e test files
**Issue**: Tests send `{ businessId, prompt, productName, platform, aspectRatio }` but API expects `CreateAdDto` with `productId`, `createdBy`, `prompt_inputs`, `veo_config`
**Impact**: All POST /ads tests fail with 400
**Fix**: Update test payloads to match current DTO:
```typescript
{
  businessId: 'uuid',
  productId: 'uuid',
  createdBy: 'test-user',
  prompt_inputs: {
    prompt: 'Test',
    platform: 'tiktok',
    language: 'en',
  },
  veo_config: {
    aspect_ratio: '9:16',
    duration_sec: 5,
  }
}
```

### 7. Rate Limit Mock Schema Mismatch
**Files**: All three e2e test files
**Issue**: Mocks use `{ requests: 10, windowStart: Date }` but service expects `{ requests: Array<{timestamp}>, updatedAt }`
**Impact**: Tests throw errors when rate limiter runs
**Fix**: Update mocks to match service schema

### 8. Missing /quota Endpoint
**File**: `backend/test/integration.e2e-spec.ts`
**Issue**: Test calls `GET /quota` but no such endpoint exists
**Impact**: Test fails with 404
**Fix**: Either create endpoint or test quota via existing endpoints

## Medium Priority (Documentation)

### 9. Deployment Guide References Non-Existent Endpoints
**File**: `docs/DEPLOYMENT_GUIDE.md`
**Issue**: References `/health`, `/ready`, `/api/v1/health` endpoints that don't exist
**Fix**: Update docs to use actual endpoints or create health check endpoints

### 10. Deployment Guide Wrong Test Commands
**File**: `docs/DEPLOYMENT_GUIDE.md`
**Issue**: `npm test -- security.e2e-spec.ts` won't run e2e tests (wrong config)
**Fix**: Use `npm run test:e2e` with proper patterns

### 11. Duplicate Guard on ProductsController
**File**: `backend/src/products/products.controller.ts`
**Issue**: Both `BusinessOwnershipGuard` and `RolesGuard` check membership (duplicate Firestore read)
**Impact**: Extra latency and Firestore reads
**Fix**: Remove one guard or refactor to single membership check

## Summary

**Must fix before deployment:**
1. Rate limiter timestamp type
2. Quota rollback on job creation failure
3. Firestore rules membership check
4. Concurrent jobs query

**Must fix for tests to pass:**
5-8. All e2e test issues

**Can fix later:**
9-11. Documentation and optimization issues
