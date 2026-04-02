# Requirements Document: Agent Refactoring

## Introduction

This document specifies requirements for refactoring the AI Ad Agent implementation following a comprehensive code review. The agent orchestrates a two-phase video generation pipeline (scenario generation → user selection → video generation) that integrates with existing ads services. The refactoring addresses code duplication, missing implementations, type safety issues, and architectural improvements while maintaining backward compatibility and test coverage.

## Glossary

- **Agent_Orchestrator**: The service that coordinates the two-phase video generation pipeline
- **Agent_Contract**: TypeScript interface defining data structures passed between agent stages (camelCase naming)
- **Ads_DTO**: Data Transfer Object used by legacy ads services (snake_case naming)
- **Adapter_Service**: Service that converts between Agent_Contracts and Ads_DTOs
- **Type_Duplication**: Duplicate type definitions between `ads/types/` and `agent/contracts/`
- **Conversion_Boilerplate**: Repetitive code that transforms data between different type systems
- **Quality_Gate**: Validation checkpoint between pipeline stages
- **Retry_Policy**: Logic that determines when and how to retry failed operations
- **Fallback_Policy**: Logic that provides alternative behavior when operations fail
- **Output_Validator**: Service that validates final video output quality
- **Phase_1**: Fast scenario generation stage (< 30s)
- **Phase_2**: Full video generation stage after user selection (< 10 min)
- **Test_Suite**: Collection of 83 automated tests validating agent behavior

## Requirements

### Requirement 1: Eliminate Type Duplication

**User Story:** As a developer, I want a single source of truth for type definitions, so that I can maintain consistency and reduce code duplication.

#### Acceptance Criteria

1. THE Type_System SHALL use Agent_Contracts as the canonical type definitions
2. WHEN Adapter_Services convert data, THE Type_System SHALL map from Agent_Contracts to Ads_DTOs
3. THE Type_System SHALL remove duplicate type definitions from `ads/types/` that have equivalents in `agent/contracts/`
4. THE Type_System SHALL maintain backward compatibility with existing Ads_DTOs for legacy services
5. FOR ALL type conversions, the round-trip property SHALL hold: converting Agent_Contract → Ads_DTO → Agent_Contract SHALL produce an equivalent object

### Requirement 2: Consolidate Adapter Conversion Logic

**User Story:** As a developer, I want centralized conversion logic, so that I can eliminate boilerplate and ensure consistent transformations.

#### Acceptance Criteria

1. THE Adapter_Service SHALL provide a shared conversion utility for Agent_Contract to Ads_DTO transformations
2. WHEN multiple services need the same conversion, THE Adapter_Service SHALL reuse the shared utility
3. THE Adapter_Service SHALL reduce conversion boilerplate by at least 80%
4. THE Adapter_Service SHALL maintain type safety with explicit TypeScript types for all conversions
5. WHEN conversion fails, THE Adapter_Service SHALL throw a descriptive error with the field name and expected type

### Requirement 3: Consolidate Platform Mapping Logic

**User Story:** As a developer, I want platform mapping in one place, so that I can avoid inconsistencies across services.

#### Acceptance Criteria

1. THE Platform_Mapper SHALL provide a single function for mapping platform names
2. THE Platform_Mapper SHALL support bidirectional mapping (agent format ↔ ads format)
3. WHEN an unknown platform is provided, THE Platform_Mapper SHALL return a default value and log a warning
4. THE Platform_Mapper SHALL be used by all Adapter_Services that handle platform values
5. THE Platform_Mapper SHALL validate that mapped values are within the allowed set

### Requirement 4: Implement Retry Policies

**User Story:** As a system operator, I want automatic retry logic for transient failures, so that the pipeline can recover from temporary issues.

#### Acceptance Criteria

1. THE Retry_Policy SHALL attempt each failed stage operation up to 2 times
2. WHEN a stage fails, THE Retry_Policy SHALL wait with exponential backoff before retrying
3. THE Retry_Policy SHALL record the failure reason for each retry attempt
4. WHEN all retry attempts are exhausted, THE Retry_Policy SHALL mark the stage as failed and proceed to fallback logic
5. THE Retry_Policy SHALL apply only to retryable errors (network timeouts, rate limits, transient API errors)
6. IF an error is non-retryable (validation error, authentication error), THEN THE Retry_Policy SHALL immediately fail without retrying

### Requirement 5: Implement Fallback Policies

**User Story:** As a system operator, I want graceful degradation when operations fail, so that the pipeline can continue with reduced functionality.

#### Acceptance Criteria

1. WHEN scraping fails, THE Fallback_Policy SHALL use manual product inputs only
2. WHEN brief generation fails after retries, THE Fallback_Policy SHALL use a simplified prompt template
3. WHEN scenario generation fails after retries, THE Fallback_Policy SHALL generate one default scenario
4. WHEN video generation fails after retries, THE Fallback_Policy SHALL mark the job as failed and notify the user
5. THE Fallback_Policy SHALL log all fallback activations with the original error and fallback action taken

### Requirement 6: Integrate Output Validator

**User Story:** As a quality assurance engineer, I want comprehensive output validation, so that I can ensure generated videos meet quality standards.

#### Acceptance Criteria

1. THE Output_Validator SHALL validate that the output video file exists in storage
2. THE Output_Validator SHALL validate that video duration is within ±2 seconds of target duration
3. THE Output_Validator SHALL validate that video resolution matches the requested aspect ratio
4. THE Output_Validator SHALL validate that file size is greater than 0 and less than 500MB
5. THE Output_Validator SHALL validate that subtitles cover the full video duration
6. WHEN validation fails, THE Output_Validator SHALL log warnings but allow the output to proceed (soft validation)
7. THE Output_Validator SHALL attach a quality report to the job with pass/warn/fail status for each check

### Requirement 7: Resolve TODO Comments

**User Story:** As a developer, I want all TODO comments resolved, so that the codebase is production-ready.

#### Acceptance Criteria

1. THE Codebase SHALL implement the OutputValidatorService integration in Phase 2
2. THE Codebase SHALL implement retry logic in the Agent_Orchestrator
3. THE Codebase SHALL implement subtitle chunking and timing logic in SubtitleGeneratorService
4. THE Codebase SHALL implement validation logic in OutputValidatorService
5. THE Codebase SHALL implement URL validation with SSRF prevention in InputNormalizerService
6. THE Codebase SHALL implement actual file size retrieval in RenderExecutorService
7. WHEN all TODOs are resolved, THE Codebase SHALL contain zero TODO comments in agent module files

### Requirement 8: Improve Type Safety

**User Story:** As a developer, I want strong typing throughout the codebase, so that I can catch errors at compile time.

#### Acceptance Criteria

1. THE Type_System SHALL eliminate all `any` types in agent module files
2. THE Type_System SHALL use explicit TypeScript interfaces for all function parameters and return types
3. THE Type_System SHALL use string literal unions instead of plain strings for enum-like values
4. THE Type_System SHALL mark optional fields with `?` instead of `| undefined`
5. WHEN type assertions are necessary, THE Type_System SHALL use type guards with runtime validation

### Requirement 9: Maintain Backward Compatibility

**User Story:** As a product manager, I want existing API contracts preserved, so that frontend integration continues working without changes.

#### Acceptance Criteria

1. THE API SHALL maintain the same endpoint paths and HTTP methods
2. THE API SHALL accept the same request payload structure
3. THE API SHALL return the same response payload structure
4. THE API SHALL maintain the same error response format
5. WHEN internal types change, THE API SHALL use adapter layers to preserve external contracts

### Requirement 10: Preserve Test Coverage

**User Story:** As a quality assurance engineer, I want all existing tests to pass, so that I can verify no regressions were introduced.

#### Acceptance Criteria

1. THE Test_Suite SHALL pass all 83 existing tests after refactoring
2. WHEN new code is added, THE Test_Suite SHALL include tests for the new functionality
3. THE Test_Suite SHALL maintain at least 80% code coverage for agent module files
4. THE Test_Suite SHALL include integration tests for adapter conversion logic
5. THE Test_Suite SHALL include tests for retry and fallback policies

### Requirement 11: Update Documentation

**User Story:** As a developer, I want updated documentation, so that I can understand the refactored architecture.

#### Acceptance Criteria

1. THE Documentation SHALL update AGENT_INTEGRATION_PLAN.md with the new architecture
2. THE Documentation SHALL document all shared utilities and their usage
3. THE Documentation SHALL document retry and fallback policies with examples
4. THE Documentation SHALL document the type conversion strategy
5. THE Documentation SHALL include a migration guide for developers working on related code

### Requirement 12: Implement Incremental Refactoring

**User Story:** As a project manager, I want incremental changes with testing, so that I can minimize risk and enable rollback.

#### Acceptance Criteria

1. THE Refactoring SHALL be divided into at least 4 phases with clear boundaries
2. WHEN each phase completes, THE Test_Suite SHALL run and pass before proceeding
3. THE Refactoring SHALL commit changes after each phase with descriptive commit messages
4. THE Refactoring SHALL maintain a working system at the end of each phase
5. IF a phase introduces failures, THE Refactoring SHALL rollback that phase before proceeding

### Requirement 13: Reduce Code Duplication

**User Story:** As a technical lead, I want measurable reduction in code duplication, so that I can verify the refactoring achieved its goals.

#### Acceptance Criteria

1. THE Refactoring SHALL reduce type definition duplication by at least 80%
2. THE Refactoring SHALL reduce adapter conversion boilerplate by at least 80%
3. THE Refactoring SHALL reduce platform mapping duplication to a single implementation
4. THE Refactoring SHALL measure duplication before and after using line count metrics
5. THE Refactoring SHALL document the duplication reduction in the final summary

### Requirement 14: Implement Quality Gate Integration

**User Story:** As a system operator, I want quality gates enforced at each stage, so that I can catch issues early in the pipeline.

#### Acceptance Criteria

1. THE Quality_Gate SHALL run after script generation to validate script quality
2. THE Quality_Gate SHALL run after video generation to validate video output
3. THE Quality_Gate SHALL run after subtitle generation to validate subtitle quality
4. THE Quality_Gate SHALL run after final render to validate render output
5. THE Quality_Gate SHALL produce a quality report with pass/warn/fail status
6. WHILE in MVP mode, THE Quality_Gate SHALL log warnings but not block pipeline execution
7. THE Quality_Gate SHALL attach quality reports to the job for inspection

### Requirement 15: Implement Comprehensive Error Handling

**User Story:** As a system operator, I want detailed error information, so that I can diagnose and fix issues quickly.

#### Acceptance Criteria

1. WHEN an error occurs, THE Agent_Orchestrator SHALL log the error with full context (jobId, stage, error message, stack trace)
2. THE Agent_Orchestrator SHALL record errors in the job state with timestamp and retry count
3. THE Agent_Orchestrator SHALL distinguish between retryable and non-retryable errors
4. WHEN an error is recorded, THE Agent_Orchestrator SHALL include the stage name and failure reason
5. THE Agent_Orchestrator SHALL provide structured error responses to API clients with actionable messages
