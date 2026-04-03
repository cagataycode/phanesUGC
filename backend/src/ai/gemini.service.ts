import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

const FALLBACK_MODELS = ['gemini-2.5-flash'];

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly genAI: GoogleGenerativeAI;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY', '');
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY is required. Please set it in environment.',
      );
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async generateContent(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<unknown> {
    const models = ['gemini-2.5-pro', ...FALLBACK_MODELS];
    let lastError: Error | null = null;

    for (const modelName of models) {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          if (attempt > 0) {
            const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
            this.logger.debug(
              `Retrying ${modelName} after ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES + 1})`,
            );
            await this.sleep(delay);
          }

          const model = this.genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.7,
            },
          });

          const result = await model.generateContent({
            systemInstruction: systemPrompt,
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          });

          const responseText = result.response.text();
          this.logger.debug(
            `Gemini response from ${modelName}: ${String(responseText.length)} chars`,
          );

          return JSON.parse(responseText);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          lastError = error instanceof Error ? error : new Error(message);

          const is503 =
            message.includes('503') || message.includes('high demand');
          const isLastAttempt = attempt === MAX_RETRIES;
          const isLastModel = modelName === models[models.length - 1];

          if (is503 && !isLastAttempt) {
            this.logger.warn(
              `${modelName} returned 503, will retry (attempt ${attempt + 1}/${MAX_RETRIES + 1})`,
            );
            continue;
          }

          if (is503 && !isLastModel) {
            this.logger.warn(`${modelName} unavailable, trying fallback model`);
            break;
          }

          this.logger.error(
            `Gemini generation failed for ${modelName}: ${message}`,
          );

          if (isLastModel && isLastAttempt) {
            throw lastError;
          }
        }
      }
    }

    throw lastError || new Error('All Gemini models failed');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
