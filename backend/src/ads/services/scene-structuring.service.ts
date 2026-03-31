import { Injectable, Logger } from '@nestjs/common';
import { GeminiService } from '../../ai/gemini.service';
import { VeoScenePrompt } from '../types/veo-scene-prompt';
import { CreateAdDto } from '../dto/create-ad.dto';
import { CreativeBrief } from '../types/creative-brief';
import { GeneratedScript } from '../types/generated-script';

const SINGLE_SCENE_STRUCTURING_SYSTEM_PROMPT = `You are a video ad scene director for PhanesUGC. Your job is to take a completed ad script and its creative context, and produce a structured JSON scene prompt that will be sent to a video generation AI (Veo 3.1).

## Your Role
You receive:
1. A creative brief with product info, tone, audience, and visual style
2. A completed script with the full ad narration
3. Technical constraints (platform, aspect ratio, duration=8 seconds, language)

You produce:
ONE scene prompt object following the exact schema provided.

## Rules

### Single Scene Constraints
- Duration: EXACTLY 8 seconds
- This is the ENTIRE ad in one shot
- The scene must be visually dynamic enough to hold attention for 8 seconds
- The narration should fit naturally within 8 seconds when spoken

### Visual Storytelling for Single Scene
- Choose ONE clear visual concept that represents the entire ad message
- The scene should visually escalate or reveal something during the 8 seconds
- Use camera motion to add dynamism (slow push-in, slow pull-out, or tracking)
- Consider product showcase, lifestyle context, or testimonial-style framing

### Product Representation
- The product should be visible or clearly referenced
- Use the product description to write accurate visual descriptions
- If brand colors are available, incorporate them into color_palette
- Never invent product features not present in the input

### People in Scenes
- If the target audience suggests a demographic, cast accordingly
- For UGC/testimonial style: use selfie angles, casual settings, smartphone camera feel
- For product showcase style: use studio lighting, clean compositions

### Audio/Speech
- speech_text must contain the FULL ad narration (hook + body + CTA)
- speech_style should match the tone preference:
  - direct → "clear, confident, measured pace"
  - professional → "authoritative, polished, steady pace"
  - casual → "relaxed, conversational, natural pace"
  - enthusiastic → "energetic, upbeat, slightly faster pace"

### Negative Prompt
- Always include this base: "no text burned into video, no watermark, no logo, no split screen, no collage, no anime, no cartoon, no low resolution, no blurry"
- Add "no distorted faces, no extra limbs, no unnatural skin" for any scene with people

### Text Overlays
- Enable text_overlay for hook or key message
- Overlay text should be short (3-6 words max)
- Position overlays in top_third to avoid subtitle conflict at bottom

### CTA
- cta.enabled should be true (this is the only scene)
- Use the user-provided CTA text, or generate one if not provided

### Transitions
- transition_in: "cut" (first scene)
- transition_out: "fade" (last scene)

### Platform-Specific Notes
- TikTok: fast pacing, high energy, trend-aware visuals
- Instagram Reels: polished, aspirational, lifestyle-forward
- YouTube Shorts: slightly more informational, can be calmer

## Output Format
Return ONLY a valid JSON object (not an array). No markdown, no explanation, no wrapping.
The object must follow the VeoScenePrompt schema exactly.

## Example Output Structure
{
  "scene_id": 1,
  "project_id": "placeholder",
  "duration_seconds": 8,
  "aspect_ratio": "9:16",
  "prompt": {
    "intent": "...",
    "shot": { ... },
    "subject": { ... },
    "environment": { ... },
    "lighting": { ... },
    "audio": {
      "speech_text": "FULL AD NARRATION HERE",
      "speech_style": "...",
      ...
    },
    "style": { ... },
    "text_overlay": { ... },
    "cta": {
      "enabled": true,
      "text": "...",
      ...
    }
  },
  "transition_in": "cut",
  "transition_out": "fade",
  "negative_prompt": "...",
  "generation_config": {
    "model": "veo-3.1-generate-001",
    "seed": null,
    "safety_filter": "standard",
    "retry_count": 0,
    "priority": "normal"
  }
}`;

@Injectable()
export class SceneStructuringService {
  private readonly logger = new Logger(SceneStructuringService.name);

  constructor(private readonly geminiService: GeminiService) {}

  async structureSingleScene(
    createAdDto: CreateAdDto,
    brief: CreativeBrief,
    script: GeneratedScript,
  ): Promise<VeoScenePrompt> {
    const userPrompt = this.buildUserPrompt(createAdDto, brief, script);

    this.logger.log('Structuring single 8-second scene with Gemini');

    const scene = (await this.geminiService.generateContent(
      SINGLE_SCENE_STRUCTURING_SYSTEM_PROMPT,
      userPrompt,
    )) as VeoScenePrompt;

    return this.validateAndEnrich(scene, createAdDto, script);
  }

  private buildUserPrompt(
    createAdDto: CreateAdDto,
    brief: CreativeBrief,
    script: GeneratedScript,
  ): string {
    return `Generate a single 8-second scene prompt for this ad:

## Technical Constraints
- Platform: ${createAdDto.prompt_inputs.platform}
- Aspect Ratio: ${createAdDto.veo_config.aspect_ratio}
- Duration: 8 seconds (FIXED)
- Language: ${createAdDto.prompt_inputs.language}

## Product
- Name: ${createAdDto.prompt_inputs.product_info?.name || 'Not provided'}
- Description: ${createAdDto.prompt_inputs.product_info?.description || 'Not provided'}
- Benefits: ${createAdDto.prompt_inputs.product_info?.benefits?.join(', ') || 'Not provided'}
${brief.key_message ? `- Key Message: ${brief.key_message}` : ''}

## Creative Direction
- Tone: ${createAdDto.prompt_inputs.tone || 'direct'}
- Visual Style: ${brief.visual_style || 'cinematic'}
- Target Audience: ${createAdDto.prompt_inputs.target_audience || 'general'}
- CTA: ${createAdDto.prompt_inputs.cta || 'not specified — generate one'}

## Script
Title: ${script.title || 'Untitled'}
Hook: ${script.hook || ''}
Body: ${script.body || ''}
CTA: ${script.cta || ''}

Full Narration Text:
"${script.full_text}"

## Output
Generate ONE scene prompt object for an 8-second video.
The speech_text field must contain the full narration above.
Return a JSON object only (not an array).`;
  }

  private validateAndEnrich(
    scene: VeoScenePrompt,
    createAdDto: CreateAdDto,
    script: GeneratedScript,
  ): VeoScenePrompt {
    // Force 8 seconds
    scene.duration_seconds = 8;
    scene.scene_id = 1;
    scene.aspect_ratio = createAdDto.veo_config.aspect_ratio;

    // Ensure speech_text contains full script
    if (
      !scene.prompt.audio.speech_text ||
      scene.prompt.audio.speech_text.length < 10
    ) {
      scene.prompt.audio.speech_text = script.full_text;
    }

    // Ensure CTA is enabled
    scene.prompt.cta.enabled = true;
    if (!scene.prompt.cta.text) {
      scene.prompt.cta.text =
        createAdDto.prompt_inputs.cta || script.cta || 'Get Started';
    }

    // Set generation config
    scene.generation_config = {
      model: 'veo-3.1-generate-001',
      seed: null,
      safety_filter: 'standard',
      retry_count: 0,
      priority: 'normal',
    };

    // Ensure base negative prompt
    const baseNeg =
      'no text burned into video, no watermark, no logo, no split screen, no collage, no anime, no cartoon, no low resolution, no blurry';
    if (!scene.negative_prompt?.includes(baseNeg)) {
      scene.negative_prompt =
        baseNeg + (scene.negative_prompt ? ', ' + scene.negative_prompt : '');
    }
    // Add user's negative prompt if provided
    if (createAdDto.veo_config.negative_prompt) {
      scene.negative_prompt += ', ' + createAdDto.veo_config.negative_prompt;
    }

    // Set transitions
    scene.transition_in = 'cut';
    scene.transition_out = 'fade';

    this.logger.log(
      `Scene structured: ${scene.duration_seconds}s, speech length: ${scene.prompt.audio.speech_text.length} chars`,
    );

    return scene;
  }
}
