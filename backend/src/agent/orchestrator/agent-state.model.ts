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

  /** Phase 1 status */
  phase1Status: PhaseStatus;

  /** Phase 2 status */
  phase2Status: PhaseStatus;

  /** Selected scenario ID (set by user) */
  selectedScenarioId?: number;

  /** Stage artifacts (stored as JSON) */
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
  phase1StartedAt?: Date;
  phase1CompletedAt?: Date;
  phase2StartedAt?: Date;
  phase2CompletedAt?: Date;
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
 * Phase 1 stages (fast, returns scenarios)
 */
export const PHASE_1_STAGES: AgentStage[] = [
  'created',
  'platform_ready',
  'normalized',
  'context_ready',
  'brief_ready',
  'scenarios_ready',
];

/**
 * Phase 2 stages (slow, generates video)
 */
export const PHASE_2_STAGES: AgentStage[] = [
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
 * Get the phase for a given stage
 */
export function getPhase(stage: AgentStage): 1 | 2 | null {
  if (PHASE_1_STAGES.includes(stage)) return 1;
  if (PHASE_2_STAGES.includes(stage)) return 2;
  return null;
}
