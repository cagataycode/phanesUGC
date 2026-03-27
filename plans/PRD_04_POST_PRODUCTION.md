# Phase 4 — Veo 3.1 Output Processing & Timeline Composition

**Parent Document:** `PRD_00_OVERVIEW.md`  
**Agent Stages:** `assets_ready → veo_output_ready → composition_ready`

---

## 1. Phase Objective

Receive the video and synchronized subtitle data from Veo 3.1 and assemble all media into a deterministic render timeline specification.

This phase bridges raw media generation into a complete, renderable video specification.

---

## 2. Pipeline Stages in This Phase

```
Brief + GlobalParams
  → Stage 10: Veo 3.1 Generation (Video + Subtitles)
  → Stage 11: Subtitle Formatting
  → Stage 12: Timeline Assembly
  → Output: SubtitleTrack + RenderTimeline
```

---

## 3. Stage 10: Veo 3.1 Generation

### 3.1 Purpose

Generate the core video content along with precisely synchronized word-level subtitle segments in a single API call.

### 3.2 Output Verification

The system must verify that the Veo 3.1 output contains:
- Video storage key
- Subtitle segments array
- Word-level timestamps within segments

---

## 4. Stage 11: Subtitle Formatting

### 4.1 Purpose

Convert the raw word-level timing data from Veo 3.1 into the internal `SubtitleTrack` format used by the Remotion renderer.

### 4.2 Subtitle Style Presets

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
  "highlight_active_word": false
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
  "active_word_color": "#FFD700",
  "background": "none",
  "text_shadow": "2px 2px 8px rgba(0,0,0,0.8)",
  "position": "center",
  "bottom_offset_percent": 35,
  "text_align": "center",
  "highlight_active_word": true,
  "animation": "scale_pop"
}
```

#### Karaoke Word Highlight Caption

```json
{
  "style": "karaoke",
  "font_family": "Poppins",
  "font_size": 52,
  "font_weight": "bold",
  "color": "rgba(255, 255, 255, 0.5)",
  "active_word_color": "#FFFFFF",
  "active_word_background": "#FF6B35",
  "active_word_scale": 1.1,
  "background": "none",
  "position": "bottom",
  "bottom_offset_percent": 18,
  "text_align": "center",
  "highlight_active_word": true,
  "animation": "color_fill"
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
      "end_sec": 2.35,
      "text": "Still spending hours\nediting ad videos?",
      "lines": [
        "Still spending hours",
        "editing ad videos?"
      ],
      "words": [
        {"word": "Still", "start_sec": 0.42, "end_sec": 0.68, "is_active": false},
        {"word": "spending", "start_sec": 0.69, "end_sec": 1.12, "is_active": false},
        {"word": "hours", "start_sec": 1.13, "end_sec": 1.45, "is_active": false},
        {"word": "editing", "start_sec": 1.46, "end_sec": 1.78, "is_active": false},
        {"word": "ad", "start_sec": 1.79, "end_sec": 1.92, "is_active": false},
        {"word": "videos?", "start_sec": 1.93, "end_sec": 2.35, "is_active": false}
      ],
      "scene_id": 1
    },
    {
      "id": 2,
      "start_sec": 4.70,
      "end_sec": 8.20,
      "text": "AdPilot turns your product info\ninto scroll-stopping ads",
      "lines": [
        "AdPilot turns your product info",
        "into scroll-stopping ads"
      ],
      "words": [
        {"word": "AdPilot", "start_sec": 4.70, "end_sec": 5.15, "is_active": false},
        {"word": "turns", "start_sec": 5.16, "end_sec": 5.42, "is_active": false},
        {"word": "your", "start_sec": 5.43, "end_sec": 5.60, "is_active": false},
        {"word": "product", "start_sec": 5.61, "end_sec": 5.98, "is_active": false},
        {"word": "info", "start_sec": 5.99, "end_sec": 6.30, "is_active": false},
        {"word": "into", "start_sec": 6.31, "end_sec": 6.52, "is_active": false},
        {"word": "scroll-stopping", "start_sec": 6.53, "end_sec": 7.40, "is_active": false},
        {"word": "ads", "start_sec": 7.41, "end_sec": 8.20, "is_active": false}
      ],
      "scene_id": 2
    }
  ],
  "total_segments": 6,
  "srt_storage_key": "ads/ad-uuid/subtitles/captions.srt"
}
```

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
| Subtitle track has segments             | Yes (unless `no_caption`) | Transcription retry            |
| Subtitle segments cover speech duration | Yes                       | Re-chunk subtitles             |
| No subtitle overlap                     | Yes                       | Re-chunk with gap enforcement  |
| Scene durations match audio boundaries  | Yes                       | Reassemble timeline            |
| Total duration is within tolerance      | Yes                       | Flag but accept                |
| All GCS references are valid            | Yes                       | Verify and re-upload if needed |
| Resolution matches target               | Yes                       | Verify config                  |

---

## 8. Implementation Services

| Service                         | Responsibility                                 |
| ------------------------------- | ---------------------------------------------- |
| `SubtitleGeneratorService`      | Transcription → alignment → chunking → styling |
| `TimelineAssemblerService`      | Combine all artifacts into render spec         |
| `SpeechAlignmentAdapter` (impl) | Chirp transcription + forced alignment         |

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
| Chirp transcription | Vertex AI Speech-to-Text | ~$0.016 per minute |
| Forced alignment    | Computed locally         | Compute only       |
| Subtitle chunking   | Algorithmic              | Compute only       |
| Timeline assembly   | Algorithmic              | Compute only       |
