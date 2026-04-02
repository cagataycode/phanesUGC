# Design Document: Agent Refactoring

## Overview

This document provides the technical design for refactoring the AI Ad Agent implementation. The refactoring addresses code duplication, missing implementations, type safety issues, and architectural improvements while maintaining backward compatibility and test coverage.

## System Architecture

### Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      AdsController                          │
│  POST /ads (Phase 1)                                        │
│  POST /ads/:id/select (Select scenario)                    │
│  GET /ads/:id (Get result)                                 │
└────────────────┬────────────────────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────────────────────┐
│                      AdsService                             │
│  - processJob() → runPhase1()                              │
│  - selectScenario() → runPhase2()                          │
└────────────────┬────────────────────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────────────────────┐
│              AgentOrchestratorService                       │
│  - initializeJob()                                          │
│  - runPhase1() → 4 scenarios                               │
│  - selectScenario()                                         │
│  - runPhase2() → final video                               │
└────────────────┬────────────────────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────────────────────┐
│                   Stage Services                            │
│  Phase 1:                                                   │
│  1. InputNormalizer                                         │
│  2. ContextAcquisition (ScraperService)                    │
│  3. BriefBuilder (adapter → BriefGenerationService)        │
│  4. ScenarioGenerator                                       │
│                                                             │
│  Phase 2:                                                   │
│  5. ScriptGenerator (adapter → ScriptGenerationService)    │
│  6. VeoPromptBuilder (adapter → SceneStructuringService)   │
│  7. VideoGenerator (VertexAiService)                       │
│  8. SubtitleGenerator                                       │
│  9. TimelineAssembler                                       │
│  10. RenderExecutor (RenderService)                        │
└─────────────────────────────────────────────────────────────┘
```

### Issues with Current Architecture

1. **Type Duplication**: `ads/types/` vs `agent/contracts/` (200+ lines)
2. **Adapter Boilerplate**: Duplicate conversion logic in 3 adapters (150+ lines)
3. **Platform Mapping**: Duplicated in 3 files
4. **Missing Retry/Fallback**: No error recovery policies
5. **OutputValidator**: Not integrated in Phase 2
6. **Weak Type Safety**: `any` types, loose interfaces

### Proposed Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      AdsController                          │
│  (No changes - maintains API contract)                     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────────────────────┐
│                      AdsService                             │
│  (No changes - maintains integration layer)                │
└────────────────┬────────────────────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────────────────────┐
│              AgentOrchestratorService                       │
│  + Retry policies integration                              │
│  + Fallback policies integration                           │
│  + OutputValidator integration                             │
│  + Improved error handling                                 │
└────────────────┬────────────────────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────────────────────┐
│                   Stage Services                            │
│  + Use shared utilities (PlatformMapper, DtoMapper)        │
│  + Strong typing (no any types)                            │
│  + Consistent error handling                               │
└─────────────────────────────────────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────────────────────┐
│                  Shared Utilities                           │
│  NEW: PlatformMapper - bidirectional platform mapping      │
│  NEW: DtoMapper - centralized DTO conversion               │
│  NEW: AgentConstants - shared constants                    │
│  NEW: RetryPolicy - retry logic with exponential backoff   │
│  NEW: FallbackPolicy - graceful degradation                │
└─────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. Shared Utilities Module

#### 1.1 PlatformMapper

**Location**: `backend/src/agent/utils/platform-mapper.ts`

**Purpose**: Single source of truth for platform name mapping

**Interface**:
```typescript
export class PlatformMapper {
  /**
   * Convert agent platform format to ads platform format
   * tiktok → tiktok
   * instagram_reels → instagram
   * youtube_shorts → youtube
   */
  static toAdsFormat(
    agentPlatform: 'tiktok' | 'instagram_reels' | 'youtube_shorts'
  ): 'tiktok' | 'instagram' | 'youtube';

  /**
   * Convert ads platform format to agent platform format
   * tiktok → tiktok
   * instagram → instagram_reels
   * youtube → youtube_shorts
   */
  static toAgentFormat(
    adsPlatform: 'tiktok' | 'instagram' | 'youtube'
  ): 'tiktok' | 'instagram_reels' | 'youtube_shorts';

  /**
   * Validate platform value
   */
  static isValidAgentPlatform(value: string): boolean;
  static isValidAdsPlatform(value: string): boolean;
}
```

#### 1.2 DtoMapper

**Location**: `backend/src/agent/utils/dto-mapper.ts`

**Purpose**: Centralized conversion between agent contracts and ads DTOs

**Interface**:
```typescript
export class DtoMapper {
  /**
   * Convert NormalizedRequest + ProductContext to CreateAdDto
   */
  static toCreateAdDto(
    request: NormalizedRequest,
    productContext: ProductContext,
    brief?: CreativeBrief
  ): CreateAdDto;

  /**
   * Convert agent CreativeBrief to ads CreativeBrief
   */
  static toAdsBrief(brief: CreativeBrief): AdsCreativeBrief;

  /**
   * Convert ads CreativeBrief to agent CreativeBrief
   */
  static toAgentBrief(
    adsBrief: AdsCreativeBrief,
    productContext: ProductContext
  ): CreativeBrief;

  /**
   * Convert agent AdScript to ads GeneratedScript
   */
  static toAdsScript(script: AdScript): GeneratedScript;

  /**
   * Convert ads GeneratedScript to agent AdScript
   */
  static toAgentScript(
    adsScript: GeneratedScript,
    jobId: string,
    scenarioId: number
  ): AdScript;

  /**
   * Convert ads VeoScenePrompt to agent VeoPrompt
   */
  static toAgentVeoPrompt(
    jobId: string,
    scenePrompt: VeoScenePrompt
  ): VeoPrompt;
}
```

#### 1.3 AgentConstants

**Location**: `backend/src/agent/utils/agent-constants.ts`

**Purpose**: Centralized constants

**Interface**:
```typescript
export const AgentConstants = {
  // Timing
  SCENARIO_EXPIRY_HOURS: 24,
  MAX_RETRIES: 2,
  RETRY_DELAY_MS: 1000,
  RETRY_BACKOFF_MULTIPLIER: 2,

  // Durations
  DEFAULT_DURATION_SEC: 8,
  MIN_DURATION_SEC: 5,
  MAX_DURATION_SEC: 60,

  // Quality thresholds
  MIN_QUALITY_SCORE: 0.6,
  WARN_QUALITY_SCORE: 0.8,

  // Defaults
  DEFAULT_LANGUAGE: 'en',
  DEFAULT_PLATFORM: 'tiktok' as const,
  DEFAULT_ASPECT_RATIO: '9:16' as const,
  DEFAULT_SUBTITLE_STYLE: 'kinetic' as const,
} as const;
```

### 2. Retry and Fallback Policies

#### 2.1 RetryPolicy

**Location**: `backend/src/agent/policies/retry-policy.ts`

**Purpose**: Implement retry logic with exponential backoff

**Interface**:
```typescript
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[]; // Error message patterns
}

export class RetryPolicy {
  constructor(private config: RetryConfig);

  /**
   * Execute function with retry logic
   * Returns result on success, throws on final failure
   */
  async execute<T>(
    fn: () => Promise<T>,
    context: { jobId: string; stage: string }
  ): Promise<T>;

  /**
   * Check if error is retryable
   */
  isRetryable(error: unknown): boolean;

  /**
   * Calculate delay for retry attempt
   */
  calculateDelay(attemptNumber: number): number;
}
```

**Implementation Strategy**:
- Exponential backoff: delay = initialDelay * (backoffMultiplier ^ attemptNumber)
- Retryable errors: network timeouts, rate limits, transient API errors
- Non-retryable errors: validation errors, authentication errors, not found errors
- Log each retry attempt with context

#### 2.2 FallbackPolicy

**Location**: `backend/src/agent/policies/fallback-policy.ts`

**Purpose**: Provide graceful degradation when operations fail

**Interface**:
```typescript
export interface FallbackConfig {
  enableFallbacks: boolean;
  logFallbacks: boolean;
}

export class FallbackPolicy {
  constructor(private config: FallbackConfig);

  /**
   * Fallback for scraping failure
   * Returns manual inputs only
   */
  async handleScrapingFailure(
    request: NormalizedRequest
  ): Promise<ProductContext>;

  /**
   * Fallback for brief generation failure
   * Returns simplified brief from template
   */
  async handleBriefFailure(
    request: NormalizedRequest,
    productContext: ProductContext
  ): Promise<CreativeBrief>;

  /**
   * Fallback for scenario generation failure
   * Returns single default scenario
   */
  async handleScenarioFailure(
    brief: CreativeBrief
  ): Promise<ScenarioSet>;

  /**
   * No fallback for video generation - mark as failed
   */
  handleVideoFailure(error: unknown): never;
}
```

### 3. OutputValidator Integration

**Location**: `backend/src/agent/stages/output-validator.service.ts` (existing, needs implementation)

**Current State**: Stub implementation with TODOs

**Proposed Implementation**:
```typescript
export interface ValidationResult {
  passed: boolean;
  warnings: string[];
  errors: string[];
  checks: {
    fileExists: boolean;
    durationValid: boolean;
    resolutionValid: boolean;
    fileSizeValid: boolean;
    subtitlesValid: boolean;
  };
}

@Injectable()
export class OutputValidatorService {
  /**
   * Validate final output
   * Soft validation - logs warnings but doesn't block
   */
  async validate(
    output: FinalOutput,
    expectedDuration: number,
    expectedAspectRatio: string
  ): Promise<ValidationResult>;

  /**
   * Check if video file exists in storage
   */
  private async checkFileExists(gcsPath: string): Promise<boolean>;

  /**
   * Check if duration is within tolerance
   */
  private checkDuration(
    actualDuration: number,
    expectedDuration: number,
    toleranceSec: number = 2
  ): boolean;

  /**
   * Check if resolution matches aspect ratio
   */
  private checkResolution(
    width: number,
    height: number,
    expectedAspectRatio: string
  ): boolean;

  /**
   * Check if file size is reasonable
   */
  private checkFileSize(
    fileSizeBytes: number,
    minBytes: number = 1,
    maxBytes: number = 500 * 1024 * 1024
  ): boolean;

  /**
   * Check if subtitles cover full duration
   */
  private checkSubtitles(
    subtitles: SubtitleData,
    videoDuration: number
  ): boolean;
}
```

**Integration Point**: Call in `AgentOrchestratorService.runPhase2()` after `renderExecutor.render()` and before final quality gate.

### 4. Type System Consolidation

**Strategy**: Use agent contracts as canonical types, remove duplicate ads types

**Migration Path**:
1. Keep `agent/contracts/` as source of truth
2. Remove duplicate types from `ads/types/` that have equivalents
3. Update ads services to accept agent contracts OR ads DTOs (overloaded signatures)
4. Gradually migrate ads services to use agent contracts internally

**Types to Keep**:
- `agent/contracts/*` - All agent contracts (canonical)
- `ads/dto/*` - External API DTOs (for backward compatibility)

**Types to Remove** (after migration):
- `ads/types/creative-brief.ts` - Use `agent/contracts/creative-brief.ts`
- `ads/types/generated-script.ts` - Use `agent/contracts/ad-script.ts`
- `ads/types/veo-scene-prompt.ts` - Use `agent/contracts/veo-prompt.ts`

**Types to Keep** (no equivalent):
- `ads/types/scene.ts` - Used by scene structuring, no agent equivalent

### 5. Improved Type Safety

**Changes**:
1. Replace all `any` types with explicit types
2. Use string literal unions for enum-like values
3. Mark optional fields with `?` instead of `| undefined`
4. Add type guards for runtime validation
5. Use `unknown` instead of `any` for error handling

**Example**:
```typescript
// Before
function processError(error: any) {
  return error.message;
}

// After
function processError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
```

## Implementation Phases

### Phase 1: Create Shared Utilities (45 min)

**Goal**: Extract common code into reusable utilities

**Steps**:
1. Create `backend/src/agent/utils/` directory
2. Implement `PlatformMapper` with tests
3. Implement `DtoMapper` with tests
4. Create `AgentConstants` file
5. Update adapter services to use new utilities
6. Run tests, verify all 83 pass
7. Commit: "refactor: extract shared utilities (PlatformMapper, DtoMapper, constants)"

**Files Created**:
- `backend/src/agent/utils/platform-mapper.ts`
- `backend/src/agent/utils/platform-mapper.spec.ts`
- `backend/src/agent/utils/dto-mapper.ts`
- `backend/src/agent/utils/dto-mapper.spec.ts`
- `backend/src/agent/utils/agent-constants.ts`
- `backend/src/agent/utils/index.ts`

**Files Modified**:
- `backend/src/agent/stages/brief-builder.service.ts`
- `backend/src/agent/stages/script-generator.service.ts`
- `backend/src/agent/stages/veo-prompt-builder.service.ts`
- `backend/src/agent/orchestrator/agent-orchestrator.service.ts`

**Success Criteria**:
- All 83 tests pass
- Platform mapping in one place
- DTO conversion in one place
- Adapter services reduced by 80+ lines

### Phase 2: Implement Retry & Fallback Policies (90 min)

**Goal**: Add error recovery mechanisms

**Steps**:
1. Create `backend/src/agent/policies/` directory
2. Implement `RetryPolicy` with tests
3. Implement `FallbackPolicy` with tests
4. Integrate `RetryPolicy` into `AgentOrchestratorService`
5. Integrate `FallbackPolicy` into stage services
6. Update error handling to distinguish retryable/non-retryable
7. Run tests, verify all pass
8. Commit: "feat: implement retry and fallback policies"

**Files Created**:
- `backend/src/agent/policies/retry-policy.ts`
- `backend/src/agent/policies/retry-policy.spec.ts`
- `backend/src/agent/policies/fallback-policy.ts`
- `backend/src/agent/policies/fallback-policy.spec.ts`
- `backend/src/agent/policies/index.ts`

**Files Modified**:
- `backend/src/agent/orchestrator/agent-orchestrator.service.ts`
- `backend/src/agent/stages/context-acquisition.service.ts`
- `backend/src/agent/stages/brief-builder.service.ts`
- `backend/src/agent/stages/scenario-generator.service.ts`
- `backend/src/agent/agent.module.ts`

**Success Criteria**:
- Retry logic works with exponential backoff
- Fallback logic provides graceful degradation
- All TODOs for retry logic resolved
- All tests pass

### Phase 3: Integrate OutputValidator & Quality Gates (60 min)

**Goal**: Add comprehensive output validation

**Steps**:
1. Implement `OutputValidatorService` (currently stub)
2. Add validation checks (file exists, duration, resolution, file size, subtitles)
3. Integrate into `AgentOrchestratorService.runPhase2()`
4. Update quality gates to use OutputValidator
5. Add validation result to job state
6. Run tests, verify all pass
7. Commit: "feat: integrate OutputValidator and quality gates"

**Files Modified**:
- `backend/src/agent/stages/output-validator.service.ts`
- `backend/src/agent/orchestrator/agent-orchestrator.service.ts`
- `backend/src/agent/orchestrator/quality-gates.service.ts`
- `backend/src/agent/orchestrator/agent-state.model.ts`

**Success Criteria**:
- OutputValidator fully implemented
- Validation runs in Phase 2
- Quality reports include validation results
- All TODOs for OutputValidator resolved
- All tests pass

### Phase 4: Type System Consolidation (60 min)

**Goal**: Eliminate type duplication

**Steps**:
1. Audit all type usage in ads services
2. Update ads services to accept agent contracts
3. Remove duplicate types from `ads/types/`
4. Update imports throughout codebase
5. Run tests, verify all pass
6. Commit: "refactor: consolidate type system, use agent contracts"

**Files Removed**:
- `backend/src/ads/types/creative-brief.ts` (use agent contract)
- `backend/src/ads/types/generated-script.ts` (use agent contract)
- `backend/src/ads/types/veo-scene-prompt.ts` (use agent contract)

**Files Modified**:
- `backend/src/ads/services/brief-generation.service.ts`
- `backend/src/ads/services/script-generation.service.ts`
- `backend/src/ads/services/scene-structuring.service.ts`
- All adapter services (update imports)

**Success Criteria**:
- 200+ lines of duplicate types removed
- Single source of truth for types
- All tests pass
- No breaking changes to external API

### Phase 5: Improve Type Safety (60 min)

**Goal**: Eliminate weak typing

**Steps**:
1. Find all `any` types in agent module
2. Replace with explicit types or `unknown`
3. Add type guards where needed
4. Use string literal unions for enum-like values
5. Mark optional fields consistently
6. Run tests, verify all pass
7. Commit: "refactor: improve type safety throughout agent module"

**Files Modified**:
- All files in `backend/src/agent/`
- Focus on orchestrator and stage services

**Success Criteria**:
- Zero `any` types in agent module
- Strong typing throughout
- Type guards for runtime validation
- All tests pass

### Phase 6: Documentation & Cleanup (30 min)

**Goal**: Update documentation and remove TODOs

**Steps**:
1. Update `docs/AGENT_INTEGRATION_PLAN.md` with new architecture
2. Document shared utilities usage
3. Document retry/fallback policies
4. Add migration guide for developers
5. Remove all TODO comments
6. Run final test suite
7. Commit: "docs: update agent architecture documentation"

**Files Modified**:
- `docs/AGENT_INTEGRATION_PLAN.md`
- `README.md` (if needed)
- All files with TODO comments

**Files Created**:
- `docs/AGENT_UTILITIES.md` - Utility usage guide
- `docs/AGENT_ERROR_HANDLING.md` - Retry/fallback guide

**Success Criteria**:
- All documentation updated
- Zero TODO comments in agent module
- Migration guide available
- All tests pass

## Data Models

### Agent Contracts (Canonical Types)

**Location**: `backend/src/agent/contracts/`

These are the source of truth for all agent data structures:

- `normalized-request.ts` - User input after normalization
- `product-context.ts` - Product information from scraping/manual input
- `creative-brief.ts` - Marketing brief for ad generation
- `scenario.ts` - Generated scenario options (Phase 1 output)
- `ad-script.ts` - Generated script with voiceover
- `veo-prompt.ts` - Structured prompt for Veo video generation
- `veo-output.ts` - Generated video from Veo
- `subtitle-data.ts` - Subtitle segments with timing
- `render-timeline.ts` - Remotion composition timeline
- `final-output.ts` - Final rendered video with metadata

### Ads DTOs (External API)

**Location**: `backend/src/ads/dto/`

These maintain backward compatibility with the external API:

- `create-ad.dto.ts` - Request payload for POST /ads

### Conversion Strategy

All conversions between agent contracts and ads DTOs go through `DtoMapper`:

```
External API (ads DTOs)
         ↓
    DtoMapper.toAgentFormat()
         ↓
Agent Contracts (internal processing)
         ↓
    DtoMapper.toAdsFormat()
         ↓
Legacy Ads Services (ads DTOs)
```

## Migration Strategy

### Backward Compatibility

**API Contract**: No changes to external API
- POST /ads - Same request/response format
- POST /ads/:id/select - Same request/response format
- GET /ads/:id - Same response format

**Internal Changes**: All changes are internal refactoring
- Shared utilities
- Retry/fallback policies
- Type consolidation
- Improved error handling

### Rollback Plan

Each phase is independently committable and testable:

1. **Phase 1 Rollback**: Revert shared utilities commit, adapters work as before
2. **Phase 2 Rollback**: Revert retry/fallback commit, orchestrator works as before
3. **Phase 3 Rollback**: Revert OutputValidator commit, quality gates work as before
4. **Phase 4 Rollback**: Revert type consolidation commit, types work as before
5. **Phase 5 Rollback**: Revert type safety commit, weak typing restored
6. **Phase 6 Rollback**: Revert documentation commit, old docs restored

### Testing Strategy

**After Each Phase**:
1. Run full test suite: `npm test`
2. Verify all 83+ tests pass
3. Run linter: `npm run lint`
4. Build project: `npm run build`
5. Manual smoke test: Create ad, select scenario, verify video generation

**Integration Testing**:
- Test Phase 1 end-to-end (scenario generation)
- Test Phase 2 end-to-end (video generation)
- Test error scenarios (retry, fallback)
- Test quality gates (validation)

## Success Metrics

### Code Quality Metrics

- **Type Duplication**: Reduce from 200+ lines to <40 lines (80% reduction)
- **Adapter Boilerplate**: Reduce from 150+ lines to <30 lines (80% reduction)
- **Platform Mapping**: Reduce from 3 implementations to 1 (100% consolidation)
- **TODO Comments**: Reduce from 5 to 0 (100% resolution)
- **Type Safety**: Reduce `any` types from 10+ to 0 (100% elimination)

### Functional Metrics

- **Test Coverage**: Maintain 83+ passing tests (100% pass rate)
- **API Compatibility**: Zero breaking changes (100% backward compatible)
- **Error Recovery**: Retry logic implemented (2 retries with exponential backoff)
- **Graceful Degradation**: Fallback logic implemented (4 fallback scenarios)
- **Output Validation**: Quality gates implemented (5 validation checks)

### Performance Metrics

- **Phase 1 Duration**: Maintain <30 seconds
- **Phase 2 Duration**: Maintain <10 minutes
- **Retry Overhead**: <5 seconds per retry attempt
- **Validation Overhead**: <2 seconds per validation check

## Risk Assessment

### High Risk

- **Type System Migration**: Breaking changes if not careful
  - Mitigation: Incremental migration, maintain backward compatibility
- **Retry Logic**: Infinite loops or excessive retries
  - Mitigation: Max retry limit, exponential backoff, timeout

### Medium Risk

- **Fallback Quality**: Degraded output quality
  - Mitigation: Log all fallbacks, monitor quality scores
- **Test Coverage**: New code not fully tested
  - Mitigation: Add tests for all new utilities and policies

### Low Risk

- **Documentation**: Outdated docs
  - Mitigation: Update docs in final phase
- **Performance**: Slight overhead from utilities
  - Mitigation: Utilities are lightweight, minimal overhead

## Conclusion

This design provides a comprehensive plan for refactoring the agent implementation to address all issues identified in the code review. The phased approach ensures incremental progress with testing after each phase, minimizing risk and enabling easy rollback if needed.

The refactoring will result in:
- 80% reduction in code duplication
- Improved maintainability and type safety
- Comprehensive error recovery mechanisms
- Full output validation
- Updated documentation

All changes maintain backward compatibility with the existing API, ensuring no disruption to frontend integration.
