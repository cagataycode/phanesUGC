c# MVP Technical PRD - Prompt-to-Ad Video Generator

**Date:** 2026-03-20  
**Version:** 1.0  
**Status:** Draft for Development  
**Audience:** Product, Engineering, Design, QA, DevOps

---

## 1. Document Purpose

This document defines the technical product requirements for the MVP of a prompt-to-ad video generator.

The MVP goal is to let a user enter a prompt, configure a small set of parameters, optionally provide product links or uploaded assets, and receive a rendered short-form social ad with:

- AI-generated script
- AI-generated or selected visuals
- voiceover
- auto-synced subtitles
- exported video ready to post on social media

This PRD is limited to the **development-phase MVP scope**. It excludes advanced collaboration, marketplaces, avatars, complex editing suites, enterprise governance, and broad automation workflows.

---

## 2. Product Summary

### 2.1 Problem Statement

Teams want ready-to-publish short-form ads without needing separate tools for copywriting, voiceover, subtitle timing, asset sourcing, and video editing.

Current workflows are fragmented:

1. write copy manually
2. source visuals manually
3. generate voiceover separately
4. create subtitles separately
5. assemble video in an editor
6. export in platform-specific formats

The MVP must compress this into a single guided workflow.

### 2.2 MVP Value Proposition

A user can:

1. type a prompt
2. choose ad parameters
3. optionally provide product details and links
4. generate a social-ready ad video with synced subtitles

### 2.3 Primary MVP Use Case

**Prompt -> brief -> script -> assets -> voice -> subtitles -> render -> export**

---

## 3. Goals and Non-Goals

### 3.1 Goals

The MVP must:

- accept prompt-based ad generation requests
- accept structured product information
- optionally scrape product URLs for enrichment
- generate a script suitable for short-form ads
- generate or select visuals for each scene
- generate voiceover audio
- generate synchronized subtitles
- compose and render a vertical social video
- export an MP4 ready for social posting
- support regeneration of the full ad or individual scenes

### 3.2 Non-Goals

The MVP will **not** include:

- AI avatars
- team collaboration features
- template marketplace
- deep timeline editing UI
- multi-user permissions
- campaign analytics
- A/B testing dashboards
- ad account publishing integrations
- full brand-kit management suite
- long-form horizontal video workflows
- enterprise approval flows
- full white-label API platform

---

## 4. MVP Scope

### 4.1 In Scope

#### Inputs
- free-text prompt
- platform selection
- aspect ratio
- ad duration
- language
- tone/style
- target audience
- CTA
- product information form
- optional product URLs to scrape
- optional brand assets upload
- optional subtitle style preset

#### Outputs
- final rendered MP4
- thumbnail
- transcript
- structured subtitle data
- script JSON
- status/progress during generation

#### Core Capabilities
- prompt-to-brief transformation
- product-page scraping and extraction
- script generation
- scene planning
- asset selection or generation
- TTS voice generation
- subtitle timing generation
- subtitle burn-in
- social-safe rendering

### 4.2 Out of Scope for MVP

- manual frame-level subtitle editor
- layered user asset libraries
- custom voice cloning
- multilingual dubbing workflows
- custom animation builder
- collaborative review comments
- billing engine beyond basic usage counters

---

## 5. Target Users

### 5.1 Primary Users
- small ecommerce brands
- performance marketers
- agencies producing short-form ad creatives
- founders testing product ads quickly

### 5.2 Secondary Users
- internal content teams
- growth teams generating ad variations

---

## 6. User Stories

### 6.1 Core User Stories

1. As a marketer, I want to enter a prompt and get a short-form ad draft without editing video manually.
2. As an ecommerce user, I want to paste a product link so the system can extract product information automatically.
3. As a creator, I want subtitles to be synchronized automatically so the video is usable immediately.
4. As a user, I want the video framed correctly for TikTok/Reels/Shorts so it is ready to post.
5. As a user, I want to regenerate a scene if the selected visual does not match the script.
6. As a user, I want to preview generation progress instead of waiting without status.

### 6.2 Admin / Internal User Stories

1. As an operator, I want generation jobs to be traceable across pipeline stages.
2. As an engineer, I want failed jobs to be retryable from a stage boundary.
3. As support, I want logs and metadata for each failed render.

---

## 7. Functional Requirements

## 7.1 Input Collection

The system shall provide an ad creation form with the following fields:

### Required Fields
- `prompt`
- `platform`
- `aspect_ratio`
- `duration_sec`
- `language`

### Optional Fields
- `tone`
- `target_audience`
- `cta`
- `product_name`
- `product_description`
- `product_benefits[]`
- `product_urls[]`
- `brand_assets[]`
- `subtitle_style`
- `voice_id`

### Supported MVP Aspect Ratios
- `9:16` primary
- `1:1` optional if straightforward in renderer

### Supported MVP Platforms
- TikTok
- Instagram Reels
- YouTube Shorts

---

## 7.2 URL Scraping and Product Extraction

If a URL is provided, the system shall:

1. fetch and parse the page
2. extract structured product information where possible
3. detect available assets
4. normalize extracted content into a common internal schema

### Extraction Targets
- product name
- tagline
- description
- benefits
- pricing if visible
- reviews/social proof if visible
- media URLs
- CTA text if visible
- brand colors if detectable

### Fallback Behavior
If scraping fails:
- continue with manual user input only
- mark scraping status as failed but non-blocking

---

## 7.3 Creative Brief Generation

The system shall convert prompt + optional extracted data into a structured internal creative brief.

### Required Internal Brief Fields
```json
{
  "product_name": "",
  "offer": "",
  "audience": "",
  "pain_points": [],
  "benefits": [],
  "tone": "",
  "language": "",
  "duration_sec": 30,
  "platform": "tiktok",
  "cta": "",
  "visual_style": "",
  "aspect_ratio": "9:16"
}
```

### Requirements
- validate missing fields where inferable
- resolve contradictions where possible
- produce a deterministic structured output schema

---

## 7.4 Script Generation

The system shall generate a short-form ad script optimized for social media video.

### Script Requirements
- strong opening hook
- concise body
- clear CTA
- scene-by-scene narration chunks
- subtitle-friendly sentence lengths
- output duration should fit requested duration target

### Script Outputs
```json
{
  "title": "",
  "hook": "",
  "voiceover_lines": [
    {"scene": 1, "text": ""},
    {"scene": 2, "text": ""}
  ],
  "cta": ""
}
```

### MVP Generation Variants
- generate 1 primary ad by default
- architecture should permit future support for 3 variants without redesign

---

## 7.5 Scene Planning

The system shall convert the script into scene instructions consumable by the renderer.

### Each Scene Must Include
- scene id
- duration
- visual source type
- visual prompt or asset references
- on-screen text
- transition instructions
- motion behavior
- subtitle-safe overlay region

### Example Scene Schema
```json
{
  "scene_id": 2,
  "duration_sec": 6,
  "visual_type": "stock_video",
  "visual_prompt": "small ecommerce team creating mobile ads on laptop",
  "overlay_text": "Generate ads from a single prompt",
  "camera_motion": "slow_push_in",
  "transition_in": "cut",
  "transition_out": "fade"
}
```

---

## 7.6 Asset Layer

The system shall support the following asset sources for MVP:

1. uploaded user images/videos
2. stock media provider
3. generated images
4. optional generated video scenes for selected scene types only

### Prioritization Logic
1. user-uploaded brand/product assets
2. scraped product media
3. stock media
4. generated visual fallback

### Asset Constraints
- all selected assets must match aspect ratio strategy or be crop-safe
- all assets must be downloadable/accessible to render workers
- unsupported or missing assets must not block the job if fallback is available

---

## 7.7 Voice Generation

The system shall generate voiceover audio from the final narration script.

### Voice Requirements
- support at least 1 English voice in MVP
- support stable pacing and intelligibility
- return timing metadata if available
- allow future extension to multiple languages and voices

### Voice Output Schema
```json
{
  "audio_url": "",
  "segments": [
    {
      "text": "Creating ad videos should not take days.",
      "start": 0.42,
      "end": 3.01,
      "words": [
        {"word": "Creating", "start": 0.42, "end": 0.88}
      ]
    }
  ]
}
```

---

## 7.8 Subtitle Generation and Sync

The system shall generate subtitles synchronized to speech.

### Subtitle Requirements
- subtitles must align to generated speech
- subtitles must be chunked for readability, not raw word dumps
- maximum 2 lines on screen at once
- support style presets
- support safe vertical placement for social UIs
- burn subtitles into final export in MVP

### Subtitle Chunking Rules
- phrase-aware line breaking
- reasonable max characters per line
- minimum readable display duration
- avoid orphan single-word lines where possible
- punctuation-aware splitting

### Subtitle Output Schema
```json
[
  {
    "start": 0.42,
    "end": 1.95,
    "text": "Creating ad videos"
  },
  {
    "start": 1.96,
    "end": 3.01,
    "text": "should not take days."
  }
]
```

### MVP Subtitle Styles
- standard bold caption
- kinetic highlight caption

---

## 7.9 Video Composition and Rendering

The system shall compose the final ad into an MP4 suitable for social posting.

### Composition Requirements
- vertical 9:16 timeline support
- voiceover placement
- subtitle burn-in
- background music at lower volume than speech
- transitions between scenes
- CTA overlay on final scene
- export with platform-safe margins

### Render Output Requirements
- final MP4
- thumbnail image
- transcript JSON
- subtitle JSON or SRT
- scene metadata

### Render States
- queued
- processing
- rendering
- completed
- failed

---

## 7.10 Regeneration

The system shall support:

- regenerate full ad
- regenerate a selected scene
- regenerate script before render

This may be API-only in MVP if UI complexity is constrained.

---

## 8. Recommended Technical Approach

## 8.1 Architecture Overview

The MVP uses an asynchronous pipeline architecture implemented with NestJS.

```text
Client App (Frontend)
  -> NestJS API Backend
  -> Cloud Tasks / Pub/Sub
  -> Pipeline Service
      -> Gemini 2.5 Pro (LLM)
      -> Veo 3 (Video/Audio)
      -> Imagen 4 (Images)
      -> Speech-to-Text (Subtitles)
      -> Remotion (Rendering)
  -> Google Cloud Storage
  -> Cloud Firebase (Firestore)
```

## 8.2 Implemented Components

### Backend API
- **NestJS** - TypeScript framework with modular architecture

### Database
- **Cloud Firebase (Firestore)** - NoSQL document database

### Queue / Jobs
- **Cloud Tasks / Pub/Sub** - Google Cloud native async processing

### Storage
- **Google Cloud Storage (EU)** - EU data residency for compliance

### Rendering
- **Remotion on Cloud Run** - Code-based video composition
- FFmpeg workers for media processing and encoding

### AI Services
- **Gemini 2.5 Pro** - LLM for brief/script generation
- **Veo 3** - Unified model for video and audio generation
- **Imagen 4** - Image generation
- **Google Speech-to-Text** - Subtitle alignment
- **Firebase Authentication** - User authentication

---

## 9. Suggested External Service Roles

The implementation should keep vendors abstracted behind internal interfaces.

### Service Adapter Interfaces
- `ScraperAdapter`
- `LLMAdapter`
- `StockMediaAdapter`
- `ImageGenerationAdapter`
- `VideoGenerationAdapter`
- `TTSAdapter`
- `SpeechAlignmentAdapter`
- `RendererAdapter`

This prevents hard vendor lock-in and supports replacement during compliance, cost, or quality changes.

---

## 10. System Workflow

## 10.1 End-to-End Pipeline

```text
1. User submits ad request
2. Request is validated and stored
3. URLs are scraped if present
4. Product data is normalized
5. Creative brief is generated
6. Script is generated
7. Scenes are planned
8. Assets are collected/generated
9. Voiceover is generated
10. Subtitle timings are generated
11. Timeline JSON is built
12. Render worker exports video
13. Final artifacts are stored
14. Client receives completed result
```

## 10.2 Stage Model

Each job shall have explicit stage statuses:

```text
created
-> scrape_ready
-> brief_ready
-> script_ready
-> assets_ready
-> audio_ready
-> subtitles_ready
-> composition_ready
-> rendering
-> completed
```

### Failure Model
If a stage fails:
- job status becomes `failed`
- failing stage is recorded
- retry may resume from last successful stage

---

## 11. API Requirements

## 11.1 Create Ad Job

### Endpoint
```http
POST /v1/ads
```

### Request
```json
{
  "prompt": "Create a 30 second TikTok ad for an AI tool that turns product info into ready-to-post ads.",
  "platform": "tiktok",
  "aspect_ratio": "9:16",
  "duration_sec": 30,
  "language": "en",
  "tone": "direct",
  "cta": "Start now",
  "product_info": {
    "name": "AdPilot",
    "description": "Generate short-form ad videos from a prompt",
    "benefits": ["save time", "auto subtitles", "social-ready exports"]
  },
  "urls": ["https://example.com/product"],
  "subtitle_style": "kinetic",
  "voice_id": "female_en_01"
}
```

### Response
```json
{
  "id": "ad_123",
  "status": "queued"
}
```

## 11.2 Get Job Status

### Endpoint
```http
GET /v1/ads/{id}
```

### Response
```json
{
  "id": "ad_123",
  "status": "rendering",
  "progress": 72,
  "stages": {
    "scrape": "done",
    "brief": "done",
    "script": "done",
    "assets": "done",
    "voice": "done",
    "subtitles": "done",
    "render": "running"
  }
}
```

## 11.3 Get Final Result

### Endpoint
```http
GET /v1/ads/{id}/result
```

### Response
```json
{
  "video_url": "",
  "thumbnail_url": "",
  "script": {},
  "subtitles": [],
  "transcript": [],
  "metadata": {}
}
```

## 11.4 Regenerate Scene

### Endpoint
```http
POST /v1/ads/{id}/scenes/{scene_id}/regenerate
```

---

## 12. Data Model Requirements

## 12.1 Core Entities

### Project
- id
- user_id
- created_at
- updated_at
- status
- platform
- aspect_ratio
- duration_sec
- language

### AdRequest
- id
- project_id
- prompt
- raw_inputs_json
- normalized_inputs_json

### ScrapeResult
- id
- project_id
- source_url
- status
- extracted_json
- raw_text

### CreativeBrief
- id
- project_id
- version
- brief_json

### Script
- id
- project_id
- version
- script_json

### Scene
- id
- project_id
- scene_order
- duration_sec
- visual_type
- visual_config_json
- overlay_text

### Asset
- id
- project_id
- type
- source
- source_url
- local_storage_key
- metadata_json

### AudioTrack
- id
- project_id
- voice_id
- storage_key
- timing_json

### SubtitleTrack
- id
- project_id
- style
- subtitle_json
- srt_storage_key

### RenderJob
- id
- project_id
- status
- render_config_json
- output_storage_key
- thumbnail_storage_key
- error_message

---

## 13. Frontend Requirements

## 13.1 MVP Screens

### Screen 1: Create Ad Form
Fields:
- prompt
- platform
- aspect ratio
- duration
- language
- product info
- URLs
- asset upload
- subtitle style
- submit

### Screen 2: Job Progress
- stage-based progress
- current status
- processing indicator

### Screen 3: Result View
- video preview
- transcript preview
- subtitle preview
- download/export
- regenerate actions

## 13.2 UX Constraints
- form must be simple enough for completion in under 2 minutes
- progress UI must not appear frozen
- result page must clearly indicate video is ready to post

---

## 14. Non-Functional Requirements

## 14.1 Performance

### Target Generation Latency
For MVP, target:
- 15s ad: under 3 minutes ideal, under 6 minutes acceptable
- 30s ad: under 5 minutes ideal, under 8 minutes acceptable

These are internal targets, not guaranteed SLAs.

## 14.2 Reliability
- job retries must be supported per stage
- transient vendor failures must not corrupt project state
- render outputs must be checksum-verifiable in storage

## 14.3 Scalability
The MVP must support:
- asynchronous job processing
- multiple concurrent generation jobs
- horizontal scaling of render workers

## 14.4 Security
- signed URLs for asset access
- secrets stored in secret manager or environment vault
- uploaded assets scanned/validated by type and size
- private project artifacts inaccessible without authorization

## 14.5 Privacy / EU Readiness
- support EU data residency at storage and database layer
- define retention and deletion behavior for generated assets
- log model/vendor calls for auditability where feasible

## 14.6 Observability
- per-stage logs
- request correlation IDs
- vendor call timings
- render failure reasons
- job metrics dashboard

---

## 15. Quality Requirements

## 15.1 Output Quality Bar
A generated ad is considered acceptable if:
- subtitles are readable and synchronized
- narration fits duration target
- scenes roughly align with narration meaning
- final video has no black frames or missing media
- text overlays remain within safe area
- output exports successfully as MP4

## 15.2 Subtitle Quality Bar
- no severe desync
- no overlapping subtitle chunks
- no captions outside safe display region
- line breaks must be readable

## 15.3 Render Quality Bar
- no unrendered placeholder assets
- no clipping or overflow on subtitle layer
- audio and video durations match within tolerance

---

## 16. Acceptance Criteria

## 16.1 Functional Acceptance Criteria

### A. Create Ad
- user can submit a valid ad request
- backend stores and processes request asynchronously

### B. Scraping
- if URL is valid and accessible, product content is extracted
- if scraping fails, request still completes using user inputs

### C. Script
- system generates a script with hook, body, and CTA
- script is split into scenes

### D. Audio
- voiceover audio is generated successfully
- audio is attached to timeline

### E. Subtitles
- subtitle file or structured subtitle data is generated
- subtitles are visibly synchronized in final render

### F. Render
- final video renders in 9:16 format
- final output is downloadable and playable
- final output includes burned-in subtitles

### G. Regeneration
- full ad regeneration works
- scene regeneration works via API

## 16.2 QA Test Cases
- prompt only
- prompt + manual product fields
- prompt + URL scraping
- prompt + uploaded images
- missing/slow asset source
- TTS timeout and retry
- subtitle timing fallback path
- render worker failure and retry

---

## 17. Risks and Mitigations

| Risk | Description | Mitigation |
|---|---|---|
| Scraping inconsistency | Product pages vary widely | Normalize extracted data and keep manual inputs authoritative |
| TTS timing mismatch | Provider timestamps may be imperfect | Add alignment fallback layer |
| Generative video instability | Text-to-video may be slow or visually inconsistent | Use stock/uploaded assets as primary path |
| Render complexity | Subtitle and motion layering can fail | Use explicit timeline schema and validation |
| Vendor lock-in | Critical capabilities tied to one provider | Use internal adapter interfaces |
| Cost spikes | Media generation and rendering can become expensive | Limit generated-video usage in MVP |
| Long job times | Users may drop if processing is opaque | Provide stage-based progress and async delivery |

---

## 18. Suggested Delivery Plan

## Phase 1 - Core Pipeline
- ad creation API
- project persistence
- prompt normalization
- script generation
- TTS generation
- subtitle timing generation
- simple render pipeline

## Phase 2 - Asset Intelligence
- URL scraping
- asset prioritization
- stock media integration
- scene regeneration

## Phase 3 - Quality Hardening
- subtitle polish rules
- render validation
- retry logic
- metrics and observability

---

## 19. Resolved Technical Decisions

The following decisions have been finalized for MVP implementation:

| # | Decision | Resolution | Notes |
|---|----------|------------|-------|
| 1 | Backend Framework | **NestJS** | TypeScript framework with excellent support for modules and DI |
| 2 | Queue Framework | **Cloud Tasks / Pub/Sub** | Google Cloud native async job processing |
| 3 | Primary LLM Provider | **Gemini 2.5 Pro** | For brief/script/scene generation |
| 4 | TTS Provider | **Not needed - Veo 3** | Veo 3 handles voice generation natively |
| 5 | Video Generation | **Veo 3** | Primary visual generation |
| 6 | Image Generation | **Imagen 4** | For static image generation |
| 7 | Subtitle Alignment | **Google Speech-to-Text** | For subtitle timing and sync |
| 8 | Stock Media Provider | **TBD** | Can be added in Phase 2 |
| 9 | Renderer Stack | **Remotion on Cloud Run** | Code-based video composition |
| 10 | Storage | **Google Cloud Storage (EU)** | EU data residency |
| 11 | Authentication | **Firebase Authentication** | User auth via Firebase |
| 12 | Database | **Cloud Firebase (Firestore)** | NoSQL document database |
| 13 | File Retention Policy | **TBD** | To be defined based on storage costs |

---

## 20. MVP Implementation Strategy

For the MVP, the implemented strategy is:

- **asynchronous pipeline backend** with NestJS
- **Cloud Firebase** for data persistence (Firestore)
- **Cloud Tasks / Pub/Sub** for async job processing
- **product URL scraping** as optional enrichment (Phase 2)
- **Gemini 2.5 Pro** for brief/script generation
- **Veo 3** for video generation and voiceover
- **Imagen 4** for image generation
- **uploaded assets** as primary visual path
- **Google Speech-to-Text** for subtitle alignment
- **Remotion on Cloud Run** for video rendering
- **Google Cloud Storage (EU)** for asset storage
- **Firebase Authentication** for user auth

This approach uses Google-native AI services to minimize complexity while producing high-quality social-ready ads.

---

## 21. Definition of Done

The MVP is complete when:

1. a user can submit a prompt and parameters
2. optional URLs can be scraped for enrichment
3. a complete short-form script is generated
4. visuals are assembled for all scenes
5. voiceover is generated
6. subtitles are synchronized and burned into the video
7. a final MP4 is rendered in 9:16 format
8. the output is acceptable for immediate social posting
9. failures are traceable by pipeline stage
10. regeneration is supported for the full ad and at least one scene

---

## 22. Appendix A - Example Internal Timeline Schema

```json
{
  "project_id": "ad_123",
  "aspect_ratio": "9:16",
  "fps": 30,
  "audio_tracks": [
    {
      "type": "voiceover",
      "src": "https://storage.example.com/audio/voice.wav",
      "start": 0
    }
  ],
  "subtitle_track": {
    "style": "kinetic",
    "segments": [
      {"start": 0.42, "end": 1.95, "text": "Creating ad videos"},
      {"start": 1.96, "end": 3.01, "text": "should not take days."}
    ]
  },
  "scenes": [
    {
      "scene_id": 1,
      "start": 0,
      "duration": 4,
      "layers": [
        {
          "type": "video",
          "src": "https://storage.example.com/assets/scene1.mp4",
          "fit": "cover"
        },
        {
          "type": "text",
          "text": "Create social ads faster",
          "position": "top"
        }
      ]
    }
  ]
}
```

---

## 23. Appendix B - Suggested Folder / Service Layout

```text
/apps
  /api
  /worker
  /web
/packages
  /shared-types
  /timeline-schema
  /vendor-adapters
/services
  /scraper
  /llm
  /tts
  /alignment
  /renderer
/infrastructure
  /terraform-or-equivalent
```

---

## 24. Appendix C - Initial KPI Suggestions for Internal Validation

These are internal launch metrics, not user-facing promises.

- ad generation success rate
- median generation time
- median render time
- subtitle sync defect rate
- scene regeneration rate
- failure rate by stage
- percent of outputs requiring manual intervention

