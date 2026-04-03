# Veo 3.1 Structured Prompt Implementation

**Status:** ✅ Ready  
**Date:** 2026-03-31

## What Changed

Upgraded Veo prompts from simple text to structured, detailed prompts using Gemini 2.5 Pro.

**Before:** `"Create a TikTok ad for wireless earbuds"`

**After:** `"Close-up product showcase video of wireless earbuds on marble surface. Close-up centered on product with shallow depth of field. Camera angle: slightly elevated looking down at 30 degrees. Camera motion: slow push in. 35mm cinematic lens with natural bokeh. Setting: modern minimalist studio tabletop. Lighting: soft studio key light from upper left. The speaker says: 'These earbuds changed everything for me...' Voice style: conversational, warm. Visual style: cinematic, photorealistic. Aesthetic: Apple product launch video aesthetic."`

**Result:** Better video quality, more coherent visuals.

---

## Setup (5 minutes)

```bash
# 1. Get API key: https://aistudio.google.com/app/apikey

# 2. Add to backend/.env
GEMINI_API_KEY=your_key_here

# 3. Restart
cd backend && npm run start:dev
```

---

## Architecture

```
Input → Brief → Script → Gemini Scene Structuring → Veo Prompt Builder → Veo 3.1 → Subtitles → Render
                              ↓
                        VeoScenePrompt (structured JSON)
                              ↓
                        Serialized natural language prompt
```

**New Components:**
- `GeminiService` - Gemini 2.5 Pro integration
- `SceneStructuringService` - Converts brief+script → VeoScenePrompt
- `VeoPromptBuilderService` - Serializes JSON → text
- `VeoScenePrompt` type - Structured prompt schema

**Files:**
```
backend/src/
├── ai/gemini.service.ts
├── ads/services/scene-structuring.service.ts
├── ads/services/veo-prompt-builder.service.ts
└── ads/types/veo-scene-prompt.ts
```

---

## VeoScenePrompt Schema

```typescript
{
  scene_id: 1,
  duration_seconds: 8,
  aspect_ratio: "9:16",
  prompt: {
    intent: "Close-up product showcase...",
    shot: { framing, camera_angle, camera_motion, lens_feel, composition },
    subject: { type, description, action, identity_notes },
    environment: { location, props, atmosphere, time_of_day },
    lighting: { style, color_temperature, practical_lights },
    audio: { speech_text, speech_style, ambient_sound },
    style: { visual_style, color_palette, rendering_quality, aesthetic_reference },
    text_overlay: { enabled, text, position, style_hint },
    cta: { enabled, text, url_hint }
  },
  negative_prompt: "no text burned, no watermark...",
  generation_config: { model, seed, safety_filter, retry_count, priority }
}
```

---

## Performance & Cost

| Metric | Value |
|---|---|
| Total latency | ~2-3 minutes |
| Gemini latency | ~3-5 seconds |
| Veo latency | ~60-90 seconds |
| Gemini cost | Free (15 RPM) or paid tier |
| Veo cost | $1.20-$3.20 per 8s ad |

---

## Monitoring

**Success logs:**
```
[GeminiService] Gemini service initialized with gemini-2.5-pro
[SceneStructuringService] Structuring single 8-second scene with Gemini
[SceneStructuringService] Scene structured: 8s, speech length: 123 chars
[AdsService] Veo prompt (1234 chars): Close-up product showcase...
[AdsService] Job completed successfully
```

**Error logs:**
```
[GeminiService] Gemini generation failed: 429  # Rate limit
[GeminiService] Gemini generation failed: 401  # Invalid key
[SceneStructuringService] Gemini returned invalid scene structure  # Bad response
```

**Firestore check:**
```json
{
  "metadata": {
    "scenePrompt": {
      "intent": "...",
      "fullPrompt": "...",
      "visualStyle": "cinematic"
    }
  }
}
```

---

## Troubleshooting

| Issue | Fix |
|---|---|
| "GEMINI_API_KEY is required" | Add to `.env` and restart |
| Gemini 429 errors | Rate limit (15 RPM free), wait or upgrade |
| "gemini-2.0-flash-exp is not found" | Model deprecated, using gemini-2.5-pro now |
| "Cannot read properties of undefined" | Gemini response validation added, check logs |
| Poor video quality | Check `metadata.scenePrompt.fullPrompt` |
| Subtitles out of sync | Check `metadata.subtitleScaling.scalingFactor` (should be 0.9-1.1) |

---

## Rollback

Comment out in `ads.service.ts`:
```typescript
// const scenePrompt = await this.sceneStructuringService.structureSingleScene(...);
// const veoPromptString = this.veoPromptBuilderService.buildVeoPromptString(scenePrompt);

// Use old:
const veoPromptString = this.buildPromptFromScript(createAdDto, script);
```

---

## Why Single 8-Second Scene?

- Simpler MVP (no scene stitching)
- Same cost as multi-scene (Veo charges per second)
- Faster debugging
- Architecture supports multi-scene expansion later

**Future multi-scene:** Update script generation → `voiceoverLines[]`, scene structuring → `VeoScenePrompt[]`, add parallel Veo calls.

---

## Key Insights from Research

- Veo 3.1: 50 RPM, 2-10 concurrent requests
- Charges per second, not per request
- Embedded audio (no separate TTS)
- 8-second max per request
- Script-derived subtitles > audio transcription (faster, more accurate)

---

## Reference

- Original guide: `docs/VEO_PROMPT_TEMPLATE_GUIDE.md`
- Veo docs: https://cloud.google.com/vertex-ai/generative-ai/docs/models/veo/3-1-generate
- Gemini API: https://ai.google.dev/gemini-api/docs
- Get key: https://aistudio.google.com/app/apikey
