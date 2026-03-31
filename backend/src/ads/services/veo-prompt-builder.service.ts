import { Injectable } from '@nestjs/common';
import { VeoScenePrompt } from '../types/veo-scene-prompt';

@Injectable()
export class VeoPromptBuilderService {
  /**
   * Converts a structured VeoScenePrompt into a natural language prompt string
   * that Veo 3.1 can consume.
   */
  buildVeoPromptString(scene: VeoScenePrompt): string {
    const p = scene.prompt;
    const parts: string[] = [];

    // Core visual intent
    parts.push(p.intent);

    // Shot details
    parts.push(`${p.shot.framing}.`);
    parts.push(`Camera angle: ${p.shot.camera_angle}.`);
    if (p.shot.camera_motion && p.shot.camera_motion !== 'static') {
      parts.push(`Camera motion: ${p.shot.camera_motion.replace(/_/g, ' ')}.`);
    }
    parts.push(`${p.shot.lens_feel}.`);

    // Subject action
    if (p.subject.action) {
      parts.push(p.subject.action);
    }

    // Identity persistence (for person subjects across scenes)
    if (p.subject.identity_notes) {
      parts.push(p.subject.identity_notes);
    }

    // Environment
    parts.push(`Setting: ${p.environment.location}.`);
    if (p.environment.props && p.environment.props.length > 0) {
      parts.push(`Props: ${p.environment.props.join(', ')}.`);
    }
    parts.push(`Atmosphere: ${p.environment.atmosphere}.`);
    if (p.environment.time_of_day) {
      parts.push(`Time of day: ${p.environment.time_of_day}.`);
    }

    // Lighting
    parts.push(`Lighting: ${p.lighting.style}.`);
    parts.push(`Color temperature: ${p.lighting.color_temperature}.`);
    if (p.lighting.practical_lights) {
      parts.push(`Practical lights: ${p.lighting.practical_lights}.`);
    }

    // Audio/speech direction
    parts.push(`The speaker says: "${p.audio.speech_text}"`);
    parts.push(`Voice style: ${p.audio.speech_style}.`);
    if (p.audio.ambient_sound) {
      parts.push(`Ambient sound: ${p.audio.ambient_sound}.`);
    }

    // Style
    parts.push(
      `Visual style: ${p.style.visual_style}, ${p.style.rendering_quality}.`,
    );
    parts.push(`Color palette: ${p.style.color_palette}.`);
    parts.push(`Aesthetic: ${p.style.aesthetic_reference}.`);

    return parts.join(' ');
  }
}
