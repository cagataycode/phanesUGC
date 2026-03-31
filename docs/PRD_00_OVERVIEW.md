# AI Ad Agent — Complete Product Requirements Document

**Date:** 2026-03-24  
**Version:** 2.0  
**Status:** Final  
**Product:** Phanes AI Ad Agent

---

## 1. Product Vision

Phanes is an **AI Ad Agent** — a bounded, multi-stage ad production system that converts a user prompt and optional product context into a ready-to-post short-form social video ad.

The agent accepts a prompt, interprets the advertising objective, gathers product context, writes the script, plans scenes, selects or generates visual assets, generates video via Veo 3.1, derives subtitles algorithmically from the script, renders the final video, evaluates quality, and delivers a social-ready MP4.

---

## 2. Core Value Proposition

A user can:

1. Enter a prompt describing the ad they want
2. Optionally provide a product URL for automatic context extraction
3. Configure parameters (platform, duration, language, tone, style)
4. Receive a rendered short-form video ad with synced subtitles — ready to post on TikTok, Instagram Reels, or YouTube Shorts

The entire workflow that previously required copywriters, asset sourcing, video editing, subtitle timing, and format-specific export is compressed into a single automated pipeline.

---

## 3. Target Users

### Primary

- Small ecommerce brands producing ad creatives
- Performance marketers running short-form ad campaigns
- Agencies producing high volumes of social ad variations
- Founders testing product-market fit through ad creative

### Secondary

- Internal content teams generating social content
- Growth teams producing ad variations at scale

---

## 4. Document Structure

This PRD is organized into phased documents that map to the production pipeline:

| Document                            | Scope                                                                               |
| ----------------------------------- | ----------------------------------------------------------------------------------- |
| **PRD_00_5_PLATFORM_FOUNDATION.md** | Stage 0.5 — Auth, persistence, tenancy/workspaces, subscriptions, usage enforcement |
| **PRD_00_OVERVIEW.md**              | This file — vision, architecture, API, data model                                   |
| **PRD_01_INPUT_AND_CONTEXT.md**     | Phase 1 — Input collection, validation, URL scraping, product extraction            |
| **PRD_02_PLANNING.md**              | Phase 2 — Creative brief generation, script generation, scene planning              |
| **PRD_03_ASSET_AND_MEDIA.md**       | Phase 3 — Asset strategy, media selection, video generation, scene generation       |
| **PRD_04_POST_PRODUCTION.md**       | Phase 4 — Veo 3.1 output processing, timeline composition                          |
| **PRD_05_DELIVERY_AND_QUALITY.md**  | Phase 5 — Rendering, quality validation, delivery, retry, regeneration              |

---

## 5. System Architecture

### 5.1 High-Level Architecture

```
Frontend (Next.js)
  → Backend API (NestJS)
    → Agent Orchestrator (control plane / pipeline eye)
      → Redis + BullMQ stage workers
        → Input Normalizer
        → Context Acquisition (Crawlee + Gemini extraction)
        → Brief Builder (Gemini LLM)
        → Script Generator (Gemini LLM)
        → Scene Planner (Gemini LLM)
        → Asset Resolver (Uploads / Scraped Media / Stock / Imagen / Veo)
        → Scene Video Generator (Veo with built-in speech)
        → Subtitle Generator (script-derived, parallel with Veo)
        | Timeline Assembler (Remotion inputs)
        | Render Executor (Remotion)
        → Output Validator
      → Quality Gates
      → Retry / Fallback Policies
    → Firebase Auth
    → NoSQL Database (Firestore)
    → Object Storage (Google Cloud Storage / Firebase Storage)
  → Frontend Result Display
```

### 5.2 Google Cloud / Firebase Services Used

| Service                                     | Purpose                                                                          |
| ------------------------------------------- | -------------------------------------------------------------------------------- |
| **Gemini (Vertex AI)**                      | LLM for brief, script, scene planning, extraction enrichment, quality evaluation |
| **Veo (Vertex AI)**                         | AI video generation with embedded speech                                                     |
| **Imagen (Vertex AI)**                      | AI image generation for scene visuals                                            |
| **Google Cloud Storage / Firebase Storage** | Asset and output storage                                                         |
| **Firebase Auth**                           | User authentication                                                              |
| **Firestore**                               | NoSQL persistence for jobs, artifacts, progress, and metadata                    |
| **Cloud Run**                               | Backend and worker deployment                                                    |

### 5.3 Non-Google Components

| Component          | Purpose                                        |
| ------------------ | ---------------------------------------------- |
| **NestJS**         | Backend API framework and orchestrator host    |
| **Redis + BullMQ** | Job queue and stage worker orchestration       |
| **Crawlee**        | Scraping and browser-based context acquisition |
| **Remotion**       | Programmatic video composition                 |
| **Next.js**        | Frontend application                           |

### 5.4 Canonical Build Order

Implementation shall proceed in the following order:

1. canonical contracts and stage/state model
2. orchestrator skeleton + queue wiring
3. Stage 0.5 — platform foundation (Firebase Auth, Firestore, workspace/account ownership, subscription model)
4. Phase 1 — input normalization and context acquisition
5. Phase 2 — brief, script, and scene planning
6. Phase 3 — asset resolution and Veo scene generation
7. Phase 4 — Veo 3.1 output processing and timeline assembly
8. Phase 5 — render, validation, delivery, regeneration hardening

The agent/orchestrator is implemented **early as a deterministic control skeleton**, then expanded as each phase is completed. It is not deferred until the end.

### 5.5 Stage 0.5 — Platform Foundation

Before Phase 1 is fully productionized, the system shall establish a platform foundation that is not part of the creative pipeline itself but is required for a B2C + B2B product.

This stage includes:

- Firebase Auth integration
- Firestore document model and persistence layer
- workspace/account ownership model
- membership and role model
- subscription / plan model
- usage metering and entitlement checks
- storage path ownership and access policy

Stage 0.5 is intentionally placed before full pipeline execution hardening because auth, persistence, and plan enforcement affect API semantics, data ownership, and regeneration lineage.

---

## 6. Agent State Machine

The agent operates as a stage-based state machine. Each stage produces an artifact and transitions the job to the next state.

```
created
  → platform_ready
  → normalized
  → context_ready
  → brief_ready
  → script_ready
  → scenes_ready
  → assets_ready
  → veo_output_ready
  → composition_ready
  → rendering
  → validation
  → completed
```

### Failure Path

```
<any stage>
  → failed (retryable | terminal)
```

### Retry Rule

Retry resumes from the last valid checkpoint. Full restart only if the failure invalidates earlier dependencies.

---

## 7. API Specification

### 7.1 Product Context

#### Create Product Link

```http
POST /api/v1/links
```

**Request:**

```json
{
  "url": "https://example.com/product"
}
```

**Response:**

```json
{
  "id": "link-uuid",
  "url": "https://example.com/product",
  "status": "done",
  "extracted": {
    "product_name": "ProductX",
    "description": "AI-powered marketing tool",
    "image_urls": ["https://example.com/img1.jpg"],
    "video_urls": [],
    "benefits": ["Save time", "Auto subtitles"],
    "reviews": ["Great product!", "Highly recommended"],
    "pricing": "$29/mo",
    "cta": "Start free trial",
    "ai_summary": "AI-generated summary of the product",
    "ai_target_audiences": ["Small business owners", "Marketing teams"]
  },
  "created_at": "2026-03-24T18:00:00Z"
}
```

#### Update Product Link

```http
PUT /api/v1/links/{id}
```

**Request:**

```json
{
  "product_name": "Custom Product Name",
  "description": "Enhanced description",
  "image_urls": ["https://custom-image.com/product.jpg"],
  "logo_url": "https://brand.com/logo.png"
}
```

---

### 7.2 Ad Generation

#### Create Ad Job

```http
POST /api/v1/ads
```

**Request:**

```json
{
  "prompt": "Create a 30 second TikTok ad for an AI tool that turns product info into ready-to-post ads.",
  "link_id": "link-uuid",
  "platform": "tiktok",
  "aspect_ratio": "9:16",
  "duration_sec": 30,
  "language": "en",
  "tone": "direct",
  "target_audience": "Marketing professionals",
  "cta": "Start now",
  "visual_style": "dynamic",
  "script_style": "professional",
  "subtitle_style": "kinetic",
  "no_background_music": false,
  "no_caption": false,
  "no_cta": false,
  "product_info": {
    "name": "AdPilot",
    "description": "Generate short-form ad videos from a prompt",
    "benefits": ["save time", "auto subtitles", "social-ready exports"]
  },
  "webhook_url": "https://example.com/webhook"
}
```

**Response:**

```json
{
  "id": "ad-uuid",
  "status": "created",
  "created_at": "2026-03-24T18:00:00Z"
}
```

#### Get Ad Job Status

```http
GET /api/v1/ads/{id}
```

**Response:**

```json
{
  "id": "ad-uuid",
  "status": "rendering",
  "progress": 0.72,
  "stages": {
    "normalize": "done",
    "context": "done",
    "brief": "done",
    "script": "done",
    "scenes": "done",
    "assets": "done",
    "veo": "done",
    "composition": "done",
    "render": "running",
    "validation": "pending"
  },
  "created_at": "2026-03-24T18:00:00Z",
  "updated_at": "2026-03-24T18:02:30Z"
}
```

#### Get Ad Result

```http
GET /api/v1/ads/{id}/result
```

**Response:**

```json
{
  "id": "ad-uuid",
  "status": "completed",
  "video_url": "https://storage.googleapis.com/.../output.mp4",
  "thumbnail_url": "https://storage.googleapis.com/.../thumb.jpg",
  "script": {
    "title": "AdPilot - Create Ads Faster",
    "hook": "Still spending hours editing ad videos?",
    "narration_lines": [
      { "scene": 1, "text": "Still spending hours editing ad videos?" },
      {
        "scene": 2,
        "text": "AdPilot turns your product info into scroll-stopping ads."
      },
      {
        "scene": 3,
        "text": "Auto subtitles. Social-ready exports. One click."
      },
      {
        "scene": 4,
        "text": "Start creating ads that convert. Try AdPilot now."
      }
    ],
    "cta": "Try AdPilot now"
  },
  "subtitles": [
    {
      "start": 0.42,
      "end": 1.95,
      "text": "Still spending hours"
    },
    {
      "start": 1.96,
      "end": 3.10,
      "text": "editing ad videos?"
    }
  ],
  "transcript": "Still spending hours editing ad videos? ...",
  "metadata": {
    "duration_sec": 30,
    "platform": "tiktok",
    "aspect_ratio": "9:16",
    "language": "en",
    "scenes_count": 4
  }
}
```

#### Generate Preview

```http
POST /api/v1/ads/{id}/preview
```

Generates a low-cost preview before final render.

#### Render Final Video

```http
POST /api/v1/ads/{id}/render
```

Triggers the full-quality final render.

#### Regenerate Scene

```http
POST /api/v1/ads/{id}/scenes/{scene_id}/regenerate
```

Regenerates a single scene without rebuilding the entire ad.

#### Regenerate Full Ad

```http
POST /api/v1/ads/{id}/regenerate
```

Restarts the full pipeline from brief generation.

---

### 7.3 System

#### Get Remaining Credits

```http
GET /api/v1/credits
```

**Response:**

```json
{
  "remaining_credits": 450.0,
  "plan": "pro"
}
```

---

### 7.4 Webhook Format

All endpoints supporting `webhook_url` will POST when a job completes:

```json
{
  "id": "job-uuid",
  "type": "ad_completed",
  "status": "completed",
  "video_url": "https://storage.googleapis.com/.../output.mp4",
  "created_at": "2026-03-24T18:00:00Z"
}
```

---

## 8. Data Model

### Core Entities

#### Project

| Field        | Type      |
| ------------ | --------- |
| id           | uuid      |
| user_id      | uuid      |
| status       | enum      |
| platform     | enum      |
| aspect_ratio | enum      |
| duration_sec | integer   |
| language     | string    |
| created_at   | timestamp |
| updated_at   | timestamp |

#### ProductLink

| Field          | Type            |
| -------------- | --------------- |
| id             | uuid            |
| project_id     | uuid (nullable) |
| source_url     | string          |
| status         | enum            |
| extracted_json | jsonb           |
| raw_html       | text            |
| created_at     | timestamp       |

#### AdRequest

| Field                  | Type  |
| ---------------------- | ----- |
| id                     | uuid  |
| project_id             | uuid  |
| prompt                 | text  |
| raw_inputs_json        | jsonb |
| normalized_inputs_json | jsonb |

#### CreativeBrief

| Field      | Type    |
| ---------- | ------- |
| id         | uuid    |
| project_id | uuid    |
| version    | integer |
| brief_json | jsonb   |

#### Script

| Field       | Type    |
| ----------- | ------- |
| id          | uuid    |
| project_id  | uuid    |
| version     | integer |
| script_json | jsonb   |

#### Scene

| Field              | Type    |
| ------------------ | ------- |
| id                 | uuid    |
| project_id         | uuid    |
| scene_order        | integer |
| duration_sec       | float   |
| visual_type        | enum    |
| visual_config_json | jsonb   |
| overlay_text       | string  |

#### Asset

| Field         | Type                                       |
| ------------- | ------------------------------------------ |
| id            | uuid                                       |
| project_id    | uuid                                       |
| scene_id      | uuid                                       |
| type          | enum (image, video, audio)                 |
| source        | enum (uploaded, scraped, stock, generated) |
| source_url    | string                                     |
| storage_key   | string                                     |
| metadata_json | jsonb                                      |

#### ProductAsset

| Field         | Type                         |
| ------------- | ---------------------------- |
| id            | uuid                         |
| account_id    | uuid                         |
| type          | enum (image, video, logo)    |
| category      | enum (product, brand, other) |
| storage_key   | string                       |
| metadata_json | jsonb                        |

#### Avatar

| Field               | Type   |
| ------------------- | ------ |
| id                  | uuid   |
| account_id          | uuid   |
| name                | string |
| source              | enum   |
| status              | enum   |
| preview_storage_key | string |
| config_json         | jsonb  |

#### Template

| Field             | Type   |
| ----------------- | ------ |
| id                | uuid   |
| account_id        | uuid   |
| name              | string |
| type              | enum   |
| status            | enum   |
| template_json     | jsonb  |
| preview_image_key | string |


#### SubtitleTrack

| Field           | Type   |
| --------------- | ------ |
| id              | uuid   |
| project_id      | uuid   |
| style           | enum   |
| subtitle_json   | jsonb  |
| srt_storage_key | string |

#### RenderJob

| Field                 | Type   |
| --------------------- | ------ |
| id                    | uuid   |
| project_id            | uuid   |
| status                | enum   |
| render_config_json    | jsonb  |
| output_storage_key    | string |
| thumbnail_storage_key | string |
| error_message         | text   |
| credits_used          | float  |

---

## 9. Non-Functional Requirements

### 9.1 Performance Targets

| Ad Duration | Ideal Latency | Acceptable Latency |
| ----------- | ------------- | ------------------ |
| 15 seconds  | < 3 minutes   | < 6 minutes        |
| 30 seconds  | < 5 minutes   | < 8 minutes        |

### 9.2 Reliability

- Per-stage retry support
- Transient vendor failures must not corrupt project state
- Render outputs checksum-verifiable in storage

### 9.3 Scalability

- Asynchronous job processing via BullMQ
- Multiple concurrent generation jobs
- Horizontal scaling of render workers on Cloud Run

### 9.4 Security

- Signed URLs for all asset access (15-minute expiry)
- Secrets in Google Secret Manager
- Uploaded assets validated by type and size
- Private project artifacts inaccessible without authorization
- API key authentication for all endpoints

### 9.5 EU Data Residency

- Storage bucket location: `europe-west3` (Frankfurt)
- Database region: `europe-west3`
- Define retention and deletion policies for generated assets

### 9.6 Observability

- Per-stage structured logging
- Request correlation IDs
- Vendor call latency tracking
- Render failure reason logging
- Job metrics dashboard

---

## 10. Credit Pricing Model

| Operation                   | Credit Cost | Unit           |
| --------------------------- | ----------- | -------------- |
| URL Scrape + Extraction     | 1           | per link       |
| Ad Generation (Preview)     | 1           | per 30 seconds |
| Ad Generation (Full Render) | 4           | per 30 seconds |
| Text to Speech (Standalone) | 1           | per 30 seconds |
| Scene Regeneration          | 1           | per scene      |
| Full Ad Regeneration        | 4           | per 30 seconds |

---

## 11. MVP Scope Boundaries

### In Scope

- Prompt interpretation and normalization
- URL scraping and product extraction
- AI creative brief generation
- AI script generation with quality evaluation
- Scene planning
- Asset selection (uploaded, scraped, stock, generated)
- Video generation via Veo 3.1
- Script-derived subtitle generation with style presets (standard, kinetic)
- Social-safe video rendering
- Quality gates between stages
- Targeted retry and fallback
- Preview before final render
- Webhook delivery
- Credit-based usage tracking

### Out of Scope for MVP

- AI avatars and lipsync
- Team collaboration features
- Template marketplace
- Deep timeline editing UI
- Multi-user permissions
- Campaign analytics and A/B testing
- Ad platform publishing integrations
- Brand kit management
- Long-form horizontal video
- Enterprise approval flows
- Custom voice cloning
- Multilingual dubbing

---

## 12. Acceptance Criteria

The MVP is complete when:

1. A user can submit a prompt and parameters
2. A product URL can be scraped and extracted for enrichment
3. The user can review and edit extracted product data before generation
4. A complete short-form script is generated with hook, body, and CTA
5. Scenes are planned and visuals assembled
6. Video is generated via Veo 3.1; subtitles are derived algorithmically from the script
7. Subtitles are formatted and burned into the video
8. A preview can be generated before committing to full render
9. A final MP4 is rendered in 9:16 format
10. The output is acceptable for immediate social posting
11. Quality gates validate each stage
12. Failures are traceable by pipeline stage
13. Weak stages can be retried without full restart
14. Individual scenes can be regenerated
15. Webhook notifications are sent on completion

---

## 13. Phase Map

| Phase       | Document                         | Focus                                                      |
| ----------- | -------------------------------- | ---------------------------------------------------------- |
| **Phase 1** | `PRD_01_INPUT_AND_CONTEXT.md`    | Accept input, scrape URLs, extract product data, normalize |
| **Phase 2** | `PRD_02_PLANNING.md`             | Generate creative brief, write script, plan scenes         |
| **Phase 3** | `PRD_03_ASSET_AND_MEDIA.md`      | Select assets, generate video, produce voiceover           |
| **Phase 4** | `PRD_04_POST_PRODUCTION.md`      | Process Veo 3.1 output, build timeline                     |
| **Phase 5** | `PRD_05_DELIVERY_AND_QUALITY.md` | Render, validate, deliver, retry, regenerate               |
