# Phase 5 — Rendering, Quality Validation, Delivery & Regeneration

**Parent Document:** `PRD_00_OVERVIEW.md`  
**Agent Stages:** `composition_ready → rendering → validation → completed`

---

## 1. Phase Objective

Render the assembled timeline into a final MP4 video, validate the output against quality thresholds, deliver the result to the user, and support targeted regeneration of weak components.

This is the final phase — it transforms the render specification into a deliverable social-ready asset.

This phase also assumes that Stage 0.5 platform foundation is active so outputs can be permissioned, metered, and delivered according to workspace ownership and subscription entitlements.

---

## 2. Pipeline Stages in This Phase

```
RenderTimeline
  → Stage 14: Preview Generation (optional, low-cost)
  → Stage 15: Final Render Execution
  → Stage 16: Output Validation
  → Stage 17: Delivery or Retry
  → Output: FinalOutput (MP4 + thumbnail + metadata)
```

### 2.1 Platform Dependencies for Delivery

Delivery must integrate with the platform layer for:

- permissioned access to generated outputs
- usage accounting / quota deduction
- subscription entitlement checks for preview, render, and regeneration
- workspace-level ownership and sharing rules
- auditability of completed jobs for both B2C and B2B accounts

---

## 3. Stage 14: Preview Generation (Optional)

### 3.1 Purpose

Generate a low-cost, low-resolution preview of the ad so the user can review before committing to a full-quality render. This saves credits and improves user satisfaction.

### 3.2 Preview vs Full Render

| Property           | Preview           | Full Render        |
| ------------------ | ----------------- | ------------------ |
| Resolution         | 540×960 (half)    | 1080×1920          |
| FPS                | 15                | 30                 |
| Audio quality      | Compressed        | Full quality       |
| Subtitle rendering | Simplified        | Full animation     |
| Transitions        | Basic             | Full animation     |
| Export format      | MP4 (low bitrate) | MP4 (high bitrate) |
| Credit cost        | 1 per 30 seconds  | 4 per 30 seconds   |
| Render time        | ~30% of full      | Full time          |

### 3.3 Preview Trigger

```http
POST /api/v1/ads/{id}/preview
```

The preview is generated from the same `RenderTimeline` spec but with reduced quality settings.

### 3.4 Preview Output

```json
{
  "id": "ad-uuid",
  "preview_url": "https://storage.googleapis.com/.../preview.mp4",
  "preview_thumbnail_url": "https://storage.googleapis.com/.../preview_thumb.jpg",
  "status": "preview_ready",
  "credits_used": 1
}
```

### 3.5 User Flow

```
1. User submits ad request
2. Pipeline runs through Phases 1-4
3. System automatically generates preview OR user requests preview
4. User reviews preview
5. User approves → triggers full render (POST /api/v1/ads/{id}/render)
6. User requests changes → triggers regeneration of specific component
```

---

## 4. Stage 15: Final Render Execution

### 4.1 Purpose

Render the complete video from the timeline specification at full quality.

### 4.2 Render Engine: Remotion + FFmpeg

**Architecture:**

```
RenderTimeline (JSON)
  → Remotion Composition (React components)
    → Scene sequences with media, overlays, subtitles
    → Audio mixing (voiceover + background music)
  → Remotion renderMedia()
    → FFmpeg encoding
  → Final MP4
```

### 4.3 Remotion Composition Structure

```typescript
// Pseudo-structure of the Remotion composition

<Composition>
  <AbsoluteFill style={{backgroundColor: timeline.background_color}}>

    {/* Scene Sequences */}
    {timeline.scenes.map(scene => (
      <Sequence from={toFrames(scene.start_sec)} durationInFrames={toFrames(scene.duration)}>

        {/* Media Layer */}
        <SceneMedia
          src={scene.layers[0].src}
          fit={scene.layers[0].fit}
          motion={scene.layers[0].motion}
        />

        {/* Overlay Text Layer */}
        {scene.layers.find(l => l.type === 'text_overlay') && (
          <TextOverlay
            text={overlay.text}
            position={overlay.position}
            animateIn={overlay.animate_in}
          />
        )}

        {/* Transition */}
        <Transition type={scene.transition_out.type} />

      </Sequence>
    ))}

    {/* Subtitle Layer (on top of everything) */}
    <SubtitleRenderer
      segments={timeline.subtitle_track.segments}
      style={timeline.subtitle_track.style_config}
    />

  </AbsoluteFill>

  {/* Audio Layers */}
  <Audio src={timeline.audio_tracks[0].src} volume={1.0} />
  <Audio src={timeline.audio_tracks[1].src} volume={0.15} />

</Composition>
```

### 4.4 Render Configuration

```json
{
  "composition": "AdVideo",
  "codec": "h264",
  "imageFormat": "jpeg",
  "pixelFormat": "yuv420p",
  "fps": 30,
  "width": 1080,
  "height": 1920,
  "audioBitrate": "192k",
  "videoBitrate": "8M",
  "crf": 18,
  "outputLocation": "gs://bucket/ads/ad-uuid/output/final.mp4",
  "concurrency": 4,
  "timeoutInMilliseconds": 300000
}
```

### 4.5 Thumbnail Generation

After render, extract a thumbnail from a key frame:

```bash
ffmpeg -i output.mp4 -vf "select=eq(n\,90)" -vframes 1 thumbnail.jpg
```

Choose frame at ~3 seconds (frame 90 at 30fps) — typically mid-hook for maximum visual impact.

### 4.6 Render Output

```json
{
  "project_id": "ad-uuid",
  "output_key": "ads/ad-uuid/output/final.mp4",
  "thumbnail_key": "ads/ad-uuid/output/thumbnail.jpg",
  "duration_sec": 28.5,
  "file_size_bytes": 12500000,
  "resolution": "1080x1920",
  "fps": 30,
  "codec": "h264",
  "render_time_sec": 45
}
```

### 4.7 Renderer Adapter Interface

```typescript
interface RendererAdapter {
  renderPreview(timeline: RenderTimeline): Promise<RenderResult>;
  renderFinal(timeline: RenderTimeline): Promise<RenderResult>;
  generateThumbnail(videoKey: string, frameTimeSec: number): Promise<string>;
}

interface RenderResult {
  outputStorageKey: string;
  thumbnailStorageKey: string;
  durationSec: number;
  fileSizeBytes: number;
  renderTimeSec: number;
}
```

### 4.8 Render Deployment

**MVP:** Remotion Lambda or Remotion on Cloud Run

| Option                    | Pros                                       | Cons                        |
| ------------------------- | ------------------------------------------ | --------------------------- |
| **Remotion Lambda**       | Serverless, auto-scaling, pay-per-render   | AWS dependency, cold starts |
| **Remotion on Cloud Run** | Google Cloud native, consistent with stack | Need to manage container    |
| **Self-hosted worker**    | Full control                               | Manual scaling              |

**Recommendation:** Remotion on Cloud Run (stays within Google Cloud, matches backend deployment).

---

## 5. Stage 16: Output Validation

### 5.1 Purpose

Verify the rendered output meets minimum quality thresholds before delivering to the user. This is the final quality gate.

### 5.2 Validation Checks

| Check                    | Method                  | Pass Criteria                                  | Failure Action                  |
| ------------------------ | ----------------------- | ---------------------------------------------- | ------------------------------- |
| **File exists**          | GCS head request        | Object exists, size > 0                        | Re-render                       |
| **File is playable**     | FFprobe analysis        | Valid video stream detected                    | Re-render                       |
| **Duration match**       | FFprobe duration        | Within ±10% of target                          | Log warning, accept             |
| **Audio present**        | FFprobe audio stream    | Audio stream exists                            | Re-render (TTS may have failed) |
| **Video resolution**     | FFprobe video stream    | Matches target (1080×1920)                     | Re-render                       |
| **No black frames**      | Sample frame analysis   | Key frames have pixel variance                 | Warn, may re-render             |
| **Subtitles burned in**  | Frame-by-frame sampling | Text detected in subtitle region during speech | Warn if not detected            |
| **Thumbnail exists**     | GCS head request        | Object exists, size > 0                        | Regenerate thumbnail            |
| **File size reasonable** | Size check              | > 500KB and < 200MB                            | Investigate if outlier          |

### 5.3 FFprobe Analysis

```bash
ffprobe -v quiet -print_format json -show_format -show_streams output.mp4
```

**Expected output structure:**

```json
{
  "streams": [
    {
      "codec_type": "video",
      "codec_name": "h264",
      "width": 1080,
      "height": 1920,
      "r_frame_rate": "30/1",
      "duration": "28.500000"
    },
    {
      "codec_type": "audio",
      "codec_name": "aac",
      "channels": 2,
      "sample_rate": "48000",
      "duration": "28.500000"
    }
  ],
  "format": {
    "duration": "28.500000",
    "size": "12500000",
    "bit_rate": "3508772"
  }
}
```

### 5.4 Validation Result Schema

```json
{
  "project_id": "ad-uuid",
  "validation_passed": true,
  "checks": [
    { "check": "file_exists", "passed": true },
    { "check": "file_playable", "passed": true },
    {
      "check": "duration_match",
      "passed": true,
      "actual": 28.5,
      "expected": 30,
      "tolerance": 0.1
    },
    { "check": "audio_present", "passed": true },
    { "check": "video_resolution", "passed": true, "actual": "1080x1920" },
    { "check": "no_black_frames", "passed": true },
    { "check": "subtitles_present", "passed": true },
    { "check": "thumbnail_exists", "passed": true },
    { "check": "file_size_reasonable", "passed": true, "bytes": 12500000 }
  ],
  "overall_quality": "pass",
  "warnings": [],
  "timestamp": "2026-03-24T18:05:00Z"
}
```

### 5.5 Validation Outcomes

| Outcome              | Definition                           | Action                       |
| -------------------- | ------------------------------------ | ---------------------------- |
| `pass`               | All checks pass                      | Deliver to user              |
| `pass_with_warnings` | Non-critical checks failed           | Deliver with quality warning |
| `revise`             | Specific stage output is weak        | Retry that stage only        |
| `fail`               | Critical checks failed after retries | Fail job with reason         |

---

## 6. Stage 17: Delivery or Retry

### 6.1 Delivery on Success

When validation passes:

1. Generate signed URLs for output assets (15-minute expiry, renewable)
2. Update job status to `completed`
3. Store final metadata
4. Send webhook notification if `webhook_url` was provided
5. Return result via GET endpoint

### 6.2 Final Delivery Payload

```json
{
  "id": "ad-uuid",
  "status": "completed",
  "video_url": "https://storage.googleapis.com/.../final.mp4?X-Goog-Signature=...",
  "thumbnail_url": "https://storage.googleapis.com/.../thumbnail.jpg?X-Goog-Signature=...",
  "script": { "...script JSON..." },
  "subtitles": [ "...subtitle segments..." ],
  "transcript": "Full text transcript...",
  "srt_url": "https://storage.googleapis.com/.../captions.srt?X-Goog-Signature=...",
  "metadata": {
    "duration_sec": 28.5,
    "platform": "tiktok",
    "aspect_ratio": "9:16",
    "language": "en",
    "scenes_count": 4,
    "voice_id": "en-US-Studio-O",
    "subtitle_style": "kinetic",
    "credits_used": 5,
    "render_time_sec": 45
  },
  "created_at": "2026-03-24T18:00:00Z",
  "completed_at": "2026-03-24T18:05:00Z"
}
```

### 6.3 Webhook Notification

```http
POST {webhook_url}
Content-Type: application/json

{
  "id": "ad-uuid",
  "type": "ad_completed",
  "status": "completed",
  "video_url": "https://storage.googleapis.com/.../final.mp4",
  "thumbnail_url": "https://storage.googleapis.com/.../thumbnail.jpg",
  "credits_used": 5,
  "created_at": "2026-03-24T18:00:00Z",
  "completed_at": "2026-03-24T18:05:00Z"
}
```

### 6.4 Failure Webhook

```json
{
  "id": "ad-uuid",
  "type": "ad_failed",
  "status": "failed",
  "failed_reason": "Render failed after 2 retries: FFmpeg encoding error",
  "failed_stage": "rendering",
  "created_at": "2026-03-24T18:00:00Z"
}
```

---

## 7. Retry and Fallback System

### 7.1 Retry Policy

The agent retries the **smallest failing unit** rather than restarting the full pipeline.

| Principle             | Rule                                               |
| --------------------- | -------------------------------------------------- |
| Max retries per stage | 2                                                  |
| Retry scope           | Only the failed stage                              |
| Retry from checkpoint | Resume from last valid artifact                    |
| Log every retry       | Store reason, attempt number, outcome              |
| No infinite loops     | Hard limit of 2 retries per stage, 5 total per job |
| Backoff               | 2 second delay between retries                     |

### 7.2 Retry Actions by Stage

| Stage               | Failure                       | Retry Action                                                   |
| ------------------- | ----------------------------- | -------------------------------------------------------------- |
| Context acquisition | Scrape timeout                | Retry scrape; if fails again, continue without scraped data    |
| Brief generation    | LLM error                     | Retry with same prompt                                         |
| Script generation   | LLM returns invalid structure | Retry with stricter schema instruction                         |
| Script evaluation   | Script too long               | Regenerate with "make shorter" instruction                     |
| Scene planning      | Missing fields                | Retry with defaults applied                                    |
| Asset resolution    | Stock search returns nothing  | Fall to Imagen generation                                      |
| Asset resolution    | Imagen fails                  | Fall to gradient placeholder                                   |
| Voice generation    | TTS error                     | Retry with different voice                                     |
| Voice generation    | Duration mismatch             | Retry with adjusted speaking rate                              |
| Transcription       | Chirp error                   | Fall back to faster-whisper                                    |
| Subtitle generation | Chunking error                | Re-chunk with relaxed rules                                    |
| Timeline assembly   | Validation error              | Reassemble from artifacts                                      |
| Render              | FFmpeg/Remotion error         | Retry render; if fails, simplify timeline (remove transitions) |
| Render              | Timeout                       | Retry with lower quality settings                              |
| Output validation   | Black frames detected         | Re-render                                                      |
| Output validation   | Missing audio                 | Re-generate TTS and re-render                                  |

### 7.3 Fallback Chain

```
For any stage failure:
  1. Retry same approach (attempt 2)
  2. Retry with adjusted parameters (attempt 3)
  3. Fall back to alternative provider/approach
  4. If all fail: mark stage as failed, record reason
  5. If stage is critical: fail the job
  6. If stage is optional (e.g., background music): skip and continue
```

### 7.4 Retry History Schema

```json
{
  "project_id": "ad-uuid",
  "retries": [
    {
      "stage": "asset_resolution",
      "scene_id": 3,
      "attempt": 1,
      "source_tried": "stock",
      "reason": "No results for query",
      "outcome": "retry",
      "timestamp": "2026-03-24T18:02:10Z"
    },
    {
      "stage": "asset_resolution",
      "scene_id": 3,
      "attempt": 2,
      "source_tried": "imagen",
      "reason": null,
      "outcome": "success",
      "timestamp": "2026-03-24T18:02:15Z"
    }
  ],
  "total_retries": 2,
  "total_fallbacks": 1
}
```

---

## 8. Regeneration

### 8.1 Scene-Level Regeneration

A user can regenerate a single scene without rebuilding the entire ad.

```http
POST /api/v1/ads/{id}/scenes/{scene_id}/regenerate
```

**Process:**

1. Keep all other scenes and artifacts intact
2. Re-run scene planning for the target scene only
3. Re-resolve asset for the target scene
4. If scene narration changed: re-generate TTS for full script, re-transcribe, re-chunk subtitles
5. Reassemble timeline with updated scene
6. Re-render

**What can be regenerated per scene:**

- Visual asset (new stock/generated image)
- Scene narration text
- Overlay text
- Camera motion

### 8.2 Full Ad Regeneration

```http
POST /api/v1/ads/{id}/regenerate
```

**Process:**

1. Keep the original normalized request
2. Optionally keep the product context (don't re-scrape)
3. Re-run from brief generation through to render
4. This produces an entirely new creative take on the same input

### 8.3 Script-Only Regeneration

```http
POST /api/v1/ads/{id}/script/regenerate
```

**Process:**

1. Keep the brief
2. Re-generate script with variation instruction
3. Re-plan scenes
4. Continue through remaining pipeline stages

---

## 9. Job Lifecycle Summary

### 9.1 Complete State Flow

```
                                    ┌──────────┐
                                    │  created  │
                                    └─────┬────┘
                                          │
                                    ┌─────▼────┐
                                    │normalized │
                                    └─────┬────┘
                                          │
                               ┌──────────▼──────────┐
                               │   context_ready      │
                               └──────────┬──────────┘
                                          │
                                ┌─────────▼─────────┐
                                │    brief_ready     │
                                └─────────┬─────────┘
                                          │
                                ┌─────────▼─────────┐
                                │   script_ready     │◄── retry (script eval failed)
                                └─────────┬─────────┘
                                          │
                                ┌─────────▼─────────┐
                                │   scenes_ready     │
                                └─────────┬─────────┘
                                          │
                                ┌─────────▼─────────┐
                                │   assets_ready     │◄── retry (fallback source)
                                └─────────┬─────────┘
                                          │
                                ┌─────────▼─────────┐
                                │    audio_ready     │◄── retry (rate adjustment)
                                └─────────┬─────────┘
                                          │
                                ┌─────────▼─────────┐
                                │  subtitles_ready   │◄── retry (re-chunk)
                                └─────────┬─────────┘
                                          │
                                ┌─────────▼─────────┐
                                │composition_ready   │
                                └─────────┬─────────┘
                                          │
                            ┌─────────────▼─────────────┐
                            │   preview_ready (optional) │
                            └─────────────┬─────────────┘
                                          │ (user approves)
                                          │
                                ┌─────────▼─────────┐
                                │     rendering      │◄── retry (render error)
                                └─────────┬─────────┘
                                          │
                                ┌─────────▼─────────┐
                                │    validation      │
                                └────┬──────────┬────┘
                                     │          │
                              ┌──────▼──┐  ┌────▼─────┐
                              │completed│  │  failed   │
                              └─────────┘  └──────────┘
```

### 9.2 Terminal States

| State           | Meaning                      | User Action                            |
| --------------- | ---------------------------- | -------------------------------------- |
| `completed`     | Ad is ready                  | Download, share, regenerate            |
| `failed`        | Unrecoverable error          | View error, try again, contact support |
| `preview_ready` | Preview available for review | Approve render or regenerate           |

---

## 10. Observability & Logging

### 10.1 Per-Job Metrics

| Metric                   | Description                                 |
| ------------------------ | ------------------------------------------- |
| `job.total_duration_sec` | Wall clock time from creation to completion |
| `job.stage_durations`    | Time spent in each stage                    |
| `job.retry_count`        | Total retries across all stages             |
| `job.credits_used`       | Total credits consumed                      |
| `job.llm_calls`          | Number of Gemini API calls                  |
| `job.vendor_latency`     | Latency per external service call           |
| `job.render_time_sec`    | Time spent in render stage                  |
| `job.output_quality`     | Validation result (pass/warn/fail)          |

### 10.2 Structured Log Format

```json
{
  "timestamp": "2026-03-24T18:02:30Z",
  "level": "info",
  "correlation_id": "ad-uuid",
  "stage": "script_generation",
  "event": "stage_completed",
  "duration_ms": 2340,
  "details": {
    "model": "gemini-2.5-flash",
    "tokens_used": 1250,
    "script_word_count": 42,
    "estimated_duration_sec": 28
  }
}
```

### 10.3 Error Log Format

```json
{
  "timestamp": "2026-03-24T18:03:15Z",
  "level": "error",
  "correlation_id": "ad-uuid",
  "stage": "asset_resolution",
  "scene_id": 3,
  "event": "stage_failed",
  "error": "Stock media search returned 0 results",
  "retry_attempt": 1,
  "next_action": "fallback_to_imagen"
}
```

---

## 11. Frontend Integration Points

### 11.1 Job Progress Polling

The frontend polls `GET /api/v1/ads/{id}` every 2-5 seconds to display progress:

```
Stage progress bar:
  [■■■■■■■■■■□□□□] 72%

  ✓ Input processed
  ✓ Product context acquired
  ✓ Creative brief generated
  ✓ Script written
  ✓ Scenes planned
  ✓ Assets resolved
  ✓ Voiceover generated
  ✓ Subtitles synchronized
  ✓ Timeline assembled
  ⏳ Rendering... (72%)
  ○ Validating
```

### 11.2 Result Display

When status is `completed`:

- Full-screen video player with playback controls
- Download button for MP4
- Download button for SRT subtitles
- Script preview panel
- Transcript text
- "Regenerate" button (full ad)
- Per-scene "Regenerate scene" buttons
- Share / export options

### 11.3 Error Display

When status is `failed`:

- Error message with failed stage name
- "Try Again" button (restarts from failed stage)
- "Start Over" button (new job from scratch)
- Support contact link

---

## 12. Definition of Done — Complete MVP

The MVP is considered complete and ready for launch when:

### Functional Completeness

1. ✅ User can submit prompt + parameters via form
2. ✅ Product URLs can be scraped and extracted
3. ✅ User can review/edit extracted product data
4. ✅ Creative brief is generated from inputs
5. ✅ Ad script is generated with hook, body, CTA
6. ✅ Script is evaluated and regenerated if weak
7. ✅ Scenes are planned with visual instructions
8. ✅ Assets are resolved per scene (upload > scraped > stock > generated)
9. ✅ Voiceover is generated with appropriate voice
10. ✅ Subtitles are synchronized with word-level timing
11. ✅ Subtitles support 3 style presets (standard, kinetic, karaoke)
12. ✅ Timeline is assembled from all artifacts
13. ✅ Preview can be generated before full render
14. ✅ Final video renders at 1080×1920 (9:16)
15. ✅ Output passes quality validation
16. ✅ Final MP4 is downloadable via signed URL
17. ✅ SRT subtitle file is downloadable
18. ✅ Webhook notifications work
19. ✅ Individual scenes can be regenerated
20. ✅ Full ad can be regenerated
21. ✅ Failed stages are retried automatically
22. ✅ Credits are tracked per operation

### Quality Thresholds

23. ✅ Subtitles are visibly synchronized (no >500ms desync)
24. ✅ No black frames or missing media in output
25. ✅ Audio and video durations match within 1 second
26. ✅ Text overlays and subtitles are within safe zones
27. ✅ 15s ad generates in under 6 minutes
28. ✅ 30s ad generates in under 8 minutes

### Operational Readiness

29. ✅ Per-stage logging with correlation IDs
30. ✅ Error tracking with stage-level granularity
31. ✅ Job metrics are observable
32. ✅ Retry history is recorded

---

## 13. Success Metrics (Internal Launch KPIs)

| Metric                                | Target           |
| ------------------------------------- | ---------------- |
| Ad generation success rate            | > 85%            |
| Median generation time (30s ad)       | < 5 minutes      |
| Median render time                    | < 60 seconds     |
| Subtitle sync defect rate             | < 5%             |
| Scene regeneration rate               | < 20% of scenes  |
| Failure rate by stage                 | < 10% per stage  |
| Outputs requiring manual intervention | < 10%            |
| User satisfaction with first output   | > 60% acceptable |

---

## 14. Cost Per Ad Estimate

| Component                                         | Cost per 30s Ad    |
| ------------------------------------------------- | ------------------ |
| Gemini LLM calls (brief + script + scenes + eval) | ~$0.01             |
| Stock media search                                | Free (API tier)    |
| Imagen generation (2 scenes avg)                  | ~$0.04             |
| Veo generation (1 scene max)                      | ~$0.35             |
| Google Cloud TTS                                  | ~$0.001            |
| Chirp transcription                               | ~$0.008            |
| Remotion render (Cloud Run compute)               | ~$0.05             |
| GCS storage                                       | ~$0.001            |
| **Total estimated cost**                          | **~$0.10 - $0.45** |

The cost range depends on how many scenes use AI generation vs stock media. The upper bound assumes one Veo scene; the lower bound uses stock/uploaded assets for all scenes.

At a credit price of €0.50-1.00 per ad (4-5 credits at €0.10-0.20 per credit), this provides healthy margins.
