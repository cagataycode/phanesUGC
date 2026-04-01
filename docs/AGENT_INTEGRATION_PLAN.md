# AI Ad Agent — Backend Integration Plan

**Date:** 2026-04-01  
**Version:** 2.0  
**Status:** Active  
**Related Documents:** `MVP_Technical_PRD.md`, `VEO_PROMPT_TEMPLATE_GUIDE.md`, `SUBTITLE_IMPLEMENTATION_GUIDE.md`, `firestore_schema.md`

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
| **Scenario Generation**             | AI (LLM)         | Producing 4 distinct creative directions from one brief — generative + divergent reasoning          |
| **Scene Planning**                  | AI (LLM)         | Deciding what visual goes where, durations, transitions — creative reasoning                        |
| **Veo Prompt Construction**         | AI (LLM)         | Translating scene plan into Veo-ready JSON using the prompt template — structured generation        |
| **Scene Video + Speech Generation** | AI               | Veo 3.1 generates motion and embedded speech                                                        |
| **Subtitle Generation**             | Algorithm        | Script provides text + planned timing; chunking + formatting + post-Veo scaling = algorithm        |
| **Quality Evaluation**              | Algorithm + AI   | Some checks are rule-based (file exists, duration match); others need LLM (is the hook compelling?) |
| **Retry / Fallback Decisions**      | Algorithm        | Bounded policy logic — pure code                                                                    |
| **Video Composition / Rendering**   | Algorithm        | Building a deterministic render spec and calling Remotion                                           |

### Summary

- **Orchestration logic** = pure algorithm (TypeScript code in NestJS backend)
- **Stage execution** = calls to AI services and worker tools (Gemini LLM, Veo 3.1, Crawlee, Remotion)
- **Quality evaluation** = mix of rule-based checks and LLM scoring
- **Retry/fallback** = pure algorithm with coded policies

---

## 2. Resolved Design Decisions

| Decision                          | Choice                                                        | Rationale                                                    |
| --------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------ |
| Where does the agent live?        | Inside NestJS backend as `AgentModule`                        | No separate service needed for MVP                           |
| Sync or async pipeline?           | Async (fire-and-forget with polling)                          | Already established pattern                                  |
| LLM for "thinking" stages?       | Gemini 2.5 Pro via Vertex AI                                  | Already configured, same auth, best reasoning                |
| State persistence?                | Firestore (per `firestore_schema.md`)                         | Production-ready, already designed                           |
| Retry scope?                      | Per-stage, max 2 attempts                                     | Bounded, predictable                                         |
| Adapter pattern?                  | TypeScript interfaces + concrete implementations              | Vendor-swappable                                             |
| Veo generation strategy?          | **Single continuous video per ad (Option A)**                 | One Veo call per ad, full duration, stitched in Remotion     |
| Scene count for MVP?              | **Single scene, 8 seconds**                                   | Simplifies pipeline; no scene stitching needed yet           |
| Subtitle approach?                | **Script-derived, algorithmic** with post-Veo duration scaling| Per `SUBTITLE_IMPLEMENTATION_GUIDE.md`                       |
| Stock media?                      | **None for MVP** — fully generative                           | Core differentiator vs Creatify                              |
| Render engine?                    | **Remotion**                                                  | Confirmed                                                    |
| Quality gates?                    | **Soft / advisory for MVP** — log warnings, show result       | Better for testing; user sees output regardless              |
| Multi-variant generation?         | **4 scenarios presented → user picks 1 → generate that one**  | Matches Creatify UX; reduces wasted Veo compute              |
| Max pipeline time?                | **10 minutes**                                                | Safe ceiling for development phase                           |

---

## 3. Target Agent Pipeline

### MVP Pipeline (Single Scene, 8s)

```
prompt → normalize → scrape → brief → 4 scenarios → user picks 1 → script → veo prompt → generate video → subtitles → compose → render → validate → deliver
```

### Stage Breakdown

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        AgentOrchestratorService                        │
│                                                                        │
│  ┌───────────┐   ┌───────────┐   ┌──────────┐   ┌────────────────┐   │
│  │ Normalize  │──▶│  Context   │──▶│  Brief   │──▶│  4 Scenarios   │   │
│  │  Input     │   │ Acquisition│   │ Builder  │   │  (LLM)         │   │
│  └───────────┘   └───────────┘   └──────────┘   └───────┬────────┘   │
│                                                          │  ◀── USER  │
│                                                    ┌─────▼──────┐     │
│                                                    │  User Picks │     │
│                                                    │  Scenario   │     │
│                                                    └─────┬──────┘     │
│                                                          │            │
│  ┌──────────┐   ┌───────────┐   ┌──────────┐   ┌───────▼────────┐   │
│  │  Render   │◀──│ Timeline  │◀──│Subtitles │◀──│  Script + Veo  │   │
│  │ Executor  │   │ Assembler │   │(parallel)│   │  Generation    │   │
│  └────┬─────┘   └───────────┘   └──────────┘   └────────────────┘   │
│       │                                                               │
│  ┌────▼─────┐   ┌───────────┐                                        │
│  │  Output   │──▶│  Deliver  │                                        │
│  │ Validator │   │ (soft)    │                                        │
│  └──────────┘   └───────────┘                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### Two-Phase Async Model

The pipeline has a **user interaction break** between scenario generation and video generation:

**Phase 1 — Fast (target: < 30s)**
```
normalize → scrape → brief → generate 4 scenarios → return to user
```

**Phase 2 — Slow (target: < 10 min)**
```
user picks scenario → script → veo prompt → veo generation → subtitles → compose → render → validate → deliver
```

This means the orchestrator must support **pausing at the scenario gate** and resuming when the user makes a selection.

---

## 4. Scenario Generation (4 Options → Pick 1)

### What Is a Scenario?

A scenario is a **creative direction** — not a full script, not a rendered video. It's a lightweight preview the user can evaluate before committing Veo compute.

Each scenario includes:

| Field              | Description                                          |
| ------------------ | ---------------------------------------------------- |
| `scenarioId`       | Unique identifier (1–4)                              |
| `title`            | Short creative direction name (e.g., "Problem/Solution") |
| `hook`             | The opening line / hook text                         |
| `angle`            | The persuasion angle (social proof, urgency, etc.)   |
| `tone`             | Tone of the ad (funny, serious, aspirational, etc.)  |
| `visualDirection`  | Brief description of the visual style                |
| `ctaText`          | The call-to-action line                              |
| `summary`          | 2–3 sentence description of what the ad will look like |

### Why 4?

- Matches established UX (Creatify does this)
- LLM can diverge meaningfully across 4 directions from one brief
- Low cost — one Gemini call produces all 4
- Gives users creative control without requiring creative expertise

### Generation Flow

```
CreativeBrief → Gemini 2.5 Pro → 4 Scenario objects → return to frontend
                                                        ↓
                                              user picks scenarioId
                                                        ↓
                                         selected Scenario → ScriptGenerator
```

---

## 5. Stage-Aware State Machine

### States

```
created → platform_ready → normalized → context_ready → brief_ready →
scenarios_ready → [WAIT FOR USER] → scenario_selected →
script_ready → veo_prompt_ready → veo_generating → veo_output_ready →
subtitles_ready → composition_ready → rendering → completed
```

### Artifacts Stored at Each Stage

| Stage               | Artifact Stored                                                      |
| ------------------- | -------------------------------------------------------------------- |
| normalized          | `NormalizedRequest` — validated, defaulted inputs                    |
| context_ready       | `ProductContext` — scraped + manual merged data                      |
| brief_ready         | `CreativeBrief` — structured JSON brief                              |
| scenarios_ready     | `Scenario[4]` — four creative directions for user selection          |
| scenario_selected   | `selectedScenarioId` — user's choice                                 |
| script_ready        | `AdScript` — hook, narration, CTA, overlay text for selected scenario|
| veo_prompt_ready    | `VeoPrompt` — final Veo-ready JSON per `VEO_PROMPT_TEMPLATE_GUIDE`  |
| veo_output_ready    | `VeoOutput` — generated video file reference                        |
| subtitles_ready     | `SubtitleData` — script-derived, scaled to actual video duration     |
| composition_ready   | `RenderTimeline` — deterministic Remotion render specification       |
| rendering           | (render in progress)                                                 |
| completed           | `FinalOutput` — MP4 URL, thumbnail, transcript, metadata             |

---

## 6. Contract Schemas — Meta-Level Guide

> **These are not literal TypeScript files.** They are the canonical shapes the IDE agent should follow when implementing each stage's input/output contract. Every stage produces exactly one artifact that the next stage consumes.

### Design Principles for All Contracts

1. **Each contract is a plain TypeScript interface** — no classes, no decorators, no ORM coupling
2. **Every field has a JSDoc comment** explaining its purpose and constraints
3. **Optional fields use `?`** — never `| undefined` in the interface definition
4. **Enum-like fields use string literal unions** — not TypeScript enums
5. **Contracts live in `agent/contracts/`** as one file per artifact (e.g., `normalized-request.ts`)
6. **No circular imports** — contracts depend on nothing except other contracts

### Contract Catalog

| Contract             | Produced By              | Consumed By              | Key Concerns                                                                 |
| -------------------- | ------------------------ | ------------------------ | ---------------------------------------------------------------------------- |
| `NormalizedRequest`  | InputNormalizerService   | ContextAcquisitionService| Must contain all user inputs with defaults applied; platform/aspect/duration/language are required |
| `ProductContext`     | ContextAcquisitionService| BriefBuilderService      | Merges scraped data + manual inputs; must handle "scrape failed" gracefully by using manual only |
| `CreativeBrief`      | BriefBuilderService      | ScenarioGeneratorService | Structured summary of what the ad should achieve; platform-aware constraints |
| `Scenario`           | ScenarioGeneratorService | Frontend + ScriptGenerator| Lightweight preview object; must be serializable to JSON for API response    |
| `AdScript`           | ScriptGeneratorService   | VeoPromptBuilder + SubtitleGenerator | Must include timed narration lines with estimated durations               |
| `VeoPrompt`          | VeoPromptBuilderService  | VideoGeneratorService    | Must conform to `VEO_PROMPT_TEMPLATE_GUIDE.md` JSON shape                   |
| `VeoOutput`          | VideoGeneratorService    | SubtitleGenerator + TimelineAssembler | Contains GCS path, actual duration, resolution                          |
| `SubtitleData`       | SubtitleGeneratorService | TimelineAssemblerService | Script-derived timing scaled to actual Veo output duration                   |
| `RenderTimeline`     | TimelineAssemblerService | RenderExecutorService    | Deterministic spec that Remotion consumes — no AI, no ambiguity              |
| `FinalOutput`        | RenderExecutorService    | OutputValidator + Delivery| MP4 signed URL, metadata, quality report                                    |

### Field-Level Guidance

When implementing each contract, the IDE agent should ensure:

- **`NormalizedRequest`**: Carry the raw `prompt` alongside parsed fields. Include `productUrls: string[]` even if empty. Default `language` to `"en"`, `aspectRatio` to `"9:16"`, `durationSec` to `8`, `platform` to `"tiktok"`.
- **`ProductContext`**: Include `source: 'scraped' | 'manual' | 'merged'` so downstream stages know data provenance. Include `confidence: number` (0–1) for scraped fields.
- **`CreativeBrief`**: Must include `targetPlatform`, `targetDuration`, `targetAspectRatio` — these constrain every downstream decision. Include `productName`, `productCategory`, `keyBenefits`, `targetAudience`, `tone`, `cta`.
- **`Scenario`**: Keep it thin — title, hook, angle, tone, visualDirection, ctaText, summary. No full script. No media references.
- **`AdScript`**: Each narration line needs `text`, `estimatedDurationSec`, `speaker` (for Veo voice direction). Total estimated duration must be ≤ `targetDuration`.
- **`VeoPrompt`**: Must follow the template structure from `VEO_PROMPT_TEMPLATE_GUIDE.md` — core config, subject/action, environment/lighting/camera, negative constraints.
- **`SubtitleData`**: Array of `{ text, startSec, endSec, style }`. Timing is initially script-derived, then linearly scaled after Veo returns actual duration.

---

## 7. Integration Architecture

### 7.1 Expand the Job State Model

The orchestrator tracks state transitions and stores artifacts at each checkpoint. This enables:
- **Targeted retry** from the last valid checkpoint
- **Inspection** of intermediate artifacts for debugging
- **Resume after user interaction** (scenario selection)

### 7.2 AgentOrchestratorService

The heart of the system. It:

- Receives a normalized request
- Runs Phase 1 stages sequentially (normalize → scrape → brief → scenarios)
- **Pauses** and returns scenarios to the user
- **Resumes** when the user selects a scenario
- Runs Phase 2 stages sequentially (script → veo prompt → veo → subtitles → compose → render → validate)
- Stores artifacts at each checkpoint
- Logs quality gate results as warnings (soft gates for MVP)
- Decides whether to retry on hard failures (max 2 per stage)

### 7.3 Adapter Interfaces

```
LLMAdapter          — for Gemini text generation (brief, scenarios, script, scene planning, evaluation)
ScraperAdapter      — for Crawlee-based URL scraping and extraction
VideoGenAdapter     — for Veo 3.1 video generation
RendererAdapter     — for Remotion final video rendering
```

No `StockMediaAdapter` or `ImageGenAdapter` needed for MVP (fully generative, single scene).

### 7.4 Service Split

- `VertexAiVideoService` — for Veo 3.1 video generation (exists)
- `VertexAiLlmService` — for Gemini 2.5 Pro text generation (new)

Both use the same `@google/genai` client but for different model types.

---

## 8. Proposed Folder Structure

```
backend/src/
├── agent/
│   ├── agent.module.ts
│   │
│   ├── contracts/
│   │   ├── normalized-request.ts
│   │   ├── product-context.ts
│   │   ├── creative-brief.ts
│   │   ├── scenario.ts
│   │   ├── ad-script.ts
│   │   ├── veo-prompt.ts
│   │   ├── veo-output.ts
│   │   ├── subtitle-data.ts
│   │   ├── render-timeline.ts
│   │   └── final-output.ts
│   │
│   ├── orchestrator/
│   │   ├── agent-orchestrator.service.ts    # Main pipeline controller
│   │   ├── agent-state.model.ts             # Stage-aware state machine & types
│   │   └── quality-gates.service.ts         # Rule-based checks (soft/advisory)
│   │
│   ├── adapters/
│   │   ├── llm.adapter.ts                   # Interface for LLM calls
│   │   ├── scraper.adapter.ts               # Interface for Crawlee scraping
│   │   ├── video-generation.adapter.ts      # Interface for Veo 3.1
│   │   └── renderer.adapter.ts              # Interface for Remotion
│   │
│   ├── stages/
│   │   ├── input-normalizer.service.ts      # Validate & normalize user input
│   │   ├── context-acquisition.service.ts   # Scrape URLs & merge with manual input
│   │   ├── brief-builder.service.ts         # Build creative brief (LLM)
│   │   ├── scenario-generator.service.ts    # Generate 4 scenarios (LLM)
│   │   ├── script-generator.service.ts      # Generate full script for selected scenario (LLM)
│   │   ├── veo-prompt-builder.service.ts    # Build Veo-ready JSON from script (LLM)
│   │   ├── video-generator.service.ts       # Call Veo 3.1
│   │   ├── subtitle-generator.service.ts    # Script-derived subtitles + post-Veo scaling
│   │   ├── timeline-assembler.service.ts    # Build Remotion render spec
│   │   ├── render-executor.service.ts       # Trigger Remotion render
│   │   └── output-validator.service.ts      # Soft quality checks + logging
│   │
│   └── policies/
│       ├── retry.policy.ts                  # Max 2 retries per stage
│       └── fallback.policy.ts               # Fallback rules (e.g., scrape fails → manual only)
│
├── ads/           # existing — updated to delegate to agent
├── ai/            # existing — split into video + llm
├── config/        # existing
└── storage/       # existing
```

---

## 9. Quality Gates (Soft / Advisory for MVP)

Quality gates run between stages but **do not block the pipeline**. They log warnings and attach a quality report to the job. The user always sees the output.

### Script Gate (after script generation)
- Total narration duration ≤ target duration
- Hook line exists and is ≤ 3 seconds
- CTA exists
- Language matches request

### Veo Output Gate (after video generation)
- Video file exists in GCS
- Duration is within ±2s of target
- Resolution matches aspect ratio

### Subtitle Gate (after subtitle generation)
- All narration lines have corresponding subtitle entries
- No subtitle exceeds 2 lines / 42 characters per line
- Timing covers the full video duration

### Render Gate (after final render)
- Output MP4 exists
- File size is > 0 and < 500MB
- Duration matches expected output

All gates produce a `QualityReport` object with `{ gate, status: 'pass' | 'warn' | 'fail', issues: string[] }`. For MVP, even `fail` results proceed — the report is attached to the job for inspection.

---

## 10. Retry & Fallback Policies

### Retry Policy

- Retry the smallest failing unit possible
- Max 2 attempts per stage
- Record failure reason for every retry
- On final failure: mark stage as failed, proceed if possible, attach error to job

### Fallback Examples

| Failure               | Fallback                                       |
| --------------------- | ---------------------------------------------- |
| Scraping fails        | Use manual product inputs only                 |
| Brief generation fails| Retry with simplified prompt                   |
| Scenario generation fails | Retry; if still fails, generate 1 default scenario |
| Veo generation fails  | Retry with adjusted prompt; if still fails, mark job failed |
| Render error          | Retry render after validation of timeline spec |

---

## 11. Latency Budget

Target: **< 10 minutes** end-to-end for Phase 2 (post scenario selection).

| Stage                  | Expected Latency | Notes                                    |
| ---------------------- | ---------------- | ---------------------------------------- |
| Normalize              | < 1s             | Pure validation                          |
| Context Acquisition    | 3–10s            | Crawlee scraping (skipped if no URLs)    |
| Brief Generation       | 2–5s             | Single Gemini call                       |
| Scenario Generation    | 3–8s             | Single Gemini call producing 4 scenarios |
| **Phase 1 Total**      | **< 30s**        | User sees scenarios quickly              |
| Script Generation      | 3–8s             | Single Gemini call                       |
| Veo Prompt Building    | 2–5s             | Single Gemini call                       |
| Veo Video Generation   | 60–180s          | Single Veo 3.1 call, 8s video           |
| Subtitle Generation    | < 1s             | Algorithmic, runs parallel to Veo        |
| Timeline Assembly      | < 1s             | Pure algorithm                           |
| Remotion Render        | 10–30s           | Single scene composition                 |
| Output Validation      | < 1s             | Rule-based checks                        |
| **Phase 2 Total**      | **~2–4 min**     | Well within 10 min budget                |

---

## 12. How the Agent Module Connects to the Existing Backend

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

  Phase 1 (returns scenarios):
    → AgentOrchestratorService.runPhase1()
      → InputNormalizerService.normalize()
      → ContextAcquisitionService.acquire()
      → BriefBuilderService.build()              ← Gemini call
      → ScenarioGeneratorService.generate()       ← Gemini call → 4 scenarios
      → return scenarios to frontend

  Phase 2 (user picks scenario, generates video):
    → AgentOrchestratorService.runPhase2(scenarioId)
      → ScriptGeneratorService.generate()         ← Gemini call
      → VeoPromptBuilderService.build()           ← Gemini call
      → VideoGeneratorService.generate()          ← Veo 3.1 call
      → SubtitleGeneratorService.generate()       ← algorithmic (parallel with Veo, then scale)
      → TimelineAssemblerService.assemble()
      → RenderExecutorService.render()            ← Remotion
      → OutputValidatorService.validate()         ← soft gates
      → Deliver
```

### API Shape

```
POST /ads                    → starts Phase 1, returns jobId
GET  /ads/:id/scenarios      → polls for scenarios (returns 4 when ready)
POST /ads/:id/select         → user picks scenarioId, triggers Phase 2
GET  /ads/:id                → polls for final output
```

---

## 13. Updated CreateAdDto

```typescript
export class CreateAdDto {
  // Required
  prompt!: string;
  platform!: 'tiktok' | 'instagram_reels' | 'youtube_shorts';
  aspect_ratio!: '9:16' | '1:1';
  duration_sec!: number;       // MVP default: 8
  language!: string;           // ISO 639-1, default: 'en'

  // Product context (optional — enriched by scraping if URLs provided)
  product_name?: string;
  product_description?: string;
  product_benefits?: string[];
  product_urls?: string[];
  product_pricing?: string;
  product_offers?: string;

  // Creative preferences (optional)
  tone?: string;
  target_audience?: string;
  cta?: string;
  visual_style?: string;
  subtitle_style?: 'standard' | 'kinetic';

  // Toggles (optional)
  disable_background_music?: boolean;
  disable_captions?: boolean;
  disable_cta_overlay?: boolean;
}
```

---

## 14. Incremental Build Path

| Phase                  | What Gets Built                                                    | Outcome                                        |
| ---------------------- | ------------------------------------------------------------------ | ---------------------------------------------- |
| **Phase 0 (done)**     | prompt → Veo → GCS                                                | Raw video generation works                     |
| **Phase 1 (next)**     | + Contracts + Orchestrator skeleton + Normalizer + Brief + Scenarios + Script | Agent "thinks" before generating; user picks scenario |
| **Phase 2**            | + Veo prompt builder + Veo generation via template                 | Structured Veo prompts replace raw prompts     |
| **Phase 3**            | + Script-derived subtitles + Remotion render                       | Full rendered output with burned-in subtitles  |
| **Phase 4**            | + Soft quality gates + Retry/fallback policies                     | Agent becomes resilient                        |
| **Phase 5 (future)**   | + Multi-scene support + Parallel Veo calls + Hard quality gates    | Production-grade pipeline                      |

---

## 15. Open Questions (Remaining)

1. **Scenario presentation UX** — How should the frontend display 4 scenarios? Cards? Side-by-side? Preview thumbnails (would require lightweight image gen per scenario)?
2. **Scenario expiry** — How long do generated scenarios remain valid before the job expires? 1 hour? 24 hours?
3. **Voice direction in Veo** — How much voice/speaker control does Veo 3.1 expose? Does the script's speaker field map to a Veo parameter?
4. **Remotion hosting** — Local render or Remotion Lambda for production scale?
