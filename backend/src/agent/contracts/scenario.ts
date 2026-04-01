/**
 * Scenario - Lightweight creative direction preview
 *
 * One of 4 options generated for the user to choose from.
 * This is NOT a full script - it's a preview of the creative approach.
 */
export interface Scenario {
  /** Unique identifier (1-4) */
  scenarioId: number;

  /** Short creative direction name */
  title: string;

  /** The opening line / hook text */
  hook: string;

  /** Persuasion angle (e.g., "social proof", "urgency", "problem/solution") */
  angle: string;

  /** Tone of this specific scenario */
  tone: 'funny' | 'serious' | 'aspirational' | 'urgent' | 'educational';

  /** Brief description of the visual style */
  visualDirection: string;

  /** Call-to-action line */
  ctaText: string;

  /** 2-3 sentence summary of what the ad will look like */
  summary: string;

  /** Timestamp when scenario was generated */
  generatedAt: Date;
}

/**
 * ScenarioSet - Collection of 4 scenarios for user selection
 */
export interface ScenarioSet {
  /** Job identifier */
  jobId: string;

  /** All 4 generated scenarios */
  scenarios: [Scenario, Scenario, Scenario, Scenario];

  /** Timestamp when set was generated */
  generatedAt: Date;

  /** Expiry time (scenarios remain valid for selection) */
  expiresAt: Date;
}
