# Phase 3 — Asset Resolution & Scene Video Generation

**Parent Document:** `PRD_00_OVERVIEW.md`  
**Agent Stages:** `scenes_ready → assets_ready → audio_ready`

---

## 1. Phase Objective

For each planned scene, resolve the visual asset — selecting from uploaded media, scraped product images, stock footage, AI-generated images, or AI-generated video. Then generate scene video output using Veo, with embedded speech treated as the source-of-truth voice track for downstream subtitle timing.

This phase converts the abstract scene plan into concrete media files ready for composition.

---

## 2. Pipeline Stages in This Phase

```
ScenePlan[]
  → Stage 8: Asset Resolution (per scene)
  → Stage 9: Scene Video Generation with Veo
  → Output: ResolvedAsset[] + GeneratedSceneVideo[]
```

### 2.1 Stack Alignment Note

This phase assumes the production stack uses:

- uploaded assets + scraped media + stock media + Imagen for visual sourcing
- Veo for generated motion and embedded speech
- no separate standalone TTS service for the core ad pipeline

---

## 3. Stage 8: Asset Resolution

### 3.1 Purpose

For each scene in the scene plan, determine and acquire the best available visual asset. The agent follows a priority-based strategy that prefers real product media over generated content.

### 3.2 Asset Priority Order

The agent resolves assets for each scene using this priority:

```
1. User-uploaded brand/product assets  (highest trust, best brand fit)
2. Scraped product media               (real product visuals)
3. Stock media                         (professional, diverse)
4. AI-generated images (Imagen)        (custom but synthetic)
5. AI-generated video (Veo)            (most expensive, last resort)
```

### 3.3 Resolution Process Per Scene

```
For each scene in ScenePlan[]:

  1. Read scene.visual.preferred_source
  2. If preferred_source = "uploaded" AND product_image_index is set:
       → Check if uploaded asset at that index exists and is usable
       → If yes: use it
       → If no: fall through to next source

  3. If preferred_source = "scraped" OR uploaded failed:
       → Check scraped image_urls from ProductContext
       → Select best match based on scene purpose
       → If found: download and validate
       → If no: fall through

  4. If preferred_source = "stock" OR previous failed:
       → Search stock media API with scene.visual.prompt
       → Filter by aspect ratio compatibility
       → Select top result
       → If found: download
       → If no: fall through

  5. If preferred_source = "generated" OR previous failed:
       → Generate image via Imagen using scene.visual.prompt
       → If successful: use generated image
       → If failed: try Veo video generation as final fallback

  6. If all sources fail:
       → Mark scene as asset_missing
       → Agent will use a solid color / gradient placeholder
       → Quality gate will flag this
```

### 3.4 Asset Validation Rules

Every resolved asset must pass these checks before acceptance:

| Check                           | Rule                                          | Failure Action  |
| ------------------------------- | --------------------------------------------- | --------------- |
| File exists and is downloadable | HTTP 200 or GCS accessible                    | Try next source |
| File type is supported          | jpg, png, webp, mp4, webm                     | Try next source |
| Resolution is sufficient        | Min 720px on short side                       | Try next source |
| Aspect ratio is compatible      | Can be cropped to target without losing > 30% | Try next source |
| File size is reasonable         | < 50MB for video, < 10MB for images           | Try next source |
| Content is not blank/corrupted  | Basic image validation                        | Try next source |

### 3.5 Asset Crop Strategy

When an asset's aspect ratio doesn't match the target:

| Source Ratio | Target Ratio | Strategy                                 |
| ------------ | ------------ | ---------------------------------------- |
| 16:9         | 9:16         | Center crop with Ken Burns zoom          |
| 1:1          | 9:16         | Center with blurred background extension |
| 4:3          | 9:16         | Center crop or letterbox                 |
| 9:16         | 9:16         | Use as-is                                |
| Any          | 1:1          | Center crop                              |

### 3.6 Stock Media Integration

**Provider:** Google-compatible stock API or Pexels/Pixabay (free tier for MVP)

**Search Strategy:**

```
1. Use scene.visual.prompt as search query
2. Filter by:
   - Media type (image or video based on scene.visual.type)
   - Orientation (portrait for 9:16, square for 1:1)
   - Minimum resolution
3. Return top 3 candidates
4. Select first that passes validation
```

**Stock Media Adapter Interface:**

```typescript
interface StockMediaAdapter {
  search(
    query: string,
    options: StockSearchOptions,
  ): Promise<StockMediaResult[]>;
  download(mediaId: string): Promise<Buffer>;
}

interface StockSearchOptions {
  mediaType: "image" | "video";
  orientation: "portrait" | "landscape" | "square";
  minWidth: number;
  minHeight: number;
  perPage: number;
}

interface StockMediaResult {
  id: string;
  type: "image" | "video";
  url: string;
  downloadUrl: string;
  width: number;
  height: number;
  duration?: number;
  source: string;
}
```

### 3.7 AI Image Generation via Imagen

When stock media is unavailable or the scene requires a custom visual:

**Google Service:** Imagen 3 (Vertex AI)

**Generation Process:**

1. Take `scene.visual.prompt` as the generation prompt
2. Add aspect ratio constraint
3. Generate image
4. Validate output
5. Upload to GCS

**Imagen Request Parameters:**

```json
{
  "prompt": "Frustrated marketer sitting at desk with multiple browser tabs open, editing software on screen, warm office lighting, photorealistic",
  "aspect_ratio": "9:16",
  "number_of_images": 1,
  "safety_filter_level": "block_medium_and_above",
  "person_generation": "allow_adult"
}
```

**Image Generation Adapter Interface:**

```typescript
interface ImageGenerationAdapter {
  generate(prompt: string, options: ImageGenOptions): Promise<GeneratedImage>;
}

interface ImageGenOptions {
  aspectRatio: "9:16" | "16:9" | "1:1";
  numberOfImages: number;
  safetyLevel: string;
  personGeneration?: string;
}

interface GeneratedImage {
  storageKey: string;
  width: number;
  height: number;
  mimeType: string;
}
```

### 3.8 AI Video Generation via Veo

Used when the scene specifically needs motion, spoken output, or no suitable stock video is found.

**Google Service:** Veo 3.1 (Vertex AI)

**When to use Veo:**

- Scene type is `lifestyle` or `abstract` and no stock video found
- Scene requires custom motion that can't be achieved with Ken Burns on a still image
- The agent determines that a static image would not serve the scene purpose
- Scene requires generated spoken output that should later drive subtitle timing

**Veo is NOT used for:**

- Every scene (too expensive and slow)
- Product shots (uploaded/scraped images are better)
- Text animation scenes (renderer handles these)
- CTA scenes (simple graphic overlay)

**Video Generation Adapter Interface:**

```typescript
interface VideoGenerationAdapter {
  generate(prompt: string, options: VideoGenOptions): Promise<GeneratedVideo>;
}

interface VideoGenOptions {
  aspectRatio: "9:16" | "16:9" | "1:1";
  durationSeconds: number;
  negativePrompt?: string;
  personGeneration?: string;
}

interface GeneratedVideo {
  storageKey: string;
  downloadUrl: string;
  durationSeconds: number;
  hasAudio: boolean;
}
```

### 3.8.1 GeneratedSceneVideo Output Schema

```json
{
  "scene_id": 2,
  "storage_key": "ads/ad-uuid/scenes/scene_2.mp4",
  "download_url": "https://storage.googleapis.com/.../scene_2.mp4",
  "duration_sec": 8,
  "has_embedded_speech": true,
  "audio_source_of_truth": true
}
```

### 3.9 ResolvedAsset Output Schema

```json
{
  "scene_id": 1,
  "asset_type": "image",
  "source": "stock",
  "storage_key": "ads/ad-uuid/assets/scene_1_stock.jpg",
  "original_url": "https://images.pexels.com/...",
  "width": 1080,
  "height": 1920,
  "mime_type": "image/jpeg",
  "duration_sec": null,
  "crop_strategy": "none",
  "has_audio": false
}
```

### 3.10 Asset Resolution Summary Per Scene

After resolution, each scene should have:

| Field           | Description                                                          |
| --------------- | -------------------------------------------------------------------- |
| `asset_type`    | `image` or `video`                                                   |
| `source`        | `uploaded`, `scraped`, `stock`, `generated_image`, `generated_video` |
| `storage_key`   | GCS path to the downloaded/generated asset                           |
| `crop_strategy` | How to fit the asset to target aspect ratio                          |
| `has_audio`     | Whether the video asset contains embedded audio                      |

---

### 3.11 Reusable Account-Level Inputs

This phase may consume reusable workspace/account-level resources defined in [`plans/PRD_00_5_PLATFORM_FOUNDATION.md`](plans/PRD_00_5_PLATFORM_FOUNDATION.md):

- product assets
- avatars
- pre-made templates / dynamic JSON scripts

These resources are not generated inside Phase 3 itself; they are resolved from platform-owned libraries and injected into planning/generation.

### 3.12 Template and Avatar Usage

When present, the agent may use templates and avatars as generation constraints:

- templates may predefine scene structure, motion, overlay layout, subtitle style, and CTA behavior
- avatars may define a presenter layer for supported scene types
- product assets should be preferred over generated visuals when they satisfy quality requirements

If a template is selected, scene planning and rendering should preserve its required JSON contract unless an explicit regeneration step allows deviation.

---

## 4. Legacy Voice Generation Notes

This section is retained as historical context from an earlier design direction.

The canonical production path uses Veo scene/video generation with embedded speech, followed by audio extraction and transcription in later phases.

## 5. Stage 9: Voice Generation

### 4.1 Purpose

Convert the complete script narration into a voiceover audio track. The voice track is the temporal backbone of the ad — subtitle timing and scene timing are derived from it.

### 4.2 Voice Generation Strategy

There are two paths for voice in the MVP:

#### Path A: Dedicated TTS Generation (Primary)

- Concatenate all scene narrations into a single script
- Send to Google Cloud TTS
- Receive audio + timing metadata
- Use this as the voiceover track

#### Path B: Veo Embedded Speech (Alternative)

- If Veo generates video with embedded speech (Veo 3.1 supports this)
- Extract audio from the generated video
- Use as voiceover track
- This only works if Veo is used for the full ad (not scene-by-scene)

**MVP uses Path A** because it gives precise control over timing and voice selection.

### 4.3 TTS Generation Process

```
1. Collect all scene narrations in order:
   "Still spending hours editing ad videos?
    AdPilot turns your product info into scroll-stopping ads in minutes.
    Auto subtitles. Social-ready exports. One click.
    Start creating ads that convert. Try AdPilot free today."

2. Add SSML markers between scenes for pause insertion:
   <speak>
     <p>Still spending hours editing ad videos?</p>
     <break time="500ms"/>
     <p>AdPilot turns your product info into scroll-stopping ads in minutes.</p>
     <break time="300ms"/>
     <p>Auto subtitles. Social-ready exports. One click.</p>
     <break time="500ms"/>
     <p>Start creating ads that convert. Try AdPilot free today.</p>
   </speak>

3. Send to Google Cloud TTS with selected voice
4. Receive audio file (MP3 or WAV)
5. Receive timing metadata (if available from provider)
6. Upload audio to GCS
7. Store AudioTrack artifact
8. Transition state to audio_ready
```

### 4.4 Google Cloud TTS Configuration

**Service:** Google Cloud Text-to-Speech API

**Voice Selection:**

| Voice ID           | Name       | Gender | Language     | Style          |
| ------------------ | ---------- | ------ | ------------ | -------------- |
| `en-US-Studio-O`   | Olivia     | Female | English (US) | Conversational |
| `en-US-Studio-M`   | Marcus     | Male   | English (US) | Authoritative  |
| `en-US-Journey-F`  | Journey F  | Female | English (US) | Warm           |
| `en-US-Journey-D`  | Journey D  | Male   | English (US) | Professional   |
| `de-DE-Studio-B`   | Studio B   | Male   | German       | Professional   |
| `de-DE-Studio-C`   | Studio C   | Female | German       | Conversational |
| `tr-TR-Standard-A` | Standard A | Female | Turkish      | Standard       |

**Request Configuration:**

```json
{
  "input": {
    "ssml": "<speak>...</speak>"
  },
  "voice": {
    "languageCode": "en-US",
    "name": "en-US-Studio-O",
    "ssmlGender": "FEMALE"
  },
  "audioConfig": {
    "audioEncoding": "MP3",
    "speakingRate": 1.0,
    "pitch": 0,
    "sampleRateHertz": 24000,
    "effectsProfileId": ["small-bluetooth-speaker-class-device"]
  },
  "enableTimePointing": ["SSML_MARK"]
}
```

### 4.5 Timing Metadata

Google Cloud TTS can return timing data via `enableTimePointing`. If available, this provides:

- Start time of each SSML `<mark>` tag
- This gives scene boundary timestamps

If word-level timing is not available from TTS, it will be recovered in Phase 4 via transcription and forced alignment.

### 4.6 Speaking Rate Adjustment

The agent may need to adjust speaking rate to fit the target duration:

```
Expected duration = total_words / 2.5 (words per second at normal rate)
Actual TTS duration = measured from output audio

If actual > target * 1.15:
  → Regenerate with speakingRate: 1.1 to 1.2
If actual < target * 0.85:
  → Regenerate with speakingRate: 0.9 to 0.85
If within tolerance:
  → Accept
```

### 4.7 AudioTrack Output Schema

```json
{
  "project_id": "ad-uuid",
  "voice_id": "en-US-Studio-O",
  "storage_key": "ads/ad-uuid/audio/voiceover.mp3",
  "duration_sec": 28.5,
  "sample_rate_hz": 24000,
  "format": "mp3",
  "scene_boundaries": [
    { "scene": 1, "start_sec": 0.0, "end_sec": 4.2 },
    { "scene": 2, "start_sec": 4.7, "end_sec": 12.1 },
    { "scene": 3, "start_sec": 12.4, "end_sec": 18.8 },
    { "scene": 4, "start_sec": 19.3, "end_sec": 28.5 }
  ],
  "timing_source": "tts_markers"
}
```

### 4.8 TTS Adapter Interface

```typescript
interface TTSAdapter {
  synthesize(script: string, options: TTSOptions): Promise<TTSResult>;
  listVoices(language?: string): Promise<VoiceInfo[]>;
}

interface TTSOptions {
  voiceId: string;
  languageCode: string;
  speakingRate: number;
  pitch: number;
  audioEncoding: "MP3" | "WAV" | "OGG_OPUS";
  ssml: boolean;
}

interface TTSResult {
  audioBuffer: Buffer;
  durationSec: number;
  timingMarks: TimingMark[];
  sampleRateHz: number;
}

interface TimingMark {
  markName: string;
  timeSeconds: number;
}

interface VoiceInfo {
  id: string;
  name: string;
  gender: "male" | "female";
  languageCode: string;
  previewUrl?: string;
}
```

---

## 5. Background Music (Optional)

### 5.1 Music Strategy

If `no_background_music` is false (default), the agent selects a background music track.

**MVP Approach:**

- Maintain a curated library of royalty-free music tracks in GCS
- Categorize by mood: `upbeat`, `corporate`, `emotional`, `energetic`, `calm`
- Select based on `tone` from the creative brief
- Music plays at 15-20% volume relative to voiceover

| Tone           | Music Mood  |
| -------------- | ----------- |
| `direct`       | `corporate` |
| `professional` | `corporate` |
| `casual`       | `upbeat`    |
| `enthusiastic` | `energetic` |

### 5.2 Music Track Schema

```json
{
  "id": "bgm_corporate_01",
  "mood": "corporate",
  "duration_sec": 60,
  "storage_key": "music/corporate_01.mp3",
  "bpm": 120,
  "license": "royalty_free"
}
```

---

## 6. Quality Gate: Asset & Audio Readiness

Before transitioning to Phase 4, the agent checks:

| Check                                           | Required  | Failure Action                            |
| ----------------------------------------------- | --------- | ----------------------------------------- |
| Every scene has a resolved asset                | Yes       | Retry asset resolution for failing scenes |
| No scene has `asset_missing` status             | Preferred | Warn if placeholder used                  |
| All assets are uploaded to GCS                  | Yes       | Retry upload                              |
| All assets pass validation (resolution, format) | Yes       | Swap to next source                       |
| Voiceover audio exists                          | Yes       | Retry TTS generation                      |
| Audio duration within ±20% of target            | Yes       | Adjust speaking rate and regenerate       |
| Audio file is playable                          | Yes       | Retry TTS                                 |

---

## 7. Implementation Services

| Service                         | Responsibility                                              |
| ------------------------------- | ----------------------------------------------------------- |
| `AssetResolverService`          | Orchestrate per-scene asset resolution using priority chain |
| `VoiceGeneratorService`         | Generate voiceover via TTS, handle rate adjustment          |
| `StockMediaAdapter` (impl)      | Search and download stock media                             |
| `ImageGenerationAdapter` (impl) | Imagen generation via Vertex AI                             |
| `VideoGenerationAdapter` (impl) | Veo generation via Vertex AI (existing service, refactored) |
| `TTSAdapter` (impl)             | Google Cloud TTS integration                                |
| `GcsStorageService` (existing)  | Upload and store all assets                                 |

---

## 8. Output Artifacts

| Artifact          | Stored As                          | Used By                                |
| ----------------- | ---------------------------------- | -------------------------------------- |
| `ResolvedAsset[]` | `assets` table (one row per scene) | Timeline assembler, renderer           |
| `AudioTrack`      | `audio_tracks` table               | Subtitle generator, timeline assembler |
| `BackgroundMusic` | Selected from library              | Timeline assembler                     |

---

## 9. Cost Considerations

| Operation               | Provider       | Estimated Cost                            |
| ----------------------- | -------------- | ----------------------------------------- |
| Stock media search      | Pexels/Pixabay | Free (API tier)                           |
| Imagen image generation | Vertex AI      | ~$0.02 per image                          |
| Veo video generation    | Vertex AI      | ~$0.35 per 5-8 seconds                    |
| Google Cloud TTS        | Cloud TTS      | ~$0.016 per 1M characters (Studio voices) |
| GCS storage             | Cloud Storage  | ~$0.02/GB/month                           |

**Cost optimization strategy:**

- Prefer stock and uploaded assets over generation
- Use Imagen over Veo when a still image with Ken Burns motion suffices
- Use Veo only when motion is essential and no stock video matches
- Cache common stock media results
