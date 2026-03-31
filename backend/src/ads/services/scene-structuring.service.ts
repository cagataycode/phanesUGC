import { Injectable, Logger } from '@nestjs/common';
import { GeminiService } from '../../ai/gemini.service';
import { VeoScenePrompt } from '../types/veo-scene-prompt';
import { CreateAdDto } from '../dto/create-ad.dto';
import { CreativeBrief } from '../types/creative-brief';
import { GeneratedScript } from '../types/generated-script';

const SINGLE_SCENE_STRUCTURING_SYSTEM_PROMPT = `You are a video ad scene director for PhanesUGC. Your job is to take a completed ad script and its creative context, and produce a structured JSON scene prompt that will be sent to a video generation AI (Veo 3.1).

## CRITICAL: ALL FIELDS MUST HAVE REAL VALUES
- NEVER use "undefined" as a value
- NEVER leave fields empty
- If information is missing, infer reasonable defaults
- Be specific and descriptive in every field

## Your Role
You receive:
1. A creative brief with product info, tone, audience, and visual style
2. A completed script with the full ad narration
3. Technical constraints (platform, aspect ratio, duration=8 seconds, language)

You produce:
ONE scene prompt object with ALL fields filled with real, descriptive values.

## Required Field Guidelines

### intent
- 1-2 sentences describing the EXACT visual concept
- Be specific: "Close-up of hands opening a product box" NOT "Create an engaging scene"
- Include the main action and setting

### shot.framing
- Examples: "close-up centered on product", "medium shot waist-up", "wide establishing shot"
- Be specific about what's in frame

### shot.camera_angle
- Examples: "eye level", "slightly elevated looking down at 30 degrees", "low angle looking up"
- Default to "eye level" if unsure

### shot.camera_motion
- Options: "static", "slow_push_in", "slow_pull_out", "pan_left", "pan_right", "tracking"
- Use "slow_push_in" for product focus, "static" for testimonials

### shot.lens_feel
- Examples: "35mm cinematic lens", "50mm natural perspective", "smartphone front camera feel"
- Match to the visual style

### shot.composition
- Describe spatial arrangement
- Example: "product centered, negative space on top for text"

### subject.type
- Options: "product", "person", "person_with_product", "environment"

### subject.description
- Detailed visual description
- Example: "matte black wireless earbuds in white charging case" NOT "product"

### subject.action
- What happens in the scene
- Example: "hand reaches for product, picks it up, examines it closely"

### environment.location
- Specific setting
- Examples: "modern minimalist studio", "cozy bedroom", "busy city street"

### environment.props
- Array of 2-3 supporting objects
- Examples: ["marble surface", "soft fabric"], ["laptop", "coffee cup"]

### environment.atmosphere
- Emotional quality
- Examples: "clean and premium", "warm and inviting", "energetic and vibrant"

### lighting.style
- Describe the lighting setup
- Example: "soft studio key light from upper left with subtle fill from right"

### lighting.color_temperature
- Examples: "warm 3000K", "neutral white 5500K", "cool 7000K"

### audio.speech_text
- MUST be the FULL script text exactly as provided

### audio.speech_style
- Match to tone
- Examples: "clear, confident, measured pace", "relaxed, conversational", "energetic, upbeat"

### style.visual_style
- Use the provided visual_style or default to "cinematic"

### style.color_palette
- Describe dominant colors
- Examples: "neutral tones with black accents", "vibrant primary colors", "warm earth tones"

### style.rendering_quality
- Always: "photorealistic, high detail, 4K texture quality"

### style.aesthetic_reference
- Cultural/brand reference
- Examples: "Apple product launch aesthetic", "Nike commercial energy", "Instagram influencer content"

## Complete Example
{
  "scene_id": 1,
  "project_id": "placeholder",
  "duration_seconds": 8,
  "aspect_ratio": "9:16",
  "prompt": {
    "intent": "Close-up product showcase of wireless earbuds on marble surface, case opening to reveal earbuds with LED indicator",
    "shot": {
      "type": "product_showcase",
      "framing": "close-up centered on product with shallow depth of field",
      "camera_angle": "slightly elevated looking down at 30 degrees",
      "camera_motion": "slow_push_in",
      "lens_feel": "35mm cinematic lens with natural bokeh",
      "composition": "product centered, negative space on top third for text overlay"
    },
    "subject": {
      "type": "product",
      "description": "matte black wireless earbuds in compact white charging case",
      "action": "case lid opens smoothly, revealing earbuds with soft LED pulsing",
      "identity_notes": null
    },
    "environment": {
      "location": "modern minimalist studio tabletop",
      "props": ["marble surface", "soft fabric in background"],
      "atmosphere": "clean, premium, aspirational",
      "time_of_day": null
    },
    "lighting": {
      "style": "soft studio key light from upper left with subtle fill from right",
      "color_temperature": "neutral white, approximately 5500K",
      "practical_lights": null
    },
    "audio": {
      "speech_text": "These earbuds changed everything for me. Crystal clear sound, all-day comfort.",
      "speech_style": "conversational, warm, mid-paced",
      "ambient_sound": "subtle studio room tone",
      "music_suggestion": null
    },
    "style": {
      "visual_style": "cinematic",
      "color_palette": "neutral tones with matte black and white accents",
      "rendering_quality": "photorealistic, high detail, 4K texture quality",
      "aesthetic_reference": "Apple product launch video aesthetic"
    },
    "text_overlay": {
      "enabled": true,
      "text": "Sound That Moves",
      "position": "top_third",
      "style_hint": "large bold sans-serif, white with drop shadow"
    },
    "cta": {
      "enabled": true,
      "text": "Shop Now",
      "url_hint": null
    }
  },
  "transition_in": "cut",
  "transition_out": "fade",
  "negative_prompt": "no text burned into video, no watermark, no logo, no split screen, no collage, no anime, no cartoon, no low resolution, no blurry",
  "generation_config": {
    "model": "veo-3.1-generate-001",
    "seed": null,
    "safety_filter": "standard",
    "retry_count": 0,
    "priority": "normal"
  }
}

## Output Format
Return ONLY a valid JSON object. No markdown, no explanation, no wrapping.
ALL fields must have real values - NO "undefined" strings!`;

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

    let scene: VeoScenePrompt;
    try {
      scene = (await this.geminiService.generateContent(
        SINGLE_SCENE_STRUCTURING_SYSTEM_PROMPT,
        userPrompt,
      )) as VeoScenePrompt;
    } catch (error) {
      this.logger.error(
        `Gemini scene structuring failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(
        `Failed to structure scene with Gemini: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Validate that we got a proper response
    if (!scene || !scene.prompt) {
      this.logger.error(
        `Gemini returned invalid scene structure: ${JSON.stringify(scene)}`,
      );
      throw new Error(
        'Gemini returned invalid scene structure - missing prompt field',
      );
    }

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

    // Ensure speech_text exactly matches full script for determinism
    // This guarantees Veo generates the exact narration we expect and subtitles match
    if (scene.prompt.audio.speech_text !== script.full_text) {
      this.logger.debug(
        `Overriding scene speech_text to match script exactly (was: "${scene.prompt.audio.speech_text?.substring(0, 50)}...")`,
      );
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
