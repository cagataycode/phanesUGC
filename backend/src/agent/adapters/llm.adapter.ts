/**
 * LLMAdapter - Interface for LLM text generation
 *
 * Used for all "thinking" stages: brief, scenarios, script, scene planning, evaluation
 */
export interface LLMAdapter {
  /**
   * Generate structured content from system + user prompts
   *
   * @param systemPrompt - Instructions for the LLM
   * @param userPrompt - User input or data to process
   * @returns Parsed JSON response
   */
  generateContent(systemPrompt: string, userPrompt: string): Promise<unknown>;
}
