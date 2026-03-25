# Phase 4 — Audio Processing, Transcription, Subtitles & Timeline Composition

**Parent Document:** `PRD_00_OVERVIEW.md`  
**Agent Stages:** `audio_ready → subtitles_ready → composition_ready`

---

## 1. Phase Objective

Extract and normalize the voiceover audio, transcribe it to obtain word-level timing, generate readable subtitle chunks with style formatting, and assemble all media into a deterministic render timeline specification.

This phase bridges raw media assets into a complete, renderable video specification.

---

## 2. Pipeline Stages in This Phase

```
GeneratedSceneVideo[] + ResolvedAsset[]
  → Stage 10: Audio Extraction & Normalization
  → Stage 11: Speech Transcription
  → Stage 12: Subtitle Generation & Chunking
  → Stage 13: Timeline Assembly
  → Output: SubtitleTrack + RenderTimeline
```

---

## 3. Stage 10: Audio Extraction & Normalization

### 3.1 Purpose

Prepare the speech audio for transcription. In the canonical pipeline, speech originates from Veo-generated scene or ad video outputs, so FFmpeg extraction and normalization are the standard path before transcription.

### 3.2 Normalization Process

**Target format for transcription:**

- Mono channel
- 16kHz sample rate
- 16-bit PCM WAV
- No background music mixed in

**FFmpeg Command:**

```bash
ffmpeg -i input.mp3 -vn -ac 1 -ar 16000 -c:a pcm_s16le output.wav
```

### 3.3 When Extraction is Needed

| Audio Source        | Extraction Needed | Processing                            |
| ------------------- | ----------------- | ------------------------------------- |
| Veo-generated video | Full extraction   | Strip video, extract audio, normalize |
| Uploaded audio      | Format conversion | Normalize to 16kHz mono WAV           |

### 3.4 Output

```json
{
  "source_audio_key": "ads/ad-uuid/audio/voiceover.mp3",
  "normalized_audio_key": "ads/ad-uuid/audio/voiceover_16k.wav",
  "format": "wav",
  "sample_rate_hz": 16000,
  "channels": 1,
  "duration_sec": 28.5
}
```

---

## 4. Stage 11: Speech Transcription

### 4.1 Purpose

Transcribe the voiceover audio to obtain word-level timestamps. These timestamps are the foundation for synchronized subtitles.

### 4.2 Transcription Strategy

**Primary:** Whisper / faster-whisper (self-hosted or worker-based)  
**Fallback:** managed speech service if operationally required later

### 4.3 Why Transcription is Needed

Even though we generated the script ahead of time, we still need transcription because:

1. **Veo output does not guarantee subtitle-ready word timing** — downstream subtitles require per-word timestamps
2. **Actual speech timing differs from estimated** — the generation model decides pacing, pauses, and pronunciation
3. **Subtitles need word-level accuracy** — for karaoke-style highlighting, every word needs a start and end time
4. **Forced alignment against known text** — since we know the script, we can align rather than transcribe from scratch

### 4.4 Whisper Transcription

**Service:** Whisper / faster-whisper worker

**Request Configuration (conceptual):**

```json
{
  "audio_uri": "gs://bucket/ads/ad-uuid/audio/voiceover_16k.wav",
  "model": "large-v3",
  "language": "en",
  "word_timestamps": true,
  "vad_filter": true
}
```

**Response provides:**

```json
{
  "results": [
    {
      "alternatives": [
        {
          "transcript": "Still spending hours editing ad videos?",
          "confidence": 0.97,
          "words": [
            {
              "word": "Still",
              "start_offset": "0.420s",
              "end_offset": "0.680s",
              "confidence": 0.99
            },
            {
              "word": "spending",
              "start_offset": "0.690s",
              "end_offset": "1.120s",
              "confidence": 0.98
            },
            {
              "word": "hours",
              "start_offset": "1.130s",
              "end_offset": "1.450s",
              "confidence": 0.97
            },
            {
              "word": "editing",
              "start_offset": "1.460s",
              "end_offset": "1.780s",
              "confidence": 0.99
            },
            {
              "word": "ad",
              "start_offset": "1.790s",
              "end_offset": "1.920s",
              "confidence": 0.96
            },
            {
              "word": "videos",
              "start_offset": "1.930s",
              "end_offset": "2.350s",
              "confidence": 0.98
            }
          ]
        }
      ]
    }
  ]
}
```

### 4.5 Forced Alignment (Enhanced Accuracy)

Since we know the exact script text, we can use forced alignment instead of open transcription for higher accuracy:

**Process:**

1. Transcribe audio to get raw word timings
2. Compare transcription against known script text
3. Align known words to detected timestamps
4. Correct any misrecognized words using the known script
5. Interpolate timing for words that were missed

This produces more reliable subtitle timing than raw transcription alone.

### 4.6 Speech Alignment Adapter Interface

```typescript
interface SpeechAlignmentAdapter {
  transcribe(
    audioUri: string,
    options: TranscriptionOptions,
  ): Promise<TranscriptionResult>;
  alignToScript(
    audioUri: string,
    scriptText: string,
    options: AlignmentOptions,
  ): Promise<AlignedTranscript>;
}

interface TranscriptionOptions {
  languageCode: string;
  model: "chirp_2" | "latest_long";
  enableWordTimestamps: boolean;
}

interface TranscriptionResult {
  transcript: string;
  words: TimedWord[];
  confidence: number;
}

interface AlignmentOptions {
  languageCode: string;
  toleranceSec: number;
}

interface AlignedTranscript {
  words: TimedWord[];
  alignmentQuality: "high" | "medium" | "low";
  unmatchedWords: string[];
}

interface TimedWord {
  word: string;
  startSec: number;
  endSec: number;
  confidence: number;
}
```

### 4.7 Operational Deployment

Whisper transcription runs as a worker-stage dependency, typically sidecar or isolated worker execution.

```
faster-whisper model: large-v3
Task: transcribe
Language: {language_code}
Word timestamps: true
VAD filter: true
```

---

## 5. Stage 12: Subtitle Generation & Chunking

### 5.1 Purpose

Convert raw word-level timing data into readable subtitle segments. This is a critical quality stage — bad subtitles ruin the ad even if everything else is perfect.

### 5.2 Subtitle Chunking Rules

| Rule                     | Value            | Rationale                                 |
| ------------------------ | ---------------- | ----------------------------------------- |
| Max lines on screen      | 2                | More than 2 lines is unreadable on mobile |
| Max characters per line  | 35               | Fits mobile screens at readable font size |
| Max words per chunk      | 8                | Cognitive load limit for fast-reading     |
| Min display duration     | 0.8 seconds      | Anything shorter is unreadable            |
| Max display duration     | 5.0 seconds      | Avoid stale subtitles                     |
| Avoid orphan words       | Yes              | Single-word lines look bad                |
| Punctuation-aware breaks | Yes              | Break at commas, periods, not mid-phrase  |
| No overlap               | Yes              | One chunk must end before the next begins |
| Gap between chunks       | 50-100ms minimum | Prevents visual stutter                   |

### 5.3 Chunking Algorithm

```
Input: TimedWord[] — word-level timestamps from transcription

1. Initialize current_chunk = []
2. For each word in TimedWord[]:
   a. Add word to current_chunk
   b. Check if chunk should break:
      - current_chunk word count >= max_words (8)
      - current_chunk character count >= max_chars (70 for 2 lines)
      - word ends with sentence-ending punctuation (. ! ?)
      - word ends with clause-ending punctuation (, ; :) AND chunk has >= 4 words
      - next word starts a new scene boundary
   c. If break:
      - Finalize current_chunk with start=first_word.start, end=last_word.end
      - Split into lines (max 2 lines, balanced character count)
      - Start new current_chunk
3. Finalize last chunk
4. Apply minimum duration padding
5. Apply gap between consecutive chunks
```

### 5.4 Line Breaking Within a Chunk

When a chunk has more text than fits on one line:

```
"AdPilot turns your product info into scroll-stopping ads"

Line breaking options:
  ✗ "AdPilot turns your product info into" / "scroll-stopping ads"  (imbalanced)
  ✓ "AdPilot turns your product info" / "into scroll-stopping ads"  (balanced)

Strategy:
  1. Find the midpoint character index
  2. Search for the nearest word boundary near the midpoint
  3. Prefer breaking at natural phrase boundaries
  4. Balance line lengths (neither line should be >60% of total)
```

### 5.5 Subtitle Style Presets

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
| `AudioExtractorService`         | FFmpeg audio extraction and normalization      |
| `SubtitleGeneratorService`      | Transcription → alignment → chunking → styling |
| `TimelineAssemblerService`      | Combine all artifacts into render spec         |
| `SpeechAlignmentAdapter` (impl) | Chirp transcription + forced alignment         |
| `FFmpegService`                 | Audio processing utilities                     |

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
| Audio normalization | FFmpeg (self-hosted)     | Compute only       |
| Chirp transcription | Vertex AI Speech-to-Text | ~$0.016 per minute |
| Forced alignment    | Computed locally         | Compute only       |
| Subtitle chunking   | Algorithmic              | Compute only       |
| Timeline assembly   | Algorithmic              | Compute only       |
