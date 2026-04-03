# Requirements Document

## Introduction

This document specifies the requirements for migrating the NestJS backend's LLM provider from Google's Gemini API to AWS Bedrock Claude Sonnet 4.6 as the primary provider, while maintaining Gemini as a fallback option. The migration affects all AI-based content generation services including creative brief generation, script generation, scene structuring, and scenario generation.

## Glossary

- **LlmService**: The new provider-agnostic service that replaces GeminiService and manages multiple LLM providers
- **Primary_Provider**: AWS Bedrock Claude Sonnet 4.6 (model ID: us.anthropic.claude-sonnet-4-6)
- **Fallback_Provider**: Google Gemini API (existing implementation)
- **Structured_Outputs**: AWS Bedrock feature that guarantees JSON schema compliance
- **Consumer_Services**: Services that use LLM capabilities (BriefGenerationService, ScriptGenerationService, SceneStructuringService, ScenarioGeneratorService)
- **System_Prompt**: Instructions that define the LLM's role and output format
- **User_Prompt**: The specific content request sent to the LLM

## Requirements

### Requirement 1: LLM Service Creation

**User Story:** As a backend developer, I want a unified LLM service interface, so that consumer services don't need to know about specific provider implementations.

#### Acceptance Criteria

1. THE LlmService SHALL provide a generateContent method that accepts system_prompt and user_prompt parameters
2. THE LlmService SHALL return parsed JSON objects matching the expected schema
3. THE LlmService SHALL maintain the same method signature as the existing GeminiService
4. THE LlmService SHALL be injectable via NestJS dependency injection
5. THE LlmService SHALL use ConfigService to access environment variables

### Requirement 2: AWS Bedrock Integration

**User Story:** As a backend developer, I want to use AWS Bedrock Claude Sonnet 4.6 as the primary LLM provider, so that we can leverage Claude's superior reasoning capabilities.

#### Acceptance Criteria

1. THE LlmService SHALL use @aws-sdk/client-bedrock-runtime package for AWS Bedrock communication
2. WHEN generateContent is called, THE LlmService SHALL first attempt to use AWS Bedrock Claude Sonnet 4.6
3. THE LlmService SHALL use model ID us.anthropic.claude-sonnet-4-6 for Bedrock requests
4. THE LlmService SHALL format requests using Claude's message structure with system field for system prompts
5. THE LlmService SHALL use Bedrock Structured Outputs with JSON schema validation
6. THE LlmService SHALL set temperature to 0.7 for Claude requests
7. THE LlmService SHALL extract text content from Claude's response structure (content array with type and text fields)

### Requirement 3: Gemini Fallback Implementation

**User Story:** As a backend developer, I want Gemini to serve as a fallback provider, so that the system remains operational if Bedrock fails.

#### Acceptance Criteria

1. WHEN AWS Bedrock request fails, THE LlmService SHALL attempt the same request using Gemini API
2. THE LlmService SHALL reuse the existing Gemini implementation for fallback requests
3. THE LlmService SHALL log which provider was used for each request
4. THE LlmService SHALL log the reason for fallback when Gemini is used
5. IF both providers fail, THEN THE LlmService SHALL throw an error with details from both attempts

### Requirement 4: Environment Configuration

**User Story:** As a DevOps engineer, I want to configure AWS Bedrock credentials via environment variables, so that I can manage secrets securely.

#### Acceptance Criteria

1. THE System SHALL require AWS_ACCESS_KEY_ID environment variable for Bedrock authentication
2. THE System SHALL require AWS_SECRET_ACCESS_KEY environment variable for Bedrock authentication
3. THE System SHALL require AWS_REGION environment variable with default value us-east-1
4. THE System SHALL require BEDROCK_MODEL_ID environment variable with default value us.anthropic.claude-sonnet-4-6
5. THE System SHALL make GEMINI_API_KEY optional (required only for fallback functionality)
6. THE env.ts configuration file SHALL validate all new environment variables using Zod schema

### Requirement 5: Consumer Service Migration

**User Story:** As a backend developer, I want all consumer services to use the new LlmService, so that they benefit from the Bedrock migration and fallback capability.

#### Acceptance Criteria

1. THE BriefGenerationService SHALL inject and use LlmService instead of GeminiService
2. THE ScriptGenerationService SHALL inject and use LlmService instead of GeminiService
3. THE SceneStructuringService SHALL inject and use LlmService instead of GeminiService
4. THE ScenarioGeneratorService SHALL inject and use LlmService instead of GeminiService
5. THE Consumer_Services SHALL maintain their existing method signatures and behavior
6. THE Consumer_Services SHALL not require code changes beyond dependency injection updates

### Requirement 6: Module Configuration Updates

**User Story:** As a backend developer, I want the NestJS module system to provide LlmService instead of GeminiService, so that dependency injection works correctly.

#### Acceptance Criteria

1. THE agent.module.ts SHALL provide LlmService instead of GeminiService
2. THE ads.module.ts SHALL provide LlmService instead of GeminiService (if applicable)
3. THE Module configuration SHALL ensure LlmService is available to all Consumer_Services
4. THE Module configuration SHALL maintain backward compatibility with existing service dependencies

### Requirement 7: Error Message Updates

**User Story:** As a developer debugging issues, I want error messages to use provider-agnostic terminology, so that messages remain accurate regardless of which provider was used.

#### Acceptance Criteria

1. THE Consumer_Services SHALL replace "Gemini" references in error messages with "LLM"
2. THE Consumer_Services SHALL replace "Gemini" references in log messages with "LLM"
3. THE Error messages SHALL indicate which provider was actually used when failures occur
4. THE Log messages SHALL maintain sufficient detail for debugging provider-specific issues

### Requirement 8: Package Dependencies

**User Story:** As a backend developer, I want the required AWS SDK package installed, so that the application can communicate with AWS Bedrock.

#### Acceptance Criteria

1. THE package.json SHALL include @aws-sdk/client-bedrock-runtime as a dependency
2. THE package.json SHALL maintain the existing @google/generative-ai dependency for fallback
3. THE package.json SHALL specify compatible versions of all LLM-related dependencies

### Requirement 9: Vertex AI Service Cleanup

**User Story:** As a backend developer, I want to remove unnecessary Gemini API key assignments from VertexAiService, so that the codebase is cleaner and less confusing.

#### Acceptance Criteria

1. THE vertex-ai.service.ts SHALL remove the line process.env.GEMINI_API_KEY = vertexApiKey
2. THE VertexAiService SHALL maintain all existing video generation functionality
3. THE VertexAiService cleanup SHALL not affect video generation capabilities

### Requirement 10: Backward Compatibility

**User Story:** As a backend developer, I want the migration to maintain existing functionality, so that no features are broken during the provider switch.

#### Acceptance Criteria

1. THE LlmService SHALL produce JSON outputs with the same structure as GeminiService
2. THE Consumer_Services SHALL receive responses in the same format as before migration
3. THE System SHALL maintain the same temperature setting (0.7) for consistency
4. THE System SHALL maintain the same JSON response parsing behavior
5. FOR ALL existing LLM-based features, THE System SHALL produce functionally equivalent outputs after migration
