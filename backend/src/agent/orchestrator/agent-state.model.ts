/**
 * AgentState - Stage-aware state machine for the agent pipeline
 *
 * Tracks progress through the two-phase pipeline with checkpoint artifacts
 */

export type AgentStage =
  | 'created'
  | 'platform_ready'
  | 'normalized'
  | 'context_ready'
  | 'brief_ready'
  | 'scenarios_ready'
  | 'scenario_selected'
  | 'script_ready'
  | 'veo_prompt_ready'
  | 'veo_generating'
  | 'veo_output_ready'
  | 'subtitles_ready'
  | 'composition_ready'
  | 'rendering'
  | 'completed'
  | 'failed';

export type PhaseStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/**
 * AgentJobState - Complete state for an agent job
 */
export interface AgentJobState {
  /** Job identifier */
  jobId: string;

  /** Business identifier */
  businessId: string;

  /** Current stage */
  stage: AgentStage;

  /** Scenario generation status */
  scenarioGenerationStatus: PhaseStatus;

  /** Video generation status */
  videoGenerationStatus: PhaseStatus;

  /** Selected scenario ID (set by user) */
  selectedScenarioId?: number;

  /** Stage artifacts (stored as JSON - use type assertions when accessing) */
  artifacts: {
    normalizedRequest?: unknown;
    productContext?: unknown;
    creativeBrief?: unknown;
    scenarioSet?: unknown;
    adScript?: unknown;
    veoPrompt?: unknown;
    veoOutput?: unknown;
    subtitleData?: unknown;
    renderTimeline?: unknown;
    finalOutput?: unknown;
  };

  /** Error tracking */
  errors: Array<{
    stage: AgentStage;
    message: string;
    timestamp: Date;
    retryCount: number;
  }>;

  /** Quality reports */
  qualityReports: Array<{
    gate: string;
    status: 'pass' | 'warn' | 'fail';
    issues: string[];
    checkedAt: Date;
  }>;

  /** Timestamps */
  createdAt: Date;
  scenarioGenerationStartedAt?: Date;
  scenarioGenerationCompletedAt?: Date;
  videoGenerationStartedAt?: Date;
  videoGenerationCompletedAt?: Date;
  updatedAt: Date;

  /** Expiry for scenario selection */
  scenarioExpiresAt?: Date;
}

/**
 * Stage transition rules
 */
export const STAGE_TRANSITIONS: Record<AgentStage, AgentStage[]> = {
  created: ['platform_ready'],
  platform_ready: ['normalized'],
  normalized: ['context_ready'],
  context_ready: ['brief_ready'],
  brief_ready: ['scenarios_ready'],
  scenarios_ready: ['scenario_selected'],
  scenario_selected: ['script_ready'],
  script_ready: ['veo_prompt_ready'],
  veo_prompt_ready: ['veo_generating'],
  veo_generating: ['veo_output_ready'],
  veo_output_ready: ['subtitles_ready'],
  subtitles_ready: ['composition_ready'],
  composition_ready: ['rendering'],
  rendering: ['completed', 'failed'],
  completed: [],
  failed: [],
};

/**
 * Scenario generation stages (fast, returns scenarios for user selection)
 */
export const SCENARIO_GENERATION_STAGES: AgentStage[] = [
  'created',
  'platform_ready',
  'normalized',
  'context_ready',
  'brief_ready',
  'scenarios_ready',
];

/**
 * Video generation stages (slow, generates final video after user selection)
 */
export const VIDEO_GENERATION_STAGES: AgentStage[] = [
  'scenario_selected',
  'script_ready',
  'veo_prompt_ready',
  'veo_generating',
  'veo_output_ready',
  'subtitles_ready',
  'composition_ready',
  'rendering',
  'completed',
];

/**
 * Check if a stage transition is valid
 */
export function isValidTransition(from: AgentStage, to: AgentStage): boolean {
  return STAGE_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Get the pipeline stage for a given stage
 */
export function getPipelineStage(
  stage: AgentStage,
): 'scenario_generation' | 'video_generation' | null {
  if (SCENARIO_GENERATION_STAGES.includes(stage)) return 'scenario_generation';
  if (VIDEO_GENERATION_STAGES.includes(stage)) return 'video_generation';
  return null;
}
