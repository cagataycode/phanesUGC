# Requirements Document: Backend Production Readiness

## Introduction

This feature transforms the MVP backend of the AI video ad generation platform into a production-ready system. The backend currently supports the complete agent pipeline (Phase 5 complete) using NestJS, Firebase, Veo 3.1, AWS Bedrock Claude Sonnet 4.6 (with Gemini 2.5 Pro fallback), and Remotion. The system includes a wizard-based ad creation flow that guides users through brief, script, and scene generation before final video rendering. This feature adds monitoring, cost optimization, security hardening, payment integration, social media publishing, and comprehensive testing to prepare the system for production deployment.

## Glossary

- **Backend**: The NestJS-based server application that orchestrates the AI ad generation pipeline
- **Agent_Pipeline**: The multi-stage workflow that converts user prompts into rendered video ads
- **Veo**: Google's Veo 3.1 AI video generation service accessed via Vertex AI
- **Claude**: Anthropic's Claude Sonnet 4.6 LLM accessed via AWS Bedrock (primary LLM provider)
- **Gemini**: Google's Gemini 2.5 Pro LLM (fallback LLM provider when Claude fails)
- **LLM_Service**: Unified LLM service with automatic fallback from Claude to Gemini
- **Firestore**: Google Cloud Firestore NoSQL database for persistence
- **GCS**: Google Cloud Storage for asset and video storage
- **Signed_URL**: Time-limited authenticated URL for accessing GCS resources
- **Usage_Quota**: Monthly video generation limit based on subscription tier
- **Subscription_Tier**: User plan level (Free, Starter, Pro, Enterprise)
- **Cost_Tracking**: Per-job monitoring of API costs (Veo, Gemini)
- **Rate_Limiting**: Request throttling to prevent abuse and manage costs
- **Monitoring_System**: Observability infrastructure for logging, metrics, and alerting
- **Social_Platform**: TikTok, Facebook, or Instagram destination for video publishing
- **Payment_System**: Stripe-based subscription and billing management
- **Promo_Code**: Discount code for beta testers and promotional campaigns

## Requirements

### Requirement 1: Structured Logging and Observability

**User Story:** As a platform operator, I want structured JSON logging throughout the backend, so that I can monitor system health and debug issues efficiently.

#### Acceptance Criteria

1. THE Backend SHALL emit all logs in JSON format using the NestJS Logger
2. WHEN a request is received, THE Backend SHALL assign a unique correlation ID that propagates through all stages
3. THE Backend SHALL log the following events: request start, stage transitions, external API calls (Veo, Claude, Gemini), errors, and request completion
4. FOR ALL log entries, THE Backend SHALL include: timestamp, level, correlation ID, stage name, and message
5. WHEN an external API call is made, THE Backend SHALL log: service name (Veo/Claude/Gemini), operation, latency, response status, and whether fallback was triggered
6. THE Backend SHALL integrate with Firebase Performance Monitoring for latency tracking
7. THE Backend SHALL track the following metrics: request latency, stage duration, Veo generation time, Claude call latency, Gemini fallback rate, LLM success rate, and error rate by provider

### Requirement 2: Cost Tracking Per Job

**User Story:** As a platform operator, I want to track API costs for each video generation job, so that I can understand unit economics and optimize spending.

#### Acceptance Criteria

1. WHEN a Veo API call completes, THE Backend SHALL calculate the cost based on video duration and quality tier
2. WHEN a Claude API call completes, THE Backend SHALL calculate the cost based on token usage
3. WHEN a Gemini API call completes (fallback), THE Backend SHALL calculate the cost based on token usage
4. THE Backend SHALL store the total cost for each job in the project document
5. THE Backend SHALL track costs separately for: Veo generation, Claude/Gemini calls (brief, script, scene prompts), and total job cost
6. THE Backend SHALL use the following pricing: Veo Fast ($0.15/sec), Veo Standard ($0.40/sec), Claude Sonnet 4.6 (AWS Bedrock token rates), Gemini 2.5 Pro (input/output token rates)
7. THE Backend SHALL expose cost data via the project status API endpoint
8. THE Backend SHALL aggregate monthly cost totals per business for reporting
9. THE Backend SHALL track which LLM provider was used (Claude primary or Gemini fallback) for cost attribution

### Requirement 3: Usage Quotas and Enforcement

**User Story:** As a platform operator, I want to enforce monthly video generation limits based on subscription tiers, so that I can manage costs and align with the pricing model.

#### Acceptance Criteria

1. THE Backend SHALL enforce the following monthly quotas: Free tier (2 videos), Starter tier (20 videos), Pro tier (40 videos), Enterprise tier (custom limit)
2. WHEN a user creates a video generation job, THE Backend SHALL check the business usage counter against the subscription tier limit
3. IF the monthly quota is exceeded, THEN THE Backend SHALL reject the request with a 429 status code and descriptive error message
4. THE Backend SHALL increment the usage counter when a video generation job completes successfully
5. THE Backend SHALL reset usage counters on the first day of each calendar month
6. THE Backend SHALL store the current period start date in the business document for quota tracking
7. WHERE a business has an Enterprise subscription, THE Backend SHALL use the custom seat-based limit from the subscription document
8. THE Backend SHALL apply watermarks to Free tier video outputs

### Requirement 4: Rate Limiting Per User

**User Story:** As a platform operator, I want to rate limit requests per user and workspace, so that I can prevent abuse and manage API costs.

#### Acceptance Criteria

1. THE Backend SHALL implement rate limiting using Firestore-based queue tracking
2. THE Backend SHALL enforce the following limits: Free tier (2 concurrent jobs), Starter tier (3 concurrent jobs), Pro tier (5 concurrent jobs), Enterprise tier (10 concurrent jobs)
3. WHEN a user submits a job, THE Backend SHALL check the count of active jobs for that business
4. IF the concurrent job limit is exceeded, THEN THE Backend SHALL reject the request with a 429 status code
5. THE Backend SHALL use Cloud Functions scheduler to periodically clean up stale job entries
6. THE Backend SHALL implement per-user API request rate limiting: 10 requests per minute for authenticated users
7. THE Backend SHALL return rate limit headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset

### Requirement 5: GCS Signed URL Security

**User Story:** As a security engineer, I want short-lived signed URLs for all GCS resources, so that I can minimize the risk of unauthorized access.

#### Acceptance Criteria

1. THE Backend SHALL generate signed URLs with 15-minute expiry for temporary access
2. THE Backend SHALL generate signed URLs with 1-hour expiry for video playback
3. THE Backend SHALL never store signed URLs in Firestore (only GCS storage keys)
4. WHEN a client requests a project result, THE Backend SHALL generate fresh signed URLs on-demand
5. THE Backend SHALL use service account credentials for signed URL generation
6. THE Backend SHALL validate that the requesting user has access to the business before generating signed URLs
7. THE Backend SHALL log all signed URL generation events for audit purposes

### Requirement 6: Input Validation and Security Hardening

**User Story:** As a security engineer, I want comprehensive input validation on all API endpoints, so that I can prevent injection attacks and malformed requests.

#### Acceptance Criteria

1. THE Backend SHALL validate all DTO fields using class-validator decorators
2. THE Backend SHALL reject requests with invalid enum values for platform, aspectRatio, tone, and language
3. THE Backend SHALL enforce string length limits: prompt (max 2000 chars), productName (max 200 chars), description (max 1000 chars)
4. THE Backend SHALL sanitize all user-provided text inputs to prevent XSS attacks
5. THE Backend SHALL validate URL formats for productUrls and webhookUrl fields
6. THE Backend SHALL reject file uploads exceeding 50MB
7. THE Backend SHALL validate file types for uploads: images (jpg, png, webp), videos (mp4, mov)
8. THE Backend SHALL configure CORS to allow only whitelisted frontend origins in production

### Requirement 7: Stripe Payment Integration

**User Story:** As a user, I want to subscribe to a paid plan using Stripe, so that I can access higher usage limits and premium features.

#### Acceptance Criteria

1. THE Backend SHALL integrate with Stripe API for subscription management
2. WHEN a user subscribes, THE Backend SHALL create a Stripe customer and subscription
3. THE Backend SHALL store Stripe customer ID and subscription ID in the user or business document
4. THE Backend SHALL support the following subscription tiers: Starter ($29/month), Pro ($79/month), Enterprise (custom pricing)
5. THE Backend SHALL handle Stripe webhook events: subscription created, updated, canceled, payment succeeded, payment failed
6. WHEN a subscription is canceled, THE Backend SHALL downgrade the user to Free tier at the end of the billing period
7. THE Backend SHALL expose API endpoints for: creating checkout session, managing subscription, retrieving billing portal URL
8. THE Backend SHALL validate webhook signatures to prevent spoofing

### Requirement 8: Promo Code System

**User Story:** As a marketing manager, I want to create promo codes for beta testers, so that I can offer discounts and incentivize early adoption.

#### Acceptance Criteria

1. THE Backend SHALL support Stripe promo codes for subscription discounts
2. WHEN a user applies a promo code, THE Backend SHALL validate it with Stripe before creating the subscription
3. THE Backend SHALL support the following discount types: percentage off, fixed amount off, free trial extension
4. THE Backend SHALL store promo code usage in Firestore for analytics
5. THE Backend SHALL expose an API endpoint to validate promo codes before checkout
6. THE Backend SHALL apply promo codes during Stripe checkout session creation
7. THE Backend SHALL track promo code redemption counts and revenue impact

### Requirement 9: TikTok Publishing Integration

**User Story:** As a user, I want to publish generated videos directly to TikTok, so that I can streamline my content workflow.

#### Acceptance Criteria

1. THE Backend SHALL integrate with TikTok Content Posting API
2. WHEN a user initiates TikTok publishing, THE Backend SHALL redirect to TikTok OAuth flow for authorization
3. THE Backend SHALL store TikTok access tokens securely in Firestore with encryption
4. WHEN a video is ready, THE Backend SHALL upload the video to TikTok using the Content Posting API
5. THE Backend SHALL support setting video metadata: caption, privacy level, and duet/stitch settings
6. THE Backend SHALL track publishing status: pending, uploading, published, failed
7. THE Backend SHALL handle token refresh for expired TikTok access tokens
8. THE Backend SHALL expose API endpoints for: initiating OAuth, handling callback, publishing video, checking status

### Requirement 10: Meta (Facebook/Instagram) Publishing Integration

**User Story:** As a user, I want to publish generated videos to Facebook and Instagram, so that I can reach audiences on multiple platforms.

#### Acceptance Criteria

1. THE Backend SHALL integrate with Meta Graph API for video publishing
2. WHEN a user initiates Meta publishing, THE Backend SHALL redirect to Facebook OAuth flow for authorization
3. THE Backend SHALL request the following permissions: pages_manage_posts, instagram_basic, instagram_content_publish
4. THE Backend SHALL store Meta access tokens securely in Firestore with encryption
5. WHEN a video is ready, THE Backend SHALL upload the video to Facebook Pages or Instagram using the Graph API
6. THE Backend SHALL support setting video metadata: caption, location tag, and audience targeting
7. THE Backend SHALL track publishing status: pending, uploading, published, failed
8. THE Backend SHALL handle token refresh for expired Meta access tokens
9. THE Backend SHALL expose API endpoints for: initiating OAuth, handling callback, listing pages/accounts, publishing video, checking status

### Requirement 11: Post Scheduling System

**User Story:** As a user, I want to schedule video posts for future publication, so that I can plan my content calendar in advance.

#### Acceptance Criteria

1. THE Backend SHALL store scheduled posts in Firestore with: projectId, platform, scheduledTime, status, and metadata
2. THE Backend SHALL use Cloud Functions scheduled trigger to check for pending posts every 5 minutes
3. WHEN a scheduled post time is reached, THE Backend SHALL trigger the publishing workflow for the specified platform
4. THE Backend SHALL update post status to: scheduled, publishing, published, failed
5. THE Backend SHALL support canceling scheduled posts before the scheduled time
6. THE Backend SHALL support rescheduling posts to a different time
7. THE Backend SHALL send notifications when scheduled posts are published or fail

### Requirement 12: Integration Testing for Full Pipeline

**User Story:** As a developer, I want integration tests for the complete agent pipeline, so that I can verify end-to-end functionality.

#### Acceptance Criteria

1. THE Backend SHALL include integration tests that execute the full pipeline from wizard brief generation to rendered video
2. THE Integration_Tests SHALL use test fixtures for: sample prompts, mock product data, and expected outputs
3. THE Integration_Tests SHALL verify that all pipeline stages complete successfully (brief → script → scene → video → render)
4. THE Integration_Tests SHALL validate that the final video file exists in GCS and has the correct duration
5. THE Integration_Tests SHALL verify that subtitles are generated and synchronized correctly
6. THE Integration_Tests SHALL test error recovery: retry logic, fallback policies (Claude → Gemini), and graceful degradation
7. THE Integration_Tests SHALL run in a dedicated test environment with isolated Firestore and GCS resources
8. THE Integration_Tests SHALL verify wizard flow: brief generation, script generation, scene generation, and job submission

### Requirement 13: E2E Testing for Critical Paths

**User Story:** As a QA engineer, I want end-to-end tests for critical user workflows, so that I can ensure the system works correctly from the user perspective.

#### Acceptance Criteria

1. THE Backend SHALL include E2E tests for: user registration, subscription creation, wizard-based video generation, and video retrieval
2. THE E2E_Tests SHALL use real Firebase Auth, Firestore, and GCS services in a test environment
3. THE E2E_Tests SHALL verify API response formats and status codes for wizard endpoints (/wizard/brief, /wizard/script, /wizard/scene, /ads/wizard)
4. THE E2E_Tests SHALL test authentication and authorization: valid tokens, expired tokens, missing tokens, insufficient permissions
5. THE E2E_Tests SHALL test quota enforcement: exceeding monthly limits, concurrent job limits
6. THE E2E_Tests SHALL test payment flows: successful subscription, failed payment, subscription cancellation
7. THE E2E_Tests SHALL run automatically in CI/CD pipeline before deployment
8. THE E2E_Tests SHALL test LLM fallback behavior: Claude success, Claude failure with Gemini fallback

### Requirement 14: Load Testing for Veo API Limits

**User Story:** As a platform operator, I want to understand system behavior under load, so that I can plan capacity and identify bottlenecks.

#### Acceptance Criteria

1. THE Backend SHALL be tested with concurrent video generation requests up to 50 simultaneous jobs
2. THE Load_Tests SHALL measure: request latency, throughput, error rate, and resource utilization
3. THE Load_Tests SHALL identify the maximum sustainable concurrent job count
4. THE Load_Tests SHALL verify that rate limiting correctly throttles requests under high load
5. THE Load_Tests SHALL verify that the queue system handles backpressure gracefully
6. THE Load_Tests SHALL measure Veo API response times and identify timeout thresholds
7. THE Load_Tests SHALL produce a performance report with recommendations for scaling

### Requirement 15: Documentation Cleanup

**User Story:** As a developer, I want accurate and up-to-date documentation, so that I can understand the system architecture and implementation status.

#### Acceptance Criteria

1. THE Backend SHALL update AGENT_INTEGRATION_PLAN.md to mark Phase 5 as complete
2. THE Backend SHALL update firestore_schema.md to document that structuredPrompt, negativePrompt, and generationConfig are stored in the scene schema
3. THE Backend SHALL add "✅ Implemented" inline notes to all completed features in PRD documents (00, 01, 02, 03, 04, 05, 00_5)
4. THE Backend SHALL remove TTS and legacy sections from PRD_03 that are no longer applicable
5. THE Backend SHALL add a note to PRD_00 clarifying that the MVP is single-scene only (multi-scene is future work)
6. THE Backend SHALL move DESIGN_SYSTEM.md to frontend/docs/ directory
7. THE Backend SHALL move FRONTEND_AUTH_GUIDE.md to frontend/docs/ directory
8. THE Backend SHALL delete MVP_Technical_PRD.md as it is superseded by the current PRD structure

### Requirement 16: Error Tracking and Alerting

**User Story:** As a platform operator, I want to be alerted when critical errors occur, so that I can respond quickly to production issues.

#### Acceptance Criteria

1. THE Backend SHALL integrate with Firebase Crashlytics or Google Cloud Error Reporting for error tracking
2. WHEN a critical error occurs, THE Backend SHALL log the full error context: stack trace, correlation ID, user ID, and request parameters
3. THE Backend SHALL define the following error severity levels: critical (system down), high (feature broken), medium (degraded performance), low (minor issue)
4. THE Backend SHALL send alerts for critical and high severity errors via email or Slack
5. THE Backend SHALL group similar errors to prevent alert fatigue
6. THE Backend SHALL track error frequency and trends over time
7. THE Backend SHALL expose an error dashboard for monitoring error rates by stage and error type

### Requirement 17: Health Check and Readiness Endpoints

**User Story:** As a DevOps engineer, I want health check endpoints, so that I can monitor service availability and configure load balancer health checks.

#### Acceptance Criteria

1. THE Backend SHALL expose a GET /health endpoint that returns 200 OK when the service is healthy
2. THE Backend SHALL expose a GET /ready endpoint that returns 200 OK when the service is ready to accept traffic
3. THE Readiness_Endpoint SHALL verify connectivity to: Firestore, GCS, Vertex AI (Gemini and Veo)
4. IF any dependency is unavailable, THEN THE Readiness_Endpoint SHALL return 503 Service Unavailable
5. THE Health_Endpoint SHALL respond within 100ms
6. THE Backend SHALL expose a GET /metrics endpoint for Prometheus-compatible metrics (optional for MVP)
7. THE Backend SHALL log health check failures for debugging

### Requirement 18: Configuration Management

**User Story:** As a developer, I want environment-based configuration, so that I can deploy the same codebase to development, staging, and production environments.

#### Acceptance Criteria

1. THE Backend SHALL use environment variables for all configuration: API keys, database URLs, storage buckets, and feature flags
2. THE Backend SHALL load configuration from .env files in development and from Google Secret Manager in production
3. THE Backend SHALL validate that all required configuration values are present at startup
4. IF required configuration is missing, THEN THE Backend SHALL fail to start with a descriptive error message
5. THE Backend SHALL support the following environments: development, staging, production
6. THE Backend SHALL use different Firebase projects and GCS buckets for each environment
7. THE Backend SHALL expose a GET /config endpoint (authenticated) that returns non-sensitive configuration for debugging

### Requirement 19: Graceful Shutdown

**User Story:** As a DevOps engineer, I want the backend to shut down gracefully, so that in-flight requests complete before the process terminates.

#### Acceptance Criteria

1. WHEN a SIGTERM signal is received, THE Backend SHALL stop accepting new requests
2. THE Backend SHALL wait for all in-flight requests to complete before shutting down
3. THE Backend SHALL set a shutdown timeout of 30 seconds
4. IF the shutdown timeout is exceeded, THEN THE Backend SHALL force-terminate remaining requests
5. THE Backend SHALL close all database connections and external service clients during shutdown
6. THE Backend SHALL log the shutdown process: signal received, waiting for requests, shutdown complete
7. THE Backend SHALL return 503 Service Unavailable for new requests during shutdown

### Requirement 20: API Versioning

**User Story:** As a developer, I want API versioning support, so that I can evolve the API without breaking existing clients.

#### Acceptance Criteria

1. THE Backend SHALL prefix all API routes with /api/v1/
2. THE Backend SHALL support multiple API versions simultaneously (v1, v2, etc.)
3. WHEN a new API version is introduced, THE Backend SHALL maintain backward compatibility for the previous version for at least 6 months
4. THE Backend SHALL document API version deprecation timelines in the API documentation
5. THE Backend SHALL return an API-Version header in all responses
6. THE Backend SHALL log the API version used for each request
7. THE Backend SHALL expose a GET /api/versions endpoint that lists all supported API versions and their deprecation status

### Requirement 21: LLM Provider Monitoring and Fallback Tracking

**User Story:** As a platform operator, I want to monitor LLM provider health and fallback rates, so that I can identify reliability issues and optimize costs.

#### Acceptance Criteria

1. THE Backend SHALL track the success rate of Claude (primary LLM provider) separately from Gemini (fallback)
2. WHEN Claude fails and Gemini fallback is triggered, THE Backend SHALL log the failure reason and fallback event
3. THE Backend SHALL calculate and expose metrics for: Claude success rate, Gemini fallback rate, total LLM failures
4. THE Backend SHALL alert when Claude failure rate exceeds 10% over a 1-hour window
5. THE Backend SHALL store LLM provider information (claude/gemini) in job metadata for cost analysis
6. THE Backend SHALL expose a dashboard showing LLM provider usage distribution and costs
7. THE Backend SHALL log AWS Bedrock credential initialization status (explicit credentials vs IAM role)
