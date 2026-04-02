# Agent Error Handling Guide

**Date:** 2026-04-02  
**Version:** 1.0  
**Related Documents:** `AGENT_INTEGRATION_PLAN.md`, `AGENT_UTILITIES.md`

---

## Overview

The agent module implements comprehensive error recovery through two complementary policies:

1. **RetryPolicy** - Automatic retry with exponential backoff for transient failures
2. **FallbackPolicy** - Graceful degradation when retries are exhausted

These policies are located in `backend/src/agent/policies/` and are integrated into the orchestrator for all pipeline stages.

---

## Retry Policy

**Purpose:** Automatically retry failed operations with exponential backoff to handle transient errors.

**Location:** `backend/src/agent/policies/retry-policy.ts`

### Configuration

```typescript
interface RetryConfig {
  maxRetries: number;              // Maximum retry attempts (default: 2)
  initialDelayMs: number;          // Initial delay before first retry (default: 1000ms)
  backoffMultiplier: number;       // Delay multiplier for each retry (default: 2)
  retryableErrors: string[];       // Error patterns that trigger retry
}
```

### Default Configuration

```typescript
const defaultConfig: RetryConfig = {
  maxRetries: 2,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
  retryableErrors: [
    'timeout',
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNREFUSED',
    'rate limit',
    'too many requests',
    '429',
    '503',
    '504',
  ],
};
```

### Retry Timing

| Attempt | Delay Before Retry | Total Time Elapsed |
| ------- | ------------------ | ------------------ |
| 1       | 0ms (immediate)    | 0ms                |
| 2       | 1000ms (1s)        | 1s                 |
| 3       | 2000ms (2s)        | 3s                 |

Formula: `delay = initialDelay * (backoffMultiplier ^ (attemptNumber - 1))`

### Retryable vs Non-Retryable Errors

#### Retryable Errors (Will Retry)

- Network timeouts (`ETIMEDOUT`, `ECONNRESET`)
- Rate limiting (`429 Too Many Requests`)
- Service unavailable (`503 Service Unavailable`)
- Gateway timeout (`504 Gateway Timeout`)
- Temporary API errors
- Connection refused (`ECONNREFUSED`)

#### Non-Retryable Errors (Fail Immediately)

- Validation errors (`400 Bad Request`)
- Authentication errors (`401 Unauthorized`, `403 Forbidden`)
- Not found errors (`404 Not Found`)
- Invalid input errors
- Business logic errors
- Permanent API errors

### Usage

```typescript
import { RetryPolicy } from '../policies';

@Injectable()
export class MyService {
  constructor(private readonly retryPolicy: RetryPolicy) {}
  
  async processWithRetry(jobId: string) {
    return this.retryPolicy.execute(
      () => this.doSomething(),
      { jobId, stage: 'my_stage' }
    );
  }
  
  private async doSomething() {
    // Your logic here
    // Will be retried automatically on transient failures
  }
}
```

### Example: Orchestrator Integration

```typescript
// Stage with retry
const productContext = await this.retryPolicy.execute(
  () => this.contextAcquisition.acquire(normalizedRequest),
  { jobId, stage: 'context_acquisition' }
);
```

### Logging

The retry policy logs each attempt:

```
[RetryPolicy] Attempt 1 failed for job-123 at stage context_acquisition: ETIMEDOUT
[RetryPolicy] Retrying in 1000ms (attempt 2/2)
[RetryPolicy] Attempt 2 failed for job-123 at stage context_acquisition: ETIMEDOUT
[RetryPolicy] Retrying in 2000ms (attempt 3/2)
[RetryPolicy] All retry attempts exhausted for job-123 at stage context_acquisition
```

---

## Fallback Policy

**Purpose:** Provide graceful degradation when operations fail after all retries are exhausted.

**Location:** `backend/src/agent/policies/fallback-policy.ts`

### Configuration

```typescript
interface FallbackConfig {
  enableFallbacks: boolean;  // Enable/disable fallback behavior (default: true)
  logFallbacks: boolean;     // Log fallback activations (default: true)
}
```

### Fallback Strategies by Stage

| Stage                  | Fallback Strategy                                      | Confidence |
| ---------------------- | ------------------------------------------------------ | ---------- |
| Context Acquisition    | Use manual product inputs only (skip scraping)         | 0.3        |
| Brief Generation       | Use template brief with defaults                       | 0.5        |
| Scenario Generation    | Generate 4 default scenarios                           | 0.4        |
| Video Generation       | No fallback - mark job as failed (critical stage)      | N/A        |

### Fallback Details

#### 1. Scraping Failure Fallback

When URL scraping fails, use only the manual product inputs provided by the user.

```typescript
handleScrapingFailure(
  request: NormalizedRequest,
  error: unknown
): ProductContext {
  return {
    jobId: request.jobId,
    name: request.product.name || 'Unknown Product',
    description: request.product.description || '',
    benefits: request.product.benefits || [],
    category: 'general',
    pricing: '',
    offers: '',
    source: 'manual',
    confidence: 0.3,  // Low confidence - manual only
    scrapedAt: new Date(),
  };
}
```

**Impact:** Lower quality brief due to missing scraped data, but pipeline continues.

#### 2. Brief Generation Failure Fallback

When LLM brief generation fails, use a template brief with defaults.

```typescript
async handleBriefFailure(
  request: NormalizedRequest,
  productContext: ProductContext,
  error: unknown
): Promise<CreativeBrief> {
  return {
    jobId: request.jobId,
    productName: productContext.name,
    keyBenefits: productContext.benefits.slice(0, 3),
    targetPlatform: request.platform,
    targetDuration: request.durationSec,
    targetAspectRatio: request.aspectRatio,
    targetAudience: request.targetAudience || 'general audience',
    tone: request.tone || 'professional',
    cta: request.cta || 'Learn more',
    visualStyle: 'clean and modern',
    confidence: 0.5,  // Medium confidence - template
  };
}
```

**Impact:** Generic brief, less personalized scenarios, but pipeline continues.

#### 3. Scenario Generation Failure Fallback

When LLM scenario generation fails, generate 4 default scenarios.

```typescript
async handleScenarioFailure(
  jobId: string,
  brief: CreativeBrief,
  error: unknown
): Promise<ScenarioSet> {
  return {
    jobId,
    scenarios: [
      {
        scenarioId: 1,
        title: 'Problem/Solution',
        hook: `Struggling with ${brief.productName}?`,
        angle: 'problem-solution',
        tone: 'helpful',
        visualDirection: 'Show problem, then solution',
        ctaText: brief.cta,
        summary: 'Address a common problem and present the product as the solution',
      },
      // ... 3 more default scenarios
    ],
    generatedAt: new Date(),
    confidence: 0.4,  // Low confidence - defaults
  };
}
```

**Impact:** Generic scenarios, less creative variety, but user can still select and continue.

#### 4. Video Generation Failure (No Fallback)

Video generation is a critical stage with no fallback. If Veo fails after retries, the job is marked as failed.

```typescript
handleVideoFailure(error: unknown): never {
  throw new Error('Video generation failed - no fallback available');
}
```

**Impact:** Job fails, user is notified, no output produced.

### Usage

```typescript
import { FallbackPolicy } from '../policies';

@Injectable()
export class MyService {
  constructor(private readonly fallbackPolicy: FallbackPolicy) {}
  
  async processWithFallback(request: NormalizedRequest) {
    try {
      return await this.doSomething(request);
    } catch (error) {
      // Use fallback
      return this.fallbackPolicy.handleScrapingFailure(request, error);
    }
  }
}
```

### Example: Orchestrator Integration

```typescript
// Stage with retry + fallback
let productContext: ProductContext;
try {
  productContext = await this.retryPolicy.execute(
    () => this.contextAcquisition.acquire(normalizedRequest),
    { jobId, stage: 'context_acquisition' }
  );
} catch (error) {
  // Fallback: Use manual inputs if scraping fails
  productContext = this.fallbackPolicy.handleScrapingFailure(
    normalizedRequest,
    error
  );
}
```

### Logging

The fallback policy logs each activation:

```
[FallbackPolicy] Scraping failed for job-123, using manual inputs only
[FallbackPolicy] Brief generation failed for job-123, using template brief
[FallbackPolicy] Scenario generation failed for job-123, using default scenarios
```

---

## Error Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Stage Execution                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     v
              ┌──────────────┐
              │   Attempt 1   │
              └──────┬───────┘
                     │
              ┌──────v───────┐
              │   Success?   │
              └──────┬───────┘
                     │
         ┌───────────┴───────────┐
         │                       │
        Yes                     No
         │                       │
         v                       v
    ┌─────────┐         ┌──────────────┐
    │ Return  │         │  Retryable?  │
    │ Result  │         └──────┬───────┘
    └─────────┘                │
                    ┌──────────┴──────────┐
                    │                     │
                   Yes                   No
                    │                     │
                    v                     v
           ┌─────────────────┐    ┌──────────────┐
           │  Wait + Retry   │    │ Fallback     │
           │  (max 2 times)  │    │ Available?   │
           └────────┬────────┘    └──────┬───────┘
                    │                     │
                    │              ┌──────┴──────┐
                    │              │             │
                    │             Yes           No
                    │              │             │
                    │              v             v
                    │      ┌──────────────┐  ┌────────┐
                    │      │   Execute    │  │  Fail  │
                    │      │   Fallback   │  │  Job   │
                    │      └──────┬───────┘  └────────┘
                    │             │
                    └─────────────┴─────────────┐
                                                │
                                                v
                                        ┌───────────────┐
                                        │   Continue    │
                                        │   Pipeline    │
                                        └───────────────┘
```

---

## Stage-Specific Error Handling

### Phase 1 Stages

| Stage               | Retry? | Fallback?           | Failure Impact                    |
| ------------------- | ------ | ------------------- | --------------------------------- |
| Input Normalizer    | No     | No                  | Job fails immediately             |
| Context Acquisition | Yes    | Yes (manual only)   | Lower quality brief               |
| Brief Builder       | Yes    | Yes (template)      | Generic scenarios                 |
| Scenario Generator  | Yes    | Yes (defaults)      | Less creative variety             |

### Phase 2 Stages

| Stage               | Retry? | Fallback?           | Failure Impact                    |
| ------------------- | ------ | ------------------- | --------------------------------- |
| Script Generator    | Yes    | No                  | Job fails                         |
| Veo Prompt Builder  | Yes    | No                  | Job fails                         |
| Video Generator     | Yes    | No                  | Job fails (critical)              |
| Subtitle Generator  | Yes    | No                  | Job fails                         |
| Timeline Assembler  | Yes    | No                  | Job fails                         |
| Render Executor     | Yes    | No                  | Job fails                         |
| Output Validator    | No     | No                  | Warnings only (soft validation)   |

---

## Error Recording

All errors are recorded in the job state for inspection:

```typescript
interface AgentJobState {
  errors: Array<{
    stage: AgentStage;
    message: string;
    timestamp: Date;
    retryCount: number;
  }>;
}
```

### Example Error Record

```json
{
  "stage": "context_acquisition",
  "message": "ETIMEDOUT: Connection timeout after 30s",
  "timestamp": "2026-04-02T10:30:45.123Z",
  "retryCount": 2
}
```

---

## Best Practices

### 1. Always Use Retry for External Calls

```typescript
// ✅ Good - wrapped in retry
const result = await this.retryPolicy.execute(
  () => this.externalService.call(),
  { jobId, stage: 'my_stage' }
);

// ❌ Bad - no retry
const result = await this.externalService.call();
```

### 2. Provide Fallback for Non-Critical Stages

```typescript
// ✅ Good - has fallback
try {
  return await this.retryPolicy.execute(
    () => this.scrape(url),
    { jobId, stage: 'scraping' }
  );
} catch (error) {
  return this.fallbackPolicy.handleScrapingFailure(request, error);
}

// ❌ Bad - no fallback for non-critical stage
return await this.retryPolicy.execute(
  () => this.scrape(url),
  { jobId, stage: 'scraping' }
);
```

### 3. No Fallback for Critical Stages

```typescript
// ✅ Good - no fallback for critical stage
const video = await this.retryPolicy.execute(
  () => this.videoGenerator.generate(prompt),
  { jobId, stage: 'video_generation' }
);
// If this fails, job should fail

// ❌ Bad - fallback for critical stage
try {
  return await this.videoGenerator.generate(prompt);
} catch (error) {
  return this.generatePlaceholderVideo(); // Don't do this!
}
```

### 4. Log Fallback Activations

```typescript
// ✅ Good - logs fallback
catch (error) {
  this.logger.warn(`Scraping failed for ${jobId}, using manual inputs`);
  return this.fallbackPolicy.handleScrapingFailure(request, error);
}

// ❌ Bad - silent fallback
catch (error) {
  return this.fallbackPolicy.handleScrapingFailure(request, error);
}
```

### 5. Include Context in Retry Calls

```typescript
// ✅ Good - includes context
await this.retryPolicy.execute(
  () => this.process(),
  { jobId: 'job-123', stage: 'my_stage' }
);

// ❌ Bad - missing context
await this.retryPolicy.execute(
  () => this.process(),
  { jobId: '', stage: '' }
);
```

---

## Testing Error Handling

### Testing Retry Logic

```typescript
describe('RetryPolicy', () => {
  it('should retry on transient errors', async () => {
    let attempts = 0;
    const fn = jest.fn().mockImplementation(() => {
      attempts++;
      if (attempts < 3) {
        throw new Error('ETIMEDOUT');
      }
      return 'success';
    });
    
    const result = await retryPolicy.execute(fn, { jobId: 'test', stage: 'test' });
    
    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });
});
```

### Testing Fallback Logic

```typescript
describe('FallbackPolicy', () => {
  it('should provide fallback for scraping failure', () => {
    const request: NormalizedRequest = {
      jobId: 'test',
      product: { name: 'Test Product' },
      // ...
    };
    
    const result = fallbackPolicy.handleScrapingFailure(
      request,
      new Error('Scraping failed')
    );
    
    expect(result.source).toBe('manual');
    expect(result.confidence).toBe(0.3);
  });
});
```

---

## Monitoring and Debugging

### Key Metrics to Monitor

1. **Retry Rate** - Percentage of stages that require retries
2. **Fallback Rate** - Percentage of stages that use fallbacks
3. **Failure Rate** - Percentage of jobs that fail completely
4. **Retry Success Rate** - Percentage of retries that succeed

### Debug Logging

Enable debug logging to see detailed error handling:

```typescript
// In orchestrator
this.logger.debug(`[${jobId}] Retry attempt ${attemptNumber} for ${stage}`);
this.logger.debug(`[${jobId}] Fallback activated for ${stage}`);
```

### Inspecting Job State

```typescript
// Get job state to see errors
const state = await orchestrator.getJobState(jobId, businessId);

// Check errors
console.log('Errors:', state.errors);

// Check if fallbacks were used
const usedFallback = state.artifacts.productContext?.confidence < 0.5;
```

---

## Troubleshooting

### Issue: Too many retries

**Symptom:** Stages taking too long due to excessive retries

**Solution:** Check if errors are truly transient. Non-retryable errors should fail immediately.

```typescript
// Add error to non-retryable list
const config: RetryConfig = {
  ...defaultConfig,
  retryableErrors: defaultConfig.retryableErrors.filter(
    e => e !== 'your_error_pattern'
  ),
};
```

### Issue: Fallback quality too low

**Symptom:** Generated content is generic when fallbacks are used

**Solution:** Improve fallback strategies or fail the job instead.

```typescript
// Option 1: Improve fallback
handleBriefFailure() {
  // Use more sophisticated template
}

// Option 2: Remove fallback (fail instead)
const brief = await this.retryPolicy.execute(
  () => this.briefBuilder.build(request, context),
  { jobId, stage: 'brief_builder' }
);
// No try/catch - let it fail
```

### Issue: Jobs failing too often

**Symptom:** High failure rate even with retries

**Solution:** Investigate root cause of failures, increase retry count, or add fallbacks.

```typescript
// Increase retry count
const config: RetryConfig = {
  ...defaultConfig,
  maxRetries: 3,  // Increased from 2
};
```

---

## See Also

- `backend/src/agent/policies/retry-policy.ts` - Retry implementation
- `backend/src/agent/policies/fallback-policy.ts` - Fallback implementation
- `docs/AGENT_UTILITIES.md` - Shared utilities guide
- `docs/AGENT_INTEGRATION_PLAN.md` - Overall architecture
