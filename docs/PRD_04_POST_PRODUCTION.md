# Phase 4 — Veo 3.1 Output Processing & Timeline Composition

**Parent Document:** `PRD_00_OVERVIEW.md`  
**Agent Stages:** `assets_ready → veo_output_ready → composition_ready`

---

## 1. Phase Objective

Receive the generated video from Veo 3.1 and the script-derived subtitle track (generated in parallel), then assemble all media into a deterministic render timeline specification.

This phase bridges raw media generation into a complete, renderable video specification.

---

## 2. Pipeline Stages in This Phase

```
AdScript + ScenePlan + GlobalParams
  → Stage 10: Veo 3.1 Generation (Video only)       ← async
  → Stage 11: Subtitle Generation (from script)      ← async, parallel with Stage 10
  → Stage 11.5: Subtitle Scaling Correction           ← after Stage 10 completes
  → Stage 12: Timeline Assembly
  → Output: SubtitleTrack + RenderTimeline
```

---

## 3. Stage 10: Veo 3.1 Generation

### 3.1 Purpose

Generate the core video content with embedded speech in a single API call. Veo does **not** provide subtitle data — subtitles are generated separately from the script.

### 3.2 Output Verification

The system must verify that the Veo 3.1 output contains:
- Video storage key
- Actual video duration (for subtitle scaling correction)

---

## 4. Stage 11: Script-Derived Subtitle Generation

### 4.1 Purpose

Generate subtitle chunks algorithmically from the `AdScript` and `ScenePlan[]` artifacts. This stage runs **in parallel** with Veo video generation (Stage 10) — no dependency on Veo output.

### 4.2 Generation Algorithm

```
For each scene in ScenePlan[]:
  1. Take scene.narration text and scene.duration_sec
  2. Split narration into chunks of 3-4 words using phrase-aware breaking
  3. Calculate words-per-second rate: scene word count / scene duration
  4. Distribute chunk timestamps evenly across scene duration (~2.5 words/sec)
  5. Assign start_sec and end_sec to each chunk
  6. Map chunk to parent scene_id
  7. Apply scene start offset (cumulative from previous scenes)
```

### 4.3 Chunking Rules

| Rule | Value |
|---|---|
| Target words per chunk | 3-4 |
| Max words per chunk | 5 (only if breaking would create orphan) |
| Min words per chunk | 2 (avoid single-word orphans) |
| Max lines on screen | 2 |
| Min display duration | 0.8 seconds |
| Prefer break at | Punctuation (`.` `,` `!` `?` `—`) |
| Avoid | Single-word chunks, mid-phrase breaks |

### 4.4 Subtitle Style Presets

#### Standard Bold Caption

```json
{
  "style": "standard",
  "font_family": "Inter",
  "font_size": 48,
  "font_weight": "bold",
  "color": "#FFFFFF",
  "background": "rgba(0, 0, 0, 0.7)",
  "background_padding": 8,
  "border_radius": 4,
  "position": "bottom",
  "bottom_offset_percent": 15,
  "text_align": "center",
  "highlight_active_chunk": false
}
```

#### Kinetic Highlight Caption

```json
{
  "style": "kinetic",
  "font_family": "Montserrat",
  "font_size": 56,
  "font_weight": "extra-bold",
  "color": "#FFFFFF",
  "active_chunk_color": "#FFD700",
  "background": "none",
  "text_shadow": "2px 2px 8px rgba(0,0,0,0.8)",
  "position": "center",
  "bottom_offset_percent": 35,
  "text_align": "center",
  "highlight_active_chunk": true,
  "animation": "scale_pop"
}
```

### 5.6 SubtitleTrack Output Schema

```json
{
  "project_id": "ad-uuid",
  "style": "kinetic",
  "style_config": { "...style preset..." },
  "segments": [
    {
      "id": 1,
      "start_sec": 0.42,
      "end_sec": 1.45,
      "text": "Still spending hours",
      "scene_id": 1
    },
    {
      "id": 2,
      "start_sec": 1.46,
      "end_sec": 2.35,
      "text": "editing ad videos?",
      "scene_id": 1
    },
    {
      "id": 3,
      "start_sec": 4.70,
      "end_sec": 5.98,
      "text": "AdPilot turns your",
      "scene_id": 2
    },
    {
      "id": 4,
      "start_sec": 5.99,
      "end_sec": 7.40,
      "text": "product info into",
      "scene_id": 2
    },
    {
      "id": 5,
      "start_sec": 7.41,
      "end_sec": 8.20,
      "text": "scroll-stopping ads",
      "scene_id": 2
    }
  ],
  "total_segments": 12,
  "srt_storage_key": "ads/ad-uuid/subtitles/captions.srt"
}
```

### 5.7 Stage 11.5: Subtitle Scaling Correction

After Veo returns the actual video, the system applies a linear scaling correction to all subtitle timestamps:

```
scaling_factor = actual_video_duration / planned_total_duration

For each segment:
  segment.start_sec = segment.start_sec × scaling_factor
  segment.end_sec   = segment.end_sec   × scaling_factor
```

This ensures subtitle timing matches the actual video even if Veo produces a slightly different duration than planned.

### 5.7 SRT File Generation

In addition to the structured JSON, generate a standard SRT file for compatibility:

```srt
1
00:00:00,420 --> 00:00:02,350
Still spending hours
editing ad videos?

2
00:00:04,700 --> 00:00:08,200
AdPilot turns your product info
into scroll-stopping ads

3
00:00:08,400 --> 00:00:12,100
in minutes.

4
00:00:12,400 --> 00:00:18,800
Auto subtitles. Social-ready exports.
One click.

5
00:00:19,300 --> 00:00:24,500
Start creating ads that convert.

6
00:00:24,800 --> 00:00:28,500
Try AdPilot free today.
```

---

## 6. Stage 13: Timeline Assembly

### 6.1 Purpose

Combine all artifacts — scene plans, resolved assets, voiceover audio, subtitles, background music, and overlay instructions — into a single deterministic render specification.

The timeline spec is a complete description of the final video. The renderer should be able to produce the exact same output from this spec every time.

### 6.2 Timeline Assembly Process

```
1. Start with scene plan (scene order, durations)
2. Adjust scene durations to match actual audio timing:
   - Use AudioTrack.scene_boundaries to get real timestamps
   - Scene 1 duration = scene_boundary[1].start - scene_boundary[0].start
   - Adjust for inter-scene pauses
3. For each scene:
   a. Set media layer (resolved asset, crop, motion)
   b. Set overlay text layer (from scene plan)
   c. Set transition in/out
4. Add voiceover audio track at timeline position 0
5. Add background music track (looped/trimmed to total duration, volume 15-20%)
6. Add subtitle track (referencing subtitle segments)
7. Set global properties (fps, resolution, aspect ratio)
8. Validate total duration
9. Store render timeline
10. Transition state to composition_ready
```

### 6.3 Scene Duration Adjustment

The planned scene durations may differ from actual audio timing:

```
Planned: Scene 1 = 5s, Scene 2 = 8s, Scene 3 = 7s, Scene 4 = 10s = 30s total
Actual:  Scene 1 = 4.2s, Scene 2 = 7.4s, Scene 3 = 6.4s, Scene 4 = 9.2s = 27.2s total

Adjustment options:
  A) Scale scene durations proportionally to fill target duration
  B) Add padding time between scenes
  C) Use actual audio timing and accept shorter duration

MVP approach: Option C — use actual audio timing.
The voiceover duration IS the ad duration.
```

### 6.4 RenderTimeline Output Schema

```json
{
  "project_id": "ad-uuid",
  "aspect_ratio": "9:16",
  "resolution": {
    "width": 1080,
    "height": 1920
  },
  "fps": 30,
  "total_duration_sec": 28.5,
  "background_color": "#000000",

  "audio_tracks": [
    {
      "id": "voiceover",
      "type": "voiceover",
      "src": "gs://bucket/ads/ad-uuid/audio/voiceover.mp3",
      "start_sec": 0,
      "end_sec": 28.5,
      "volume": 1.0,
      "fade_in_sec": 0,
      "fade_out_sec": 0.5
    },
    {
      "id": "bgm",
      "type": "background_music",
      "src": "gs://bucket/music/corporate_01.mp3",
      "start_sec": 0,
      "end_sec": 28.5,
      "volume": 0.15,
      "fade_in_sec": 1.0,
      "fade_out_sec": 2.0,
      "loop": true
    }
  ],

  "subtitle_track": {
    "style": "kinetic",
    "style_config": { "..." },
    "segments_ref": "ads/ad-uuid/subtitles/segments.json"
  },

  "scenes": [
    {
      "scene_id": 1,
      "start_sec": 0,
      "end_sec": 4.7,
      "layers": [
        {
          "type": "media",
          "src": "gs://bucket/ads/ad-uuid/assets/scene_1_stock.jpg",
          "media_type": "image",
          "fit": "cover",
          "crop_strategy": "none",
          "motion": {
            "type": "slow_push_in",
            "start_scale": 1.0,
            "end_scale": 1.1
          }
        },
        {
          "type": "text_overlay",
          "text": "Hours wasted on video editing?",
          "position": "bottom",
          "style": "bold_white",
          "animate_in": "fade_up",
          "animate_in_delay_sec": 0.5
        }
      ],
      "transition_in": {"type": "cut"},
      "transition_out": {"type": "fade", "duration_sec": 0.3}
    },
    {
      "scene_id": 2,
      "start_sec": 4.7,
      "end_sec": 12.1,
      "layers": [
        {
          "type": "media",
          "src": "gs://bucket/ads/ad-uuid/assets/scene_2_product.png",
          "media_type": "image",
          "fit": "cover",
          "crop_strategy": "center",
          "motion": {
            "type": "slow_pull_out",
            "start_scale": 1.1,
            "end_scale": 1.0
          }
        },
        {
          "type": "text_overlay",
          "text": "Product info → Video ad",
          "position": "top",
          "style": "bold_white",
          "animate_in": "slide_left",
          "animate_in_delay_sec": 0.3
        }
      ],
      "transition_in": {"type": "slide_left", "duration_sec": 0.3},
      "transition_out": {"type": "fade", "duration_sec": 0.3}
    }
  ]
}
```

### 6.5 Remotion Component Mapping

The timeline spec maps to Remotion compositions:

| Timeline Element                | Remotion Component                                   |
| ------------------------------- | ---------------------------------------------------- |
| Scene with image media + motion | `<Img>` with `spring()` scale animation              |
| Scene with video media          | `<Video>` with crop/cover styling                    |
| Text overlay                    | `<AbsoluteFill>` with animated `<div>`               |
| Subtitle segment                | Custom `<Subtitle>` component with word highlighting |
| Transition fade                 | `<Sequence>` with opacity interpolation              |
| Transition slide                | `<Sequence>` with translateX interpolation           |
| Background music                | `<Audio>` with volume control                        |
| Voiceover                       | `<Audio>` at full volume                             |

### 6.6 Social-Safe Margins

The timeline must account for platform UI overlays:

| Platform        | Top Safe Zone | Bottom Safe Zone | Side Safe Zone |
| --------------- | ------------- | ---------------- | -------------- |
| TikTok          | 15% from top  | 20% from bottom  | 5% from sides  |
| Instagram Reels | 12% from top  | 18% from bottom  | 5% from sides  |
| YouTube Shorts  | 10% from top  | 15% from bottom  | 5% from sides  |

Text overlays and subtitles must be placed within safe zones. Media can extend full-bleed.

---

## 7. Quality Gate: Composition Readiness

Before transitioning to Phase 5 (Rendering), the agent checks:

| Check                                   | Required                  | Failure Action                 |
| --------------------------------------- | ------------------------- | ------------------------------ |
| All scenes have media layers            | Yes                       | Asset resolution retry         |
| Audio track exists and is playable      | Yes                       | TTS retry                      |
| Subtitle track has segments             | Yes (unless `no_caption`) | Re-chunk from script             |
| Subtitle segments cover narration       | Yes                       | Re-chunk from script             |
| No subtitle overlap                     | Yes                       | Re-chunk with gap enforcement    |
| Scene durations match audio boundaries  | Yes                       | Reassemble timeline            |
| Total duration is within tolerance      | Yes                       | Flag but accept                |
| All GCS references are valid            | Yes                       | Verify and re-upload if needed |
| Resolution matches target               | Yes                       | Verify config                  |

---

## 8. Implementation Services

| Service                         | Responsibility                                                         |
| ------------------------------- | ---------------------------------------------------------------------- |
| `SubtitleGeneratorService`      | Script narration → phrase-aware chunking → WPM-based timing → styling |
| `SubtitleScalingService`        | Post-Veo duration correction (linear scaling of timestamps)            |
| `TimelineAssemblerService`      | Combine all artifacts into render spec                                 |

---

## 9. Output Artifacts

| Artifact                       | Stored As                               | Used By                 |
| ------------------------------ | --------------------------------------- | ----------------------- |
| Normalized audio               | GCS: `ads/{id}/audio/voiceover_16k.wav` | Transcription service   |
| Transcription with word timing | Internal (processing artifact)          | Subtitle generator      |
| `SubtitleTrack`                | `subtitle_tracks` table + GCS JSON      | Renderer                |
| SRT file                       | GCS: `ads/{id}/subtitles/captions.srt`  | Delivery, user download |
| `RenderTimeline`               | `render_jobs.render_config_json`        | Render executor         |

---

## 10. Cost Considerations

| Operation           | Provider                 | Estimated Cost     |
| ------------------- | ------------------------ | ------------------ |
| Subtitle generation | Algorithmic              | Compute only       |
| Subtitle scaling    | Algorithmic              | Compute only       |
| Subtitle chunking   | Algorithmic              | Compute only       |
| Timeline assembly   | Algorithmic              | Compute only       |
