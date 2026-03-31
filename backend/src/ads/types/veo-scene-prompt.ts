export interface VeoScenePrompt {
  scene_id: number;
  project_id: string;
  duration_seconds: number;
  aspect_ratio: '9:16' | '16:9' | '1:1';

  prompt: {
    intent: string;
    shot: {
      type: string;
      framing: string;
      camera_angle: string;
      camera_motion: string;
      lens_feel: string;
      composition: string;
    };
    subject: {
      type: string;
      description: string;
      action: string;
      identity_notes: string | null;
    };
    environment: {
      location: string;
      props: string[];
      atmosphere: string;
      time_of_day: string | null;
    };
    lighting: {
      style: string;
      color_temperature: string;
      practical_lights: string | null;
    };
    audio: {
      speech_text: string;
      speech_style: string;
      ambient_sound: string | null;
      music_suggestion: string | null;
    };
    style: {
      visual_style: string;
      color_palette: string;
      rendering_quality: string;
      aesthetic_reference: string;
    };
    text_overlay: {
      enabled: boolean;
      text: string | null;
      position: string | null;
      style_hint: string | null;
    };
    cta: {
      enabled: boolean;
      text: string | null;
      url_hint: string | null;
    };
  };

  transition_in: 'cut' | 'fade' | 'slide' | 'dissolve';
  transition_out: 'cut' | 'fade' | 'slide' | 'dissolve';
  negative_prompt: string;

  generation_config: {
    model: string;
    seed: number | null;
    safety_filter: string;
    retry_count: number;
    priority: string;
  };
}
