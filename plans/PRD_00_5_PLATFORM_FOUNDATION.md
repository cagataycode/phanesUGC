# Stage 0.5 — Platform Foundation

**Parent Document:** `PRD_00_OVERVIEW.md`  
**Stage Position:** `created → platform_ready`  
**Audience:** Product, Backend, Frontend, DevOps, Billing

---

## 1. Stage Objective

Establish the production platform foundation required before the ad-generation pipeline is considered production-ready.

Stage 0.5 exists to support a **B2C + B2B** product model and covers the non-creative but product-critical systems that every later phase depends on:

- authentication
- persistence
- workspace / account ownership
- memberships and roles
- subscription and billing state
- entitlement resolution
- usage metering
- storage ownership and access control

The creative pipeline begins only after a request has valid platform context and can transition into `platform_ready`.

---

## 2. Scope of Stage 0.5

### In Scope

- Firebase Auth integration
- Firestore document model
- account / workspace model
- user membership model
- role-based access model
- Stripe-backed subscription model
- entitlement resolution service
- usage event tracking for premium operations
- storage ownership model for assets and outputs
- internal developer/test entitlement overrides

### Out of Scope

- creative brief generation
- prompt parsing
- scraping and product extraction
- script generation
- scene planning
- media generation
- subtitle generation
- rendering

These are handled by later PRD phases after Stage 0.5 is satisfied.

---

## 3. Core Platform Principles

### 3.1 Product Model

The system must support both:

- **B2C**: a single-user personal workspace
- **B2B**: a shared workspace/account with multiple members

The same ownership model should handle both cases.

### 3.2 Canonical Ownership Rule

All core resources belong to an `account_id` / workspace, not directly to a single user.

This includes:

- ad jobs
- product links
- product assets
- avatars
- pre-made templates / dynamic JSON scripts
- uploaded assets
- generated artifacts
- subscription records
- usage counters

A B2C user is represented as a single-member workspace.

### 3.3 Separation of Concerns

- **Firebase Auth** is the identity source
- **Firestore** is the application state store
- **Stripe** is the billing source of truth
- **Entitlement resolution** is done in backend application logic
- **Agent Orchestrator** consumes platform context but does not own billing logic

---

## 4. Authentication

### 4.1 Identity Provider

**Provider:** Firebase Auth

Supported authentication modes for MVP-to-v1 progression:

- email/password
- Google sign-in
- magic link or passwordless (optional)

### 4.2 Backend Authentication Flow

1. Frontend authenticates user with Firebase Auth
2. Frontend sends Firebase ID token to backend
3. NestJS backend verifies token
4. Backend resolves user identity and workspace membership
5. Backend builds `PlatformContext`
6. Request may proceed only if platform resolution succeeds

### 4.3 PlatformContext

Every authenticated request should resolve a platform context object similar to:

```json
{
  "user_id": "user_123",
  "account_id": "acct_456",
  "role": "owner",
  "subscription_tier": "pro",
  "entitlements": {
    "can_generate_ads": true,
    "can_render_final": true,
    "can_regenerate_scene": true,
    "max_duration_sec": 60
  },
  "entitlement_source": "subscription"
}
```

### 4.4 Auth Failure Rules

| Failure                                  | Behavior                                               |
| ---------------------------------------- | ------------------------------------------------------ |
| Missing token                            | Reject with `401`                                      |
| Invalid token                            | Reject with `401`                                      |
| User exists but has no workspace/account | Reject with `403` or auto-provision personal workspace |
| User not entitled for requested action   | Reject with `403`                                      |

---

## 5. Account / Workspace Model

### 5.1 Why Workspace Ownership Exists

Because the product is both B2C and B2B, every asset and job must be scoped to a workspace/account.

### 5.2 Core Entities

#### User

- authenticated identity
- profile metadata
- references one or more memberships

#### Account / Workspace

- canonical owner of all business resources
- has subscription state
- has usage counters
- may contain one or more users

#### Membership

- joins a user to an account/workspace
- stores role and status

### 5.3 Suggested Roles

- `owner`
- `admin`
- `member`
- `viewer` (optional)
- `internal_tester`

### 5.4 Role Expectations

| Role              | Permissions                                                                   |
| ----------------- | ----------------------------------------------------------------------------- |
| `owner`           | billing, members, all creative actions                                        |
| `admin`           | most creative and workspace actions, no destructive billing ownership changes |
| `member`          | create jobs, view results, upload assets                                      |
| `viewer`          | read-only access                                                              |
| `internal_tester` | access premium/internal paths in non-production environments                  |

---

## 6. Firestore Data Model

### 6.1 Guiding Rule

Firestore stores operational state and ownership metadata. Large files live in object storage.

### 6.2 Suggested Collections

```text
users/{userId}
accounts/{accountId}
accounts/{accountId}/memberships/{membershipId}
accounts/{accountId}/subscriptions/{subscriptionId}
accounts/{accountId}/usage/{usagePeriodId}
accounts/{accountId}/product-assets/{assetId}
accounts/{accountId}/avatars/{avatarId}
accounts/{accountId}/templates/{templateId}
ads/{adId}
ads/{adId}/artifacts/{artifactId}
ads/{adId}/scenes/{sceneId}
links/{linkId}
```

### 6.3 Document Ownership Requirements

Each business document must contain at minimum:

- `account_id`
- `created_by_user_id`
- `created_at`
- `updated_at`

### 6.4 Ad Document Example

```json
{
  "id": "ad_123",
  "account_id": "acct_456",
  "created_by_user_id": "user_123",
  "status": "normalized",
  "current_stage": "context",
  "subscription_tier": "pro",
  "progress": 0.2,
  "input": {
    "prompt": "Create a 30 second TikTok ad for our skincare serum",
    "platform": "tiktok",
    "aspect_ratio": "9:16",
    "duration_sec": 30,
    "language": "en"
  },
  "artifacts": {
    "normalized_request": true,
    "product_context": false
  }
}
```

### 6.5 Storage Strategy

Use Firestore for:

- job state
- stage progress
- ownership metadata
- subscription state mirror
- artifact references
- product asset metadata
- avatar metadata
- template metadata and JSON configuration
- usage counters

Use object storage for:

- uploaded assets
- product images and videos
- avatar source media and derived avatar assets
- raw scraped HTML snapshots
- generated images/videos/audio
- template preview images and packaged template media assets
- subtitle JSON blobs if large
- final outputs and thumbnails

### 6.6 Additional First-Class Content Types

#### ProductAsset

Product assets are reusable brand/product media uploaded or managed at the account/workspace level.

Examples:

- product images
- product demo videos
- logos
- brand backgrounds
- packaging shots

Suggested metadata:

```json
{
  "id": "asset_123",
  "account_id": "acct_456",
  "type": "image",
  "category": "product",
  "label": "Hero bottle front shot",
  "storage_key": "accounts/acct_456/product-assets/hero-bottle.jpg",
  "tags": ["skincare", "hero", "bottle"],
  "created_by_user_id": "user_123"
}
```

#### Avatar

Avatars are reusable presenter/persona assets available to an account/workspace.

They may be:

- system-provided
- workspace-custom
- future AI-generated / trained personas

Suggested metadata:

```json
{
  "id": "avatar_123",
  "account_id": "acct_456",
  "name": "Aylin Presenter",
  "source": "custom",
  "status": "ready",
  "preview_storage_key": "accounts/acct_456/avatars/aylin-preview.mp4",
  "config_json": {
    "gender": "female",
    "language": "en",
    "style": "studio"
  }
}
```

#### Template

Templates are reusable pre-made dynamic JSON scripts / composition definitions that can seed or constrain ad generation.

Templates may define:

- scene structure
- overlay rules
- CTA layout
- animation presets
- subtitle style presets
- avatar placement rules
- render composition defaults

Suggested metadata:

```json
{
  "id": "template_123",
  "account_id": "acct_456",
  "name": "Dynamic Product Demo",
  "type": "dynamic_json_script",
  "status": "active",
  "template_json": {
    "scene_pattern": ["hook", "benefit", "benefit", "cta"],
    "subtitle_style": "kinetic",
    "cta_position": "center"
  },
  "preview_image_key": "accounts/acct_456/templates/dynamic-product-demo.png"
}
```

---

## 7. Billing and Subscription Model

### 7.1 Billing Provider

**Provider:** Stripe

Stripe is the billing source of truth for customer-facing plans.

### 7.2 Subscription Ownership

Subscriptions belong to the `account_id` / workspace, not directly to an individual user.

### 7.3 Initial Plan Model

Suggested initial plans:

- `free`
- `pro`
- `team`
- `enterprise`

### 7.4 Subscription Mirror in Firestore

Stripe remains the billing source of truth, but the backend maintains a mirrored Firestore record for fast entitlement checks.

Suggested mirrored fields:

```json
{
  "account_id": "acct_456",
  "stripe_customer_id": "cus_123",
  "stripe_subscription_id": "sub_123",
  "plan": "pro",
  "status": "active",
  "current_period_end": "2026-04-30T23:59:59Z",
  "cancel_at_period_end": false
}
```

### 7.5 Required Stripe Flows

- checkout session creation
- customer portal access
- webhook ingestion
- subscription status sync
- upgrade / downgrade handling
- cancellation handling

### 7.6 Stripe Webhooks

At minimum handle:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

Webhook processing must update the Firestore subscription mirror.

---

## 8. Entitlements and Usage Enforcement

### 8.1 Why Entitlements Exist

The creative pipeline should not talk directly to Stripe. It should ask a backend entitlement layer whether a requested action is allowed.

### 8.2 Entitlement Sources

Valid entitlement sources are:

- `subscription`
- `internal_override`
- `test_fixture`

### 8.3 Example Controlled Actions

- create ad job
- render final output
- generate preview
- regenerate scene
- regenerate full ad
- use longer durations
- use premium output styles

### 8.4 Example Entitlement Matrix

| Capability          | Free    | Pro | Team | Enterprise |
| ------------------- | ------- | --- | ---- | ---------- |
| Create ads          | Limited | Yes | Yes  | Yes        |
| Max duration 60 sec | No      | Yes | Yes  | Yes        |
| Final render        | Limited | Yes | Yes  | Yes        |
| Scene regeneration  | No      | Yes | Yes  | Yes        |
| Team members        | No      | No  | Yes  | Yes        |

### 8.5 Usage Metering

Every premium-costing action should emit a usage event with:

- `account_id`
- `user_id`
- `action_type`
- `resource_id`
- `units`
- `timestamp`

These events are used for quotas, analytics, and future billing logic.

---

## 9. Developer and Test Overrides

### 9.1 Principle

Internal development must not require real paid subscriptions.

### 9.2 Allowed Non-Production Entitlement Paths

In development and staging, the backend may permit access through:

- internal workspace flag
- `internal_tester` role
- seeded subscription state
- feature flag override
- Stripe test mode

### 9.3 Entitlement Resolution Rule

The backend resolves entitlements in this order:

1. internal override (non-production only)
2. test fixture / seeded plan (non-production only)
3. Stripe-backed subscription state

### 9.4 Production Rule

Production customer access must not rely on override paths except for explicitly authorized internal staff accounts.

---

## 10. Storage Ownership and Access Control

### 10.1 Ownership Rule

Every stored object must be traceable to:

- `account_id`
- `ad_id` or `link_id`
- `created_by_user_id`

### 10.2 Suggested Object Paths

```text
accounts/{accountId}/ads/{adId}/assets/...
accounts/{accountId}/ads/{adId}/scenes/...
accounts/{accountId}/ads/{adId}/output/...
accounts/{accountId}/links/{linkId}/raw/...
```

### 10.3 Access Policy

- users may access only objects owned by accounts they belong to
- output delivery should prefer signed URLs or controlled backend mediation
- raw internal artifacts may remain backend-only

---

## 11. Stage Transition to `platform_ready`

Before a request can enter Phase 1, the platform layer must confirm:

- user is authenticated
- account/workspace is resolved
- membership is active
- subscription or override entitlement exists for the requested action
- persistence layer is available
- storage ownership path can be established

When these checks pass, the request is considered `platform_ready`.

---

## 12. Backend Services Required

| Service                   | Responsibility                                                         |
| ------------------------- | ---------------------------------------------------------------------- |
| `AuthService`             | Verify Firebase ID tokens and resolve user identity                    |
| `PlatformContextService`  | Resolve user, workspace, role, entitlements, and environment overrides |
| `WorkspaceService`        | Account/workspace creation and membership management                   |
| `SubscriptionService`     | Stripe integration and subscription mirror sync                        |
| `EntitlementService`      | Plan capability checks and access enforcement                          |
| `UsageMeteringService`    | Record usage events and quota consumption                              |
| `StorageOwnershipService` | Generate account-scoped storage keys and enforce access model          |

---

## 13. API Endpoints in This Stage

Suggested platform endpoints:

### Auth / Identity

- `GET /api/v1/me`

### Workspace / Membership

- `POST /api/v1/workspaces`
- `GET /api/v1/workspaces/{id}`
- `POST /api/v1/workspaces/{id}/members/invite`

### Product Assets

- `POST /api/v1/product-assets`
- `GET /api/v1/product-assets`
- `GET /api/v1/product-assets/{id}`
- `DELETE /api/v1/product-assets/{id}`

### Avatars

- `POST /api/v1/avatars`
- `GET /api/v1/avatars`
- `GET /api/v1/avatars/{id}`
- `PATCH /api/v1/avatars/{id}`

### Templates

- `POST /api/v1/templates`
- `GET /api/v1/templates`
- `GET /api/v1/templates/{id}`
- `PATCH /api/v1/templates/{id}`
- `DELETE /api/v1/templates/{id}`

### Billing / Subscription

- `POST /api/v1/billing/checkout-session`
- `POST /api/v1/billing/customer-portal`
- `GET /api/v1/subscription`
- `POST /api/v1/stripe/webhook`

### Usage / Entitlements

- `GET /api/v1/entitlements`
- `GET /api/v1/usage`

---

## 14. Quality Gate for Stage 0.5

Before the system is considered ready to enter the creative pipeline, verify:

| Check                                             | Required |
| ------------------------------------------------- | -------- |
| Firebase auth verification works                  | Yes      |
| Firestore ownership model is defined              | Yes      |
| Workspace/account can be resolved                 | Yes      |
| Subscription mirror sync works from Stripe        | Yes      |
| Entitlement checks exist for premium actions      | Yes      |
| Internal dev/test override path exists            | Yes      |
| Storage paths are account-scoped                  | Yes      |
| Product assets can be stored and resolved         | Yes      |
| Avatar records can be stored and resolved         | Yes      |
| Template JSON scripts can be stored and versioned | Yes      |

If any of these fail, the system is not `platform_ready`.

---

## 15. Output of This Stage

The output of Stage 0.5 is a resolved `PlatformContext` and a platform-validated request boundary that can safely enter Phase 1.

```json
{
  "platform_ready": true,
  "platform_context": {
    "user_id": "user_123",
    "account_id": "acct_456",
    "role": "owner",
    "subscription_tier": "pro",
    "entitlement_source": "subscription"
  }
}
```
