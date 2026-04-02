/**
 * VeoPrompt - Structured prompt for Veo 3.1 video generation
 *
 * Must conform to VEO_PROMPT_TEMPLATE_GUIDE.md JSON shape.
 * This is the final creative specification before video generation.
 */
export interface VeoPrompt {
  /** Scene identifier (MVP: always 1) */
  sceneId: number;

  /** Project/job identifier */
  projectId: string;

  /** Video duration in seconds */
  durationSeconds: number;

  /** Aspect ratio */
  aspectRatio: '9:16' | '16:9' | '1:1';

  /** Core creative prompt */
  prompt: {
    /** Primary visual intent */
    intent: string;

    /** Shot configuration */
    shot: {
      type: string;
      framing: string;
      cameraAngle: string;
      cameraMotion: string;
      lensFeel: string;
      composition: string;
    };

    /** Subject description and action */
    subject: {
      type: 'product' | 'person' | 'person_with_product' | 'environment';
      description: string;
      action: string;
      identityNotes?: string;
    };

    /** Environment and setting */
    environment: {
      location: string;
      props: string[];
      atmosphere: string;
      timeOfDay?: string;
    };

    /** Lighting setup */
    lighting: {
      style: string;
      colorTemperature: string;
      practicalLights?: string;
    };

    /** Audio/speech direction */
    audio: {
      speechText: string;
      speechStyle: string;
      ambientSound?: string;
      musicSuggestion?: string;
    };

    /** Visual style */
    style: {
      visualStyle: string;
      colorPalette: string;
      renderingQuality: string;
      aestheticReference: string;
    };

    /** Text overlay configuration */
    textOverlay: {
      enabled: boolean;
      text?: string;
      position?: string;
      styleHint?: string;
    };

    /** Call-to-action */
    cta: {
      enabled: boolean;
      text?: string;
      urlHint?: string;
    };
  };

  /** Transition effects */
  transitionIn: 'cut' | 'fade' | 'slide' | 'dissolve';
  transitionOut: 'cut' | 'fade' | 'slide' | 'dissolve';

  /** Negative constraints */
  negativePrompt: string;

  /** Generation configuration */
  generationConfig: {
    model: string;
    seed?: number;
    safetyFilter: string;
    retryCount: number;
    priority: string;
  };

  /** Timestamp when prompt was built */
  builtAt: Date;
}
