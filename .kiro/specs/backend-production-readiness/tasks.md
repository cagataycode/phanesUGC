# Tasks: Backend Production Readiness

## Phase 1: Monitoring & Observability

- [x] 1.1 Create monitoring module structure
  - [x] 1.1.1 Create `backend/src/monitoring/monitoring.module.ts`
  - [x] 1.1.2 Create `backend/src/monitoring/structured-logger.service.ts`
  - [x] 1.1.3 Create `backend/src/monitoring/performance-monitor.service.ts`
  - [x] 1.1.4 Create `backend/src/monitoring/error-tracker.service.ts`

- [x] 1.2 Implement StructuredLogger service
  - [x] 1.2.1 Add correlation ID generation using UUID
  - [x] 1.2.2 Implement JSON log formatting
  - [x] 1.2.3 Add context enrichment (userId, businessId, jobId, stage)
  - [x] 1.2.4 Add log methods: log, error, logApiCall, logFallback
  - [x] 1.2.5 Write unit tests for StructuredLogger

- [ ] 1.3 Implement PerformanceMonitor service
  - [x] 1.3.1 Add Firebase Performance Monitoring SDK integration
  - [x] 1.3.2 Implement trackLatency, trackCount, startTimer methods
  - [x] 1.3.3 Add metric aggregation and batching
  - [x] 1.3.4 Implement recordToFirebase method
  - [x] 1.3.5 Write unit tests for PerformanceMonitor

- [x] 1.4 Implement ErrorTracker service
  - [x] 1.4.1 Integrate Firebase Crashlytics or Google Cloud Error Reporting
  - [x] 1.4.2 Add error severity classification
  - [x] 1.4.3 Implement error grouping logic
  - [x] 1.4.4 Add alert trigger logic
  - [x] 1.4.5 Write unit tests for ErrorTracker

- [-] 1.5 Integrate logging into agent pipeline
  - [x] 1.5.1 Add correlation ID to AgentJobState
  - [x] 1.5.2 Add logging to AgentOrchestratorService (job start, stage transitions, completion)
  - [x] 1.5.3 Add logging to LLMService (Claude calls, Gemini fallback, token usage)
  - [x] 1.5.4 Add logging to VideoGeneratorService (Veo calls, duration, status)
  - [ ] 1.5.5 Add logging to all stage services

- [ ] 1.6 Add performance tracking
  - [ ] 1.6.1 Track request latency in API controllers
  - [ ] 1.6.2 Track stage durations in AgentOrchestratorService
  - [ ] 1.6.3 Track external API call latencies
  - [ ] 1.6.4 Store performance metrics in AgentJobState

## Phase 2: Cost & Quota Management

- [ ] 2.1 Create cost tracking module
  - [ ] 2.1.1 Create `backend/src/cost/cost.module.ts`
  - [ ] 2.1.2 Create `backend/src/cost/cost-tracker.service.ts`
  - [ ] 2.1.3 Create `backend/src/cost/pricing-config.ts`

- [ ] 2.2 Implement CostTracker service
  - [ ] 2.2.1 Add pricing constants (Veo Fast $0.15/sec, Standard $0.40/sec, Claude/Gemini token rates)
  - [ ] 2.2.2 Implement calculateVeoCost method
  - [ ] 2.2.3 Implement calculateClaudeCost method
  - [ ] 2.2.4 Implement calculateGeminiCost method
  - [ ] 2.2.5 Implement trackApiCall method (store in Firestore)
  - [ ] 2.2.6 Implement getJobCost method
  - [ ] 2.2.7 Implement getBusinessMonthlyCost method
  - [ ] 2.2.8 Write unit tests for cost calculations

- [ ] 2.3 Integrate cost tracking into pipeline
  - [ ] 2.3.1 Add costBreakdown and apiCalls fields to AgentJobState
  - [ ] 2.3.2 Track Veo costs in VideoGeneratorService
  - [ ] 2.3.3 Track Claude costs in LLMService
  - [ ] 2.3.4 Track Gemini costs in LLMService (fallback)
  - [ ] 2.3.5 Calculate total job cost in AgentOrchestratorService
  - [ ] 2.3.6 Store cost data in Firestore project document

- [ ] 2.4 Create quota management module
  - [ ] 2.4.1 Create `backend/src/quota/quota.module.ts`
  - [ ] 2.4.2 Create `backend/src/quota/quota.service.ts`
  - [ ] 2.4.3 Create `backend/src/quota/rate-limiter.service.ts`

- [ ] 2.5 Implement QuotaService
  - [ ] 2.5.1 Define subscription tier limits (Free: 2, Starter: 20, Pro: 40, Enterprise: custom)
  - [ ] 2.5.2 Implement getSubscriptionTier method
  - [ ] 2.5.3 Implement checkQuota method
  - [ ] 2.5.4 Implement canCreateJob method
  - [ ] 2.5.5 Implement incrementUsage method
  - [ ] 2.5.6 Implement resetMonthlyQuotas method
  - [ ] 2.5.7 Write unit tests for QuotaService

- [ ] 2.6 Implement RateLimiter service
  - [ ] 2.6.1 Define rate limit configs per tier
  - [ ] 2.6.2 Implement checkRateLimit method (10 req/min)
  - [ ] 2.6.3 Implement checkConcurrentJobs method
  - [ ] 2.6.4 Implement recordRequest method
  - [ ] 2.6.5 Implement cleanupStaleEntries method
  - [ ] 2.6.6 Write unit tests for RateLimiter

- [ ] 2.7 Integrate quota enforcement
  - [ ] 2.7.1 Add quota check to AdsController.createJob
  - [ ] 2.7.2 Add rate limit check to AdsController
  - [ ] 2.7.3 Return 429 status with descriptive error
  - [ ] 2.7.4 Add X-RateLimit headers to responses
  - [ ] 2.7.5 Increment usage counter on job completion

- [ ] 2.8 Create scheduled functions
  - [ ] 2.8.1 Create Cloud Function for monthly quota reset
  - [ ] 2.8.2 Create Cloud Function for rate limit cleanup
  - [ ] 2.8.3 Schedule functions with Cloud Scheduler

## Phase 3: Security Hardening

- [ ] 3.1 Create security module
  - [ ] 3.1.1 Create `backend/src/security/security.module.ts`
  - [ ] 3.1.2 Create `backend/src/security/input-validator.service.ts`
  - [ ] 3.1.3 Create `backend/src/security/signed-url.service.ts`

- [ ] 3.2 Implement InputValidator service
  - [ ] 3.2.1 Add class-validator decorators to all DTOs
  - [ ] 3.2.2 Add string length validation (prompt: 2000, productName: 200, description: 1000)
  - [ ] 3.2.3 Add enum validation for platform, aspectRatio, tone, language
  - [ ] 3.2.4 Implement sanitizeText method (XSS prevention)
  - [ ] 3.2.5 Implement validateUrl method
  - [ ] 3.2.6 Implement validateFileUpload method (50MB limit, type validation)
  - [ ] 3.2.7 Write unit tests for InputValidator

- [ ] 3.3 Implement SignedUrlService
  - [ ] 3.3.1 Implement generateSignedUrl with configurable expiry (15min/1hr)
  - [ ] 3.3.2 Implement validateAccess method (check user permissions)
  - [ ] 3.3.3 Implement logUrlGeneration for audit trail
  - [ ] 3.3.4 Update GcsStorageService to use SignedUrlService
  - [ ] 3.3.5 Write unit tests for SignedUrlService

- [ ] 3.4 Update API controllers with validation
  - [ ] 3.4.1 Add ValidationPipe to all controllers
  - [ ] 3.4.2 Update CreateAdDto with validation decorators
  - [ ] 3.4.3 Update WizardDto with validation decorators
  - [ ] 3.4.4 Add file upload validation to AssetsController
  - [ ] 3.4.5 Return 400 with validation errors

- [ ] 3.5 Configure CORS and security headers
  - [ ] 3.5.1 Configure CORS whitelist in main.ts
  - [ ] 3.5.2 Add helmet middleware for security headers
  - [ ] 3.5.3 Configure CSP headers
  - [ ] 3.5.4 Add environment-based CORS config

## Phase 4: Payment Integration

- [ ] 4.1 Create payment module
  - [ ] 4.1.1 Create `backend/src/payment/payment.module.ts`
  - [ ] 4.1.2 Create `backend/src/payment/stripe.service.ts`
  - [ ] 4.1.3 Create `backend/src/payment/subscription.controller.ts`
  - [ ] 4.1.4 Create `backend/src/payment/webhook.controller.ts`

- [ ] 4.2 Implement StripeService
  - [ ] 4.2.1 Install and configure Stripe SDK
  - [ ] 4.2.2 Implement createCustomer method
  - [ ] 4.2.3 Implement createCheckoutSession method
  - [ ] 4.2.4 Implement handleWebhook method (signature validation)
  - [ ] 4.2.5 Implement cancelSubscription method
  - [ ] 4.2.6 Implement getBillingPortalUrl method
  - [ ] 4.2.7 Implement validatePromoCode method
  - [ ] 4.2.8 Write unit tests for StripeService

- [ ] 4.3 Implement webhook handlers
  - [ ] 4.3.1 Handle subscription.created event
  - [ ] 4.3.2 Handle subscription.updated event
  - [ ] 4.3.3 Handle subscription.deleted event
  - [ ] 4.3.4 Handle invoice.payment_succeeded event
  - [ ] 4.3.5 Handle invoice.payment_failed event
  - [ ] 4.3.6 Update business subscription in Firestore

- [ ] 4.4 Create subscription API endpoints
  - [ ] 4.4.1 POST /api/v1/subscriptions/checkout
  - [ ] 4.4.2 POST /api/v1/subscriptions/cancel
  - [ ] 4.4.3 GET /api/v1/subscriptions/portal
  - [ ] 4.4.4 POST /api/v1/webhooks/stripe
  - [ ] 4.4.5 POST /api/v1/promo-codes/validate

- [ ] 4.5 Implement promo code system
  - [ ] 4.5.1 Create promo_codes collection schema
  - [ ] 4.5.2 Implement promo code validation
  - [ ] 4.5.3 Track redemption counts
  - [ ] 4.5.4 Apply promo codes in checkout session
  - [ ] 4.5.5 Write integration tests for promo codes

- [ ] 4.6 Update subscription tier resolution
  - [ ] 4.6.1 Update QuotaService to read from subscription document
  - [ ] 4.6.2 Handle subscription status (active, canceled, past_due)
  - [ ] 4.6.3 Downgrade to Free tier on cancellation
  - [ ] 4.6.4 Write integration tests for subscription lifecycle

## Phase 5: Social Publishing

- [ ] 5.1 Create publishing module
  - [ ] 5.1.1 Create `backend/src/publishing/publishing.module.ts`
  - [ ] 5.1.2 Create `backend/src/publishing/tiktok-publisher.service.ts`
  - [ ] 5.1.3 Create `backend/src/publishing/meta-publisher.service.ts`
  - [ ] 5.1.4 Create `backend/src/publishing/scheduler.service.ts`
  - [ ] 5.1.5 Create `backend/src/publishing/publishing.controller.ts`

- [ ] 5.2 Implement TikTokPublisher service
  - [ ] 5.2.1 Install TikTok Content Posting API SDK
  - [ ] 5.2.2 Implement initiateOAuth method
  - [ ] 5.2.3 Implement handleOAuthCallback method
  - [ ] 5.2.4 Implement publishVideo method
  - [ ] 5.2.5 Implement getPublishStatus method
  - [ ] 5.2.6 Implement refreshAccessToken method
  - [ ] 5.2.7 Add token encryption/decryption
  - [ ] 5.2.8 Write unit tests for TikTokPublisher

- [ ] 5.3 Implement MetaPublisher service
  - [ ] 5.3.1 Install Meta Graph API SDK
  - [ ] 5.3.2 Implement initiateOAuth method
  - [ ] 5.3.3 Implement handleOAuthCallback method
  - [ ] 5.3.4 Implement listPages method
  - [ ] 5.3.5 Implement listInstagramAccounts method
  - [ ] 5.3.6 Implement publishVideo method (Facebook and Instagram)
  - [ ] 5.3.7 Implement getPublishStatus method
  - [ ] 5.3.8 Implement refreshAccessToken method
  - [ ] 5.3.9 Add token encryption/decryption
  - [ ] 5.3.10 Write unit tests for MetaPublisher

- [ ] 5.4 Implement SchedulerService
  - [ ] 5.4.1 Create scheduled_posts collection schema
  - [ ] 5.4.2 Implement schedulePost method
  - [ ] 5.4.3 Implement cancelScheduledPost method
  - [ ] 5.4.4 Implement reschedulePost method
  - [ ] 5.4.5 Implement processScheduledPosts method
  - [ ] 5.4.6 Implement getScheduledPosts method
  - [ ] 5.4.7 Write unit tests for SchedulerService

- [ ] 5.5 Create publishing API endpoints
  - [ ] 5.5.1 GET /api/v1/publishing/tiktok/auth
  - [ ] 5.5.2 POST /api/v1/publishing/tiktok/callback
  - [ ] 5.5.3 POST /api/v1/publishing/tiktok/publish
  - [ ] 5.5.4 GET /api/v1/publishing/:publishId/status
  - [ ] 5.5.5 GET /api/v1/publishing/meta/auth
  - [ ] 5.5.6 POST /api/v1/publishing/meta/callback
  - [ ] 5.5.7 GET /api/v1/publishing/meta/pages
  - [ ] 5.5.8 GET /api/v1/publishing/meta/instagram-accounts
  - [ ] 5.5.9 POST /api/v1/publishing/meta/publish

- [ ] 5.6 Create scheduling API endpoints
  - [ ] 5.6.1 POST /api/v1/scheduled-posts
  - [ ] 5.6.2 GET /api/v1/scheduled-posts
  - [ ] 5.6.3 DELETE /api/v1/scheduled-posts/:postId
  - [ ] 5.6.4 PATCH /api/v1/scheduled-posts/:postId

- [ ] 5.7 Create Cloud Function for scheduled posts
  - [ ] 5.7.1 Create Cloud Function triggered every 5 minutes
  - [ ] 5.7.2 Query scheduled_posts for pending posts
  - [ ] 5.7.3 Trigger publishing workflow
  - [ ] 5.7.4 Update post status
  - [ ] 5.7.5 Send notifications on success/failure

- [ ] 5.8 Update Firestore schema
  - [ ] 5.8.1 Add socialConnections to users collection
  - [ ] 5.8.2 Create scheduled_posts collection
  - [ ] 5.8.3 Add encryption for access tokens
  - [ ] 5.8.4 Update security rules

## Phase 6: Testing & Documentation

- [ ] 6.1 Write integration tests
  - [ ] 6.1.1 Test complete wizard flow (brief → script → scene → video)
  - [ ] 6.1.2 Test cost tracking for all API calls
  - [ ] 6.1.3 Test quota enforcement (create jobs until limit)
  - [ ] 6.1.4 Test LLM fallback (Claude failure → Gemini)
  - [ ] 6.1.5 Test publishing workflows (mock APIs)
  - [ ] 6.1.6 Test error recovery and retry logic

- [ ] 6.2 Write E2E tests
  - [ ] 6.2.1 Test user registration → subscription → video generation
  - [ ] 6.2.2 Test wizard flow → job submission → polling → final video
  - [ ] 6.2.3 Test quota exceeded → upgrade → retry
  - [ ] 6.2.4 Test schedule post → trigger → verify published
  - [ ] 6.2.5 Test promo code → subscription → verify discount
  - [ ] 6.2.6 Test authentication and authorization flows

- [ ] 6.3 Conduct load testing
  - [ ] 6.3.1 Set up load testing environment
  - [ ] 6.3.2 Create load test scenarios (50 concurrent jobs)
  - [ ] 6.3.3 Measure latency, throughput, error rate
  - [ ] 6.3.4 Verify rate limiting under load
  - [ ] 6.3.5 Identify bottlenecks and timeout thresholds
  - [ ] 6.3.6 Generate performance report

- [ ] 6.4 Update documentation
  - [ ] 6.4.1 Mark Phase 5 complete in AGENT_INTEGRATION_PLAN.md
  - [ ] 6.4.2 Update firestore_schema.md with new fields
  - [ ] 6.4.3 Add "✅ Implemented" notes to PRD documents
  - [ ] 6.4.4 Remove TTS and legacy sections from PRD_03
  - [ ] 6.4.5 Add single-scene note to PRD_00
  - [ ] 6.4.6 Move DESIGN_SYSTEM.md to frontend/docs/
  - [ ] 6.4.7 Move FRONTEND_AUTH_GUIDE.md to frontend/docs/
  - [ ] 6.4.8 Delete MVP_Technical_PRD.md

- [ ] 6.5 Create API documentation
  - [ ] 6.5.1 Generate OpenAPI/Swagger spec
  - [ ] 6.5.2 Document authentication requirements
  - [ ] 6.5.3 Document rate limits
  - [ ] 6.5.4 Add example requests and responses
  - [ ] 6.5.5 Document error codes

- [ ] 6.6 Create operational runbooks
  - [ ] 6.6.1 Write deployment procedures
  - [ ] 6.6.2 Write rollback procedures
  - [ ] 6.6.3 Write incident response playbook
  - [ ] 6.6.4 Write quota reset procedures
  - [ ] 6.6.5 Write cost optimization guide

## Phase 7: Health & Operations

- [ ] 7.1 Create health module
  - [ ] 7.1.1 Create `backend/src/health/health.module.ts`
  - [ ] 7.1.2 Create `backend/src/health/health-check.service.ts`
  - [ ] 7.1.3 Create `backend/src/health/health.controller.ts`

- [ ] 7.2 Implement HealthCheckService
  - [ ] 7.2.1 Implement checkHealth method
  - [ ] 7.2.2 Implement checkReadiness method
  - [ ] 7.2.3 Implement checkFirestore method
  - [ ] 7.2.4 Implement checkGCS method
  - [ ] 7.2.5 Implement checkVertexAI method
  - [ ] 7.2.6 Implement checkBedrock method
  - [ ] 7.2.7 Write unit tests for HealthCheckService

- [ ] 7.3 Create health endpoints
  - [ ] 7.3.1 GET /api/v1/health (returns 200 if healthy)
  - [ ] 7.3.2 GET /api/v1/ready (returns 200 if ready, 503 if not)
  - [ ] 7.3.3 GET /api/v1/metrics (Prometheus-compatible, admin only)
  - [ ] 7.3.4 GET /api/v1/config (non-sensitive config, admin only)

- [ ] 7.4 Implement graceful shutdown
  - [ ] 7.4.1 Add SIGTERM signal handler
  - [ ] 7.4.2 Stop accepting new requests on shutdown
  - [ ] 7.4.3 Wait for in-flight requests (30s timeout)
  - [ ] 7.4.4 Close database connections
  - [ ] 7.4.5 Log shutdown process
  - [ ] 7.4.6 Return 503 for new requests during shutdown

- [ ] 7.5 Implement configuration management
  - [ ] 7.5.1 Add Google Secret Manager integration
  - [ ] 7.5.2 Load secrets in production
  - [ ] 7.5.3 Validate required config at startup
  - [ ] 7.5.4 Fail fast with descriptive errors
  - [ ] 7.5.5 Support dev/staging/prod environments

- [ ] 7.6 Implement API versioning
  - [ ] 7.6.1 Prefix all routes with /api/v1/
  - [ ] 7.6.2 Add API-Version header to responses
  - [ ] 7.6.3 Create GET /api/versions endpoint
  - [ ] 7.6.4 Document versioning strategy
  - [ ] 7.6.5 Log API version for each request

- [ ] 7.7 Deploy to staging
  - [ ] 7.7.1 Configure staging environment
  - [ ] 7.7.2 Run all tests
  - [ ] 7.7.3 Build and deploy
  - [ ] 7.7.4 Run smoke tests
  - [ ] 7.7.5 Monitor for 24 hours

- [ ] 7.8 Deploy to production
  - [ ] 7.8.1 Configure production environment
  - [ ] 7.8.2 Run all tests
  - [ ] 7.8.3 Build and deploy with canary (10% traffic)
  - [ ] 7.8.4 Monitor metrics and errors
  - [ ] 7.8.5 Gradually increase to 100%
  - [ ] 7.8.6 Keep previous versions for rollback

## Phase 8: Monitoring & Alerting Setup

- [ ] 8.1 Configure monitoring dashboards
  - [ ] 8.1.1 Create System Health dashboard
  - [ ] 8.1.2 Create Cost Analytics dashboard
  - [ ] 8.1.3 Create Usage Metrics dashboard
  - [ ] 8.1.4 Create LLM Performance dashboard
  - [ ] 8.1.5 Create Publishing dashboard

- [ ] 8.2 Configure alert rules
  - [ ] 8.2.1 Set up critical alerts (system down, all APIs down)
  - [ ] 8.2.2 Set up high alerts (Veo down, payment failures, high error rate)
  - [ ] 8.2.3 Set up medium alerts (high fallback rate, quota reset failed)
  - [ ] 8.2.4 Set up low alerts (job failures, validation errors)

- [ ] 8.3 Configure alert channels
  - [ ] 8.3.1 Set up email alerts
  - [ ] 8.3.2 Set up Slack integration
  - [ ] 8.3.3 Configure on-call rotation
  - [ ] 8.3.4 Test alert delivery

- [ ] 8.4 Set up log aggregation
  - [ ] 8.4.1 Configure Cloud Logging
  - [ ] 8.4.2 Set up log retention policies
  - [ ] 8.4.3 Create saved queries for common issues
  - [ ] 8.4.4 Set up log-based metrics

- [ ] 8.5 Final validation
  - [ ] 8.5.1 Verify all monitoring is working
  - [ ] 8.5.2 Verify all alerts are configured
  - [ ] 8.5.3 Verify all dashboards are accessible
  - [ ] 8.5.4 Conduct incident simulation
  - [ ] 8.5.5 Update runbooks based on findings
