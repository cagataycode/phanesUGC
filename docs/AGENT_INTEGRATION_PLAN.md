# AI Ad Agent — Backend Integration Plan

**Date:** 2026-03-24  
**Version:** 1.0  
**Status:** Draft  
**Related Documents:** `PRD_00_OVERVIEW.md`, `PRD_00_5_PLATFORM_FOUNDATION.md`, `PRD_01_INPUT_AND_CONTEXT.md`, `PRD_02_PLANNING.md`, `PRD_03_ASSET_AND_MEDIA.md`, `PRD_04_POST_PRODUCTION.md`, `PRD_05_DELIVERY_AND_QUALITY.md`

---

## 1. What Is the Agent: AI or Algorithm?

**It's both — a hybrid.** The agent is an **algorithmic orchestrator that delegates to AI services at specific stages**.

| Component                           | AI or Algorithm? | Why                                                                                                 |
| ----------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------- |
| **Orchestrator / State Machine**    | Algorithm        | Deterministic stage transitions, retry logic, failure routing — pure code                           |
| **Input Interpretation**            | AI (LLM)         | Free-text prompt needs to be parsed into structured intent                                          |
| **Product Context Extraction**      | AI + Algorithm   | Scraping is algorithmic; extracting meaning from unstructured page content uses LLM                 |
| **Creative Brief Construction**     | AI (LLM)         | Merging ambiguous human input into a structured brief requires reasoning                            |
| **Script Generation**               | AI (LLM)         | Writing ad copy, hooks, CTAs — generative task                                                      |
| **Scene Planning**                  | AI (LLM)         | Deciding what visual goes where, durations, transitions — creative reasoning                        |
| **Asset Strategy / Selection**      | Algorithm + AI   | Priority rules are algorithmic; deciding "is this image suitable?" could use AI                     |
| **Scene Video + Speech Generation** | AI               | Veo generates motion, embedded speech, and subtitles                |
| **Subtitle Integration**           | AI + Algorithm   | Veo provides timestamps (AI); formatting = algorithm                |
| **Quality Evaluation**              | Algorithm + AI   | Some checks are rule-based (file exists, duration match); others need LLM (is the hook compelling?) |
| **Retry / Fallback Decisions**      | Algorithm        | Bounded policy logic — pure code                                                                    |
| **Video Composition / Rendering**   | Algorithm        | Building a deterministic render spec and calling Remotion           |

### Summary

- **Orchestration logic** = pure algorithm (TypeScript code in NestJS backend)
- **Stage execution** = calls to AI services and worker tools (Gemini LLM, Veo, Crawlee, Remotion)
- **Quality evaluation** = mix of rule-based checks and LLM scoring
- **Retry/fallback** = pure algorithm with coded policies

The "agent" is an **algorithmic state machine** that calls **AI services and worker tools** (LLM, video generation, transcription, scraping, rendering) at the stages that require interpretation, generation, or processing. The intelligence comes from the AI services; the agency comes from the orchestration logic that decides what to do next, whether to retry, and when to fall back.

---

## 2. Current Backend State

The existing backend is a simple **single-step pipeline**:

```
prompt → Vertex AI Veo → GCS → signed URL
```

### Current Components

- `AdsController` — REST endpoints (POST /ads, GET /ads/:id)
- `AdsService` — creates job, triggers single-step processing
- `JobStoreService` — in-memory job store with `queued | processing | completed | failed`
- `VertexAiService` — calls Veo for video generation
- `GcsStorageService` — uploads to GCS, generates signed URLs
- `CreateAdDto` — simple DTO (prompt, aspect_ratio, duration_sec, negative_prompt, person_generation, enhance_prompt)

---

## 3. Target Agent Pipeline

The agent document describes a **multi-stage pipeline**:

```
prompt → normalize → scrape → brief → script → scenes → assets → generate_veo_output → compose → render → validate → deliver
```

## 3.1 Canonical Build Order

The recommended implementation sequence is:

1. define canonical contracts, artifact schemas, and state model
2. implement orchestrator skeleton and BullMQ wiring
3. implement Stage 0.5 platform foundation (auth, persistence, tenancy, subscriptions)
4. implement Phase 1 services
5. implement Phase 2 services
6. implement Phase 3 services
7. implement Phase 4 services
8. implement Phase 5 services
9. harden retry, fallback, and targeted regeneration policies

The orchestrator is implemented **early** as a deterministic control plane, not last.

## 3.2 Stage 0.5 — Platform Foundation

Stage 0.5 is a prerequisite layer for a B2C + B2B product and should be completed before the pipeline is considered production-ready.

It includes:

- Firebase Auth verification in the API layer
- Firestore persistence for jobs, links, artifacts, and account state
- account/workspace ownership model
- membership and role enforcement
- subscription documents and entitlement resolution
- usage metering hooks for render/generation actions

The orchestrator does not replace these concerns; it consumes platform context produced by them.

---

## 4. Integration Architecture

### 4.1 Expand the Job State Model

Current states: `queued | processing | completed | failed`

Agent needs a **stage-aware state machine**:

```
created → platform_ready → normalized → context_ready → brief_ready → script_ready →
scenes_ready → assets_ready → veo_output_ready →
composition_ready → rendering → validation → completed
```

Each stage stores its own artifact (brief JSON, script JSON, scene plan, etc.) and the job tracks which stage it's on. This allows **targeted retry** from the last valid checkpoint.

### 4.2 Create an AgentOrchestratorService

This is the heart — a new service that replaces the current `processJob()` method in `AdsService`. It:

- Verifies platform context exists before starting pipeline execution
- Receives a normalized request
- Runs stages sequentially
- Stores artifacts at each checkpoint
- Evaluates quality gates between stages
- Decides whether to retry, fallback, or proceed
- Is **not** AI itself — it's a coded pipeline controller

### 4.3 Create Adapter Interfaces for External Services

Each AI/external capability gets an adapter interface:

```
LLMAdapter          — for Gemini text generation (brief, script, scene planning, evaluation)
ScraperAdapter      — for Crawlee-based URL scraping and extraction
StockMediaAdapter   — for stock media search
ImageGenAdapter     — for image generation
VideoGenAdapter     — for video and subtitle generation (Veo 3.1)
RendererAdapter     — for final video rendering
```

### 4.4 Split VertexAiService

The existing `VertexAiService` handles only Veo video generation. The agent needs:

- `VertexAiVideoService` — for Veo video generation (what exists now)
- `VertexAiLlmService` — for Gemini text generation (new, for all the "thinking" stages)

Both use the same `@google/genai` client but for different model types.

---

## 5. Proposed Folder Structure

```
backend/src/
├── agent/
│   ├── agent.module.ts
│   │
│   ├── orchestrator/
│   │   ├── agent-orchestrator.service.ts    # Main pipeline controller
│   │   ├── agent-state.model.ts             # Stage-aware state machine & types
│   │   └── quality-gates.service.ts         # Rule-based + LLM evaluation
│   │
│   ├── adapters/
│   │   ├── llm.adapter.ts                   # Interface for LLM calls
│   │   ├── scraper.adapter.ts               # Interface for Crawlee scraping
│   │   ├── stock-media.adapter.ts           # Interface for stock media
│   │   ├── image-generation.adapter.ts      # Interface for image gen
│   │   ├── video-generation.adapter.ts      # Interface for video & subtitles (Veo)
│   │   └── renderer.adapter.ts              # Interface for rendering
│   │
│   ├── stages/
│   │   ├── input-normalizer.service.ts      # Stage 1-2: Validate & normalize
│   │   ├── context-acquisition.service.ts   # Stage 3: Scrape & extract
│   │   ├── brief-builder.service.ts         # Stage 4: Build creative brief (LLM)
│   │   ├── script-generator.service.ts      # Stage 5-6: Generate & evaluate script (LLM)
│   │   ├── scene-planner.service.ts         # Stage 7: Plan scenes (LLM)
│   │   ├── asset-resolver.service.ts        # Stage 8: Select/generate assets
│   │   ├── scene-video-generator.service.ts # Stage 9: Veo generation with subtitles
│   │   ├── veo-output-processor.service.ts   # Stage 10: Format Veo subtitles
│   │   ├── timeline-assembler.service.ts    # Stage 13: Build render spec
│   │   ├── render-executor.service.ts       # Stage 14-15: Trigger render
│   │   └── output-validator.service.ts      # Stage 16: Quality checks
│   │
│   └── policies/
│       ├── retry.policy.ts                  # Max retries, which stages can retry
│       └── fallback.policy.ts               # Fallback rules
│
├── ads/           # (existing — updated to delegate to agent)
├── ai/            # (existing — split into video + llm)
├── config/        # (existing)
└── storage/       # (existing)
```

---

## 6. Stage-by-Stage Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AgentOrchestratorService                      │
│                                                                      │
│  ┌──────────┐   ┌───────────┐   ┌──────────┐   ┌──────────────┐    │
│  │ Normalize │──▶│  Context   │──▶│  Brief   │──▶│   Script     │    │
│  │  Input    │   │ Acquisition│   │ Builder  │   │  Generator   │    │
│  └──────────┘   └───────────┘   └──────────┘   └──────┬───────┘    │
│                                                         │            │
│                                                   ┌─────▼──────┐    │
│                                                   │  Quality   │    │
│                                                   │   Gate     │    │
│                                                   └─────┬──────┘    │
│                                                         │            │
│  ┌──────────┐   ┌───────────┐   ┌──────────┐   ┌──────▼───────┐    │
│  │  Render  │◀──│ Timeline  │◀──│   Veo    │◀──│   Scene      │    │
│  │ Executor │   │ Assembler │   │ Processor│   │   Planner    │    │
│  └────┬─────┘   └───────────┘   └──────────┘   └──────────────┘    │
│       │                                                              │
│  ┌────▼─────┐   ┌───────────┐                                       │
│  │  Output  │──▶│  Deliver  │                                       │
│  │ Validator│   │ or Retry  │                                       │
│  └──────────┘   └───────────┘                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Artifacts Stored at Each Stage

| Stage             | Artifact Stored                                             |
| ----------------- | ----------------------------------------------------------- |
| normalized        | `NormalizedRequest` — validated, defaulted inputs           |
| context_ready     | `ProductContext` — scraped + manual merged data             |
| brief_ready       | `CreativeBrief` — structured JSON brief                     |
| script_ready      | `AdScript` — hook, narration lines, CTA, overlay text       |
| scenes_ready      | `ScenePlan[]` — per-scene instructions                      |
| assets_ready      | `ResolvedAsset[]` — media URLs/keys per scene               |
| veo_output_ready   | `VeoOutput` — generated video and subtitle segments        |
| composition_ready | `RenderTimeline` — deterministic render specification       |
| rendering         | (render in progress)                                        |
| validation        | `QualityReport` — pass/revise/fail per check                |
| completed         | `FinalOutput` — MP4 URL, thumbnail, transcript, metadata    |

---

## 7. Quality Gates

Quality gates are checkpoints between stages where the agent evaluates output before proceeding.

### Script Gate

- duration is plausible for target
- CTA exists
- hook exists
- language is valid
- scene narration is usable

### Visual Gate

- each scene has a resolvable media path
- crop strategy is valid
- the plan supports the requested aspect ratio

### Subtitle Gate

- captions are synchronized (from Veo)
- line breaks are readable
- captions remain within safe area

### Render Gate

- output file exists
- output plays correctly
- subtitles are burned in
- no placeholder or missing assets remain

---

## 8. Retry & Fallback Policies

### Retry Policy

- retry the smallest failing unit possible
- bounded max retry count per stage (default: 2)
- record failure reason for every retry
- prefer targeted regeneration over full restart

### Fallback Examples

| Failure               | Fallback                                       |
| --------------------- | ---------------------------------------------- |
| Scraping fails        | Use manual product inputs only                 |
| Missing product media | Use stock media                                |
| Weak generated visual | Replace with stock or uploaded asset           |
| Missing TTS timing    | Run alignment fallback                         |
| Scene mismatch        | Regenerate only that scene                     |
| Render error          | Retry render after validation of timeline spec |

---

## 9. Incremental Build Path

You don't need to build all 14 stages at once. The natural build order:

| Phase                 | Stages Added                                                   | What Changes                              |
| --------------------- | -------------------------------------------------------------- | ----------------------------------------- |
| **Phase 0 (current)** | prompt → Veo → GCS                                             | Already done                              |
| **Phase 1**           | + Input normalization + LLM brief + LLM script                 | Agent starts "thinking" before generating |
| **Phase 3**           | + Veo video and subtitle generation           | Video + Subtitles work                    |
| **Phase 4**           | + Remotion render composition                           | Full render pipeline                      |
| **Phase 5**           | + Quality gates + Retry logic                                  | Agent becomes truly agentic               |

---

## 10. How the Agent Module Connects to the Existing Backend

### Before (Current)

```
AdsController
  → AdsService.createJob()
    → AdsService.processJob()
      → VertexAiService.generateVideoFromPrompt()
      → GcsStorageService.importGeneratedVideo()
```

### After (With Agent)

```
AdsController
  → AdsService.createJob()
    → AgentOrchestratorService.run()
      → InputNormalizerService.normalize()
      → ContextAcquisitionService.acquire()
      → BriefBuilderService.build()          ← LLM call
      → ScriptGeneratorService.generate()     ← LLM call
      → QualityGatesService.evaluateScript()  ← LLM + rules
      → ScenePlannerService.plan()            ← LLM call
      → AssetResolverService.resolve()
      → VoiceGeneratorService.generate()      ← Veo 3.1 call (Video + Subtitles)
      → SubtitleFormattingService.format()
      → TimelineAssemblerService.assemble()
      → RenderExecutorService.render()        ← Remotion
      → OutputValidatorService.validate()     ← rules + LLM
      → Deliver or Retry
```

The existing `AdsService` becomes a thin coordinator that delegates to `AgentOrchestratorService`. The existing `VertexAiService`, `GcsStorageService`, and `JobStoreService` are preserved and wrapped behind adapter interfaces.

---

## 11. Updated CreateAdDto (Full Agent Inputs)

```typescript
export class CreateAdDto {
  // Required
  prompt!: string;
  platform!: "tiktok" | "instagram_reels" | "youtube_shorts";
  aspect_ratio!: "9:16" | "1:1";
  duration_sec!: number;
  language!: string;

  // Optional
  tone?: string;
  target_audience?: string;
  cta?: string;
  product_name?: string;
  product_description?: string;
  product_benefits?: string[];
  product_urls?: string[];
  brand_assets?: string[]; // uploaded asset references
  subtitle_style?: "standard" | "kinetic" | "karaoke";
  voice_id?: string;
}
```

---

## 12. Key Design Decisions

| Decision                   | Choice                                           | Rationale                             |
| -------------------------- | ------------------------------------------------ | ------------------------------------- |
| Where does the agent live? | Inside NestJS backend as `AgentModule`           | No separate service needed for MVP    |
| Sync or async pipeline?    | Async (fire-and-forget with polling)             | Already established pattern           |
| LLM for "thinking" stages? | Gemini via existing Vertex AI client             | Already configured, same auth         |
| State persistence?         | In-memory for MVP (existing `JobStoreService`)   | Database migration is a separate task |
| Retry scope?               | Per-stage, max 2 attempts                        | Bounded, predictable                  |
| Adapter pattern?           | TypeScript interfaces + concrete implementations | Vendor-swappable                      |

---

## 13. Open Questions

1. **Which Gemini model for text generation?** (e.g., `gemini-2.0-flash`, `gemini-2.5-pro`)
2. **Subtitles for MVP?** (Use direct Veo 3.1 output)
3. **Stock media provider?** (Pexels, Shutterstock, none for MVP?)
4. **Render engine?** (Remotion)
5. **Should Phase 1 start immediately or do we need to resolve open questions first?**
