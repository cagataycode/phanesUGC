# Implementation Tasks: Agent Refactoring

## Phase 1: Create Shared Utilities

### Task 1.1: Create PlatformMapper utility
- [ ] Create `backend/src/agent/utils/platform-mapper.ts`
- [ ] Implement `toAdsFormat()` method
- [ ] Implement `toAgentFormat()` method
- [ ] Implement validation methods
- [ ] Create `backend/src/agent/utils/platform-mapper.spec.ts`
- [ ] Add unit tests for all methods
- [ ] Export from `backend/src/agent/utils/index.ts`

### Task 1.2: Create DtoMapper utility
- [ ] Create `backend/src/agent/utils/dto-mapper.ts`
- [ ] Implement `toCreateAdDto()` method
- [ ] Implement `toAdsBrief()` method
- [ ] Implement `toAgentBrief()` method
- [ ] Implement `toAdsScript()` method
- [ ] Implement `toAgentScript()` method
- [ ] Implement `toAgentVeoPrompt()` method
- [ ] Create `backend/src/agent/utils/dto-mapper.spec.ts`
- [ ] Add unit tests for all methods
- [ ] Export from `backend/src/agent/utils/index.ts`

### Task 1.3: Create AgentConstants
- [ ] Create `backend/src/agent/utils/agent-constants.ts`
- [ ] Define timing constants
- [ ] Define duration constants
- [ ] Define quality threshold constants
- [ ] Define default value constants
- [ ] Export from `backend/src/agent/utils/index.ts`

### Task 1.4: Update adapter services to use utilities
- [ ] Update `brief-builder.service.ts` to use `DtoMapper` and `PlatformMapper`
- [ ] Update `script-generator.service.ts` to use `DtoMapper`
- [ ] Update `veo-prompt-builder.service.ts` to use `DtoMapper` and `PlatformMapper`
- [ ] Update `agent-orchestrator.service.ts` to use `PlatformMapper` and `AgentConstants`
- [ ] Remove duplicate conversion logic from adapters
- [ ] Remove duplicate platform mapping logic

### Task 1.5: Test and commit Phase 1
- [ ] Run `npm test` - verify all 83 tests pass
- [ ] Run `npm run lint` - fix any linting issues
- [ ] Run `npm run build` - verify build succeeds
- [ ] Commit: "refactor: extract shared utilities (PlatformMapper, DtoMapper, constants)"

---

## Phase 2: Implement Retry & Fallback Policies

### Task 2.1: Create RetryPolicy
- [ ] Create `backend/src/agent/policies/retry-policy.ts`
- [ ] Define `RetryConfig` interface
- [ ] Implement `RetryPolicy` class
- [ ] Implement `execute()` method with exponential backoff
- [ ] Implement `isRetryable()` method
- [ ] Implement `calculateDelay()` method
- [ ] Create `backend/src/agent/policies/retry-policy.spec.ts`
- [ ] Add unit tests for retry logic
- [ ] Add tests for exponential backoff
- [ ] Export from `backend/src/agent/policies/index.ts`

### Task 2.2: Create FallbackPolicy
- [ ] Create `backend/src/agent/policies/fallback-policy.ts`
- [ ] Define `FallbackConfig` interface
- [ ] Implement `FallbackPolicy` class
- [ ] Implement `handleScrapingFailure()` method
- [ ] Implement `handleBriefFailure()` method
- [ ] Implement `handleScenarioFailure()` method
- [ ] Implement `handleVideoFailure()` method
- [ ] Create `backend/src/agent/policies/fallback-policy.spec.ts`
- [ ] Add unit tests for all fallback scenarios
- [ ] Export from `backend/src/agent/policies/index.ts`

### Task 2.3: Integrate RetryPolicy into orchestrator
- [ ] Add `RetryPolicy` to `AgentOrchestratorService` constructor
- [ ] Wrap Phase 1 stages with retry logic
- [ ] Wrap Phase 2 stages with retry logic
- [ ] Update error handling to distinguish retryable/non-retryable errors
- [ ] Add retry count to error logging
- [ ] Remove TODO comments for retry logic

### Task 2.4: Integrate FallbackPolicy into stages
- [ ] Add `FallbackPolicy` to `ContextAcquisitionService`
- [ ] Add fallback for scraping failures
- [ ] Add `FallbackPolicy` to `BriefBuilderService`
- [ ] Add fallback for brief generation failures
- [ ] Add `FallbackPolicy` to `ScenarioGeneratorService`
- [ ] Add fallback for scenario generation failures
- [ ] Update `AgentModule` to provide policy services

### Task 2.5: Test and commit Phase 2
- [ ] Run `npm test` - verify all tests pass
- [ ] Run `npm run lint` - fix any linting issues
- [ ] Run `npm run build` - verify build succeeds
- [ ] Test retry logic manually (simulate failures)
- [ ] Test fallback logic manually (simulate failures)
- [ ] Commit: "feat: implement retry and fallback policies"

---

## Phase 3: Integrate OutputValidator & Quality Gates

### Task 3.1: Implement OutputValidatorService
- [ ] Open `backend/src/agent/stages/output-validator.service.ts`
- [ ] Define `ValidationResult` interface
- [ ] Implement `validate()` method
- [ ] Implement `checkFileExists()` method (use StorageService)
- [ ] Implement `checkDuration()` method
- [ ] Implement `checkResolution()` method
- [ ] Implement `checkFileSize()` method
- [ ] Implement `checkSubtitles()` method
- [ ] Add comprehensive error handling
- [ ] Remove TODO comments

### Task 3.2: Integrate OutputValidator into Phase 2
- [ ] Uncomment `OutputValidatorService` import in orchestrator
- [ ] Add to constructor dependencies
- [ ] Call `outputValidator.validate()` after `renderExecutor.render()`
- [ ] Add validation result to job state
- [ ] Log validation warnings
- [ ] Update quality gates to include validation results

### Task 3.3: Update QualityGatesService
- [ ] Add validation result to quality report
- [ ] Update `calculateQualityScore()` to include validation
- [ ] Add validation checks to quality report structure
- [ ] Update `AgentJobState` to include validation results

### Task 3.4: Test and commit Phase 3
- [ ] Run `npm test` - verify all tests pass
- [ ] Run `npm run lint` - fix any linting issues
- [ ] Run `npm run build` - verify build succeeds
- [ ] Test validation manually (create video, check validation)
- [ ] Verify validation warnings are logged
- [ ] Commit: "feat: integrate OutputValidator and quality gates"

---

## Phase 4: Type System Consolidation

### Task 4.1: Audit type usage
- [ ] List all usages of `ads/types/creative-brief.ts`
- [ ] List all usages of `ads/types/generated-script.ts`
- [ ] List all usages of `ads/types/veo-scene-prompt.ts`
- [ ] Identify services that need updates

### Task 4.2: Update ads services to accept agent contracts
- [ ] Update `BriefGenerationService` to accept agent `CreativeBrief`
- [ ] Update `ScriptGenerationService` to accept agent `AdScript`
- [ ] Update `SceneStructuringService` to accept agent `VeoPrompt`
- [ ] Add overloaded signatures for backward compatibility
- [ ] Update internal logic to use agent contracts

### Task 4.3: Remove duplicate types
- [ ] Delete `backend/src/ads/types/creative-brief.ts`
- [ ] Delete `backend/src/ads/types/generated-script.ts`
- [ ] Delete `backend/src/ads/types/veo-scene-prompt.ts`
- [ ] Keep `backend/src/ads/types/scene.ts` (no equivalent)

### Task 4.4: Update imports throughout codebase
- [ ] Update all imports from `ads/types/` to `agent/contracts/`
- [ ] Update adapter services
- [ ] Update ads services
- [ ] Fix any type errors

### Task 4.5: Test and commit Phase 4
- [ ] Run `npm test` - verify all tests pass
- [ ] Run `npm run lint` - fix any linting issues
- [ ] Run `npm run build` - verify build succeeds
- [ ] Verify no breaking changes to external API
- [ ] Commit: "refactor: consolidate type system, use agent contracts"

---

## Phase 5: Improve Type Safety

### Task 5.1: Find and replace any types
- [ ] Search for `any` in `backend/src/agent/orchestrator/`
- [ ] Search for `any` in `backend/src/agent/stages/`
- [ ] Search for `any` in `backend/src/agent/policies/`
- [ ] Search for `any` in `backend/src/agent/utils/`
- [ ] Create list of all `any` usages

### Task 5.2: Replace any with explicit types
- [ ] Replace `any` with explicit types where possible
- [ ] Replace `any` with `unknown` for error handling
- [ ] Add type guards for runtime validation
- [ ] Use type assertions only where necessary

### Task 5.3: Use string literal unions
- [ ] Replace string types with literal unions for platforms
- [ ] Replace string types with literal unions for stages
- [ ] Replace string types with literal unions for statuses
- [ ] Replace string types with literal unions for tones

### Task 5.4: Mark optional fields consistently
- [ ] Review all interfaces for optional fields
- [ ] Use `?` instead of `| undefined`
- [ ] Ensure consistency across all contracts

### Task 5.5: Test and commit Phase 5
- [ ] Run `npm test` - verify all tests pass
- [ ] Run `npm run lint` - fix any linting issues
- [ ] Run `npm run build` - verify build succeeds
- [ ] Verify zero `any` types in agent module
- [ ] Commit: "refactor: improve type safety throughout agent module"

---

## Phase 6: Documentation & Cleanup

### Task 6.1: Update AGENT_INTEGRATION_PLAN.md
- [ ] Document new architecture with shared utilities
- [ ] Document retry and fallback policies
- [ ] Document type system consolidation
- [ ] Update architecture diagrams
- [ ] Add examples of utility usage

### Task 6.2: Create utility documentation
- [ ] Create `docs/AGENT_UTILITIES.md`
- [ ] Document `PlatformMapper` usage
- [ ] Document `DtoMapper` usage
- [ ] Document `AgentConstants` usage
- [ ] Add code examples

### Task 6.3: Create error handling documentation
- [ ] Create `docs/AGENT_ERROR_HANDLING.md`
- [ ] Document retry policy configuration
- [ ] Document fallback policy behavior
- [ ] Document retryable vs non-retryable errors
- [ ] Add troubleshooting guide

### Task 6.4: Remove TODO comments
- [ ] Search for TODO in `backend/src/agent/`
- [ ] Verify all TODOs are resolved
- [ ] Remove TODO comments
- [ ] Add proper documentation where needed

### Task 6.5: Final testing and commit
- [ ] Run full test suite: `npm test`
- [ ] Run linter: `npm run lint`
- [ ] Run build: `npm run build`
- [ ] Manual smoke test: Create ad end-to-end
- [ ] Verify all 6 phases completed successfully
- [ ] Commit: "docs: update agent architecture documentation"

---

## Summary

**Total Tasks**: 60
**Estimated Time**: 6 hours
**Phases**: 6

**Success Criteria**:
- All 83+ tests passing
- Zero TODO comments in agent module
- 80% reduction in code duplication
- Retry and fallback policies implemented
- OutputValidator integrated
- Type system consolidated
- Strong typing throughout
- Documentation updated
