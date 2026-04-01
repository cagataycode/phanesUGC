import { Injectable, Logger } from '@nestjs/common';
import { AdScript, NarrationLine } from '../contracts/ad-script';
import { GeminiService } from '../../ai/gemini.service';

/**
 * ScriptGeneratorService - Generates full script for selected scenario
 *
 * Uses Gemini to create a complete script with timed narration lines
 */
@Injectable()
export class ScriptGeneratorService {
  private readonly logger = new Logger(ScriptGeneratorService.name);

  constructor(private readonly gemini: GeminiService) {}

  async generate(jobId: string, scenarioId: number): Promise<AdScript> {
    this.logger.log(
      `Generating script for job ${jobId}, scenario ${scenarioId}`,
    );

    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(scenarioId);

    try {
      const response = await this.gemini.generateContent(
        systemPrompt,
        userPrompt,
      );

      const script = this.parseResponse(response, jobId, scenarioId);
      this.logger.log(`Script generated for job ${jobId}`);
      return script;
    } catch (error) {
      this.logger.error(
        `Failed to generate script: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Fallback to basic script
      return this.buildFallbackScript(jobId, scenarioId);
    }
  }

  private buildSystemPrompt(): string {
    return `You are an expert copywriter specializing in short-form video ad scripts.

Your task is to write a complete 8-second video ad script with timed narration lines.

Output a JSON object with this exact structure:
{
  "title": "string - script title",
  "hook": "string - opening line (1-2 seconds)",
  "voiceoverLines": [
    {
      "text": "string - narration text",
      "estimatedDurationSec": number (0.5-3 seconds per line),
      "speaker": "string - voice direction (e.g., 'energetic', 'calm', 'professional')",
      "scene": 1
    }
  ],
  "cta": "string - call to action (1-2 seconds)",
  "visualDescription": "string - brief description of what viewers see"
}

CRITICAL RULES:
1. Total duration MUST be exactly 8 seconds (sum of all voiceoverLines + hook + CTA)
2. Hook should be 1-2 seconds (5-10 words max)
3. Each voiceover line should be 0.5-3 seconds
4. CTA should be 1-2 seconds (3-7 words)
5. Keep language simple and conversational
6. Write for spoken delivery (short sentences, natural rhythm)
7. Every word counts - be concise and impactful

Timing guidelines:
- 1 second ≈ 2-3 words
- 2 seconds ≈ 4-6 words
- 3 seconds ≈ 7-9 words

Example structure for 8 seconds:
- Hook: 2 sec (4-6 words)
- Line 1: 2 sec (4-6 words)
- Line 2: 2 sec (4-6 words)
- CTA: 2 sec (4-6 words)`;
  }

  private buildUserPrompt(scenarioId: number): string {
    // Note: In a real implementation, we'd load the scenario and brief from state
    // For now, we'll use a generic prompt
    return `Write an 8-second video ad script for scenario ${scenarioId}.

The script should:
- Start with an attention-grabbing hook
- Deliver the key message clearly and concisely
- End with a strong call to action
- Total exactly 8 seconds when spoken

Remember: Every word must earn its place. Make it punchy, memorable, and action-oriented.`;
  }

  private parseResponse(
    response: unknown,
    jobId: string,
    scenarioId: number,
  ): AdScript {
    const data = response as Record<string, unknown>;

    // Parse voiceover lines
    const voiceoverLines: NarrationLine[] = [];
    if (Array.isArray(data.voiceoverLines)) {
      for (const line of data.voiceoverLines) {
        const lineData = line as Record<string, unknown>;
        voiceoverLines.push({
          text: typeof lineData.text === 'string' ? lineData.text : '',
          estimatedDurationSec:
            typeof lineData.estimatedDurationSec === 'number'
              ? lineData.estimatedDurationSec
              : 2,
          speaker:
            typeof lineData.speaker === 'string' ? lineData.speaker : undefined,
          scene: 1, // MVP: always scene 1
        });
      }
    }

    // Calculate total duration
    const totalEstimatedDuration = voiceoverLines.reduce(
      (sum, line) => sum + line.estimatedDurationSec,
      0,
    );

    // Build full text
    const hook = typeof data.hook === 'string' ? data.hook : '';
    const cta = typeof data.cta === 'string' ? data.cta : 'Learn more';
    const fullText = [hook, ...voiceoverLines.map((line) => line.text), cta]
      .filter(Boolean)
      .join(' ');

    return {
      jobId,
      scenarioId,
      title:
        typeof data.title === 'string' ? data.title : `Script ${scenarioId}`,
      hook,
      voiceoverLines,
      cta,
      fullText,
      visualDescription:
        typeof data.visualDescription === 'string'
          ? data.visualDescription
          : undefined,
      totalEstimatedDuration,
      generatedAt: new Date(),
    };
  }

  private buildFallbackScript(jobId: string, scenarioId: number): AdScript {
    this.logger.warn('Using fallback script generation');

    const voiceoverLines: NarrationLine[] = [
      {
        text: 'Discover something amazing.',
        estimatedDurationSec: 2,
        speaker: 'enthusiastic',
        scene: 1,
      },
      {
        text: 'Transform your experience today.',
        estimatedDurationSec: 2,
        speaker: 'enthusiastic',
        scene: 1,
      },
      {
        text: 'Join thousands of happy customers.',
        estimatedDurationSec: 2,
        speaker: 'enthusiastic',
        scene: 1,
      },
    ];

    const hook = 'Check this out!';
    const cta = 'Learn more now!';
    const fullText = [hook, ...voiceoverLines.map((l) => l.text), cta].join(
      ' ',
    );

    return {
      jobId,
      scenarioId,
      title: `Fallback Script ${scenarioId}`,
      hook,
      voiceoverLines,
      cta,
      fullText,
      totalEstimatedDuration: 8,
      generatedAt: new Date(),
    };
  }
}
