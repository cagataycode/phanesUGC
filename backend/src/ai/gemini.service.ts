import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenerativeAI,
  GenerativeModel,
  GenerateContentResult,
} from '@google/generative-ai';
import { Env } from '../config/env';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly genAI: GoogleGenerativeAI | null;
  private readonly model: GenerativeModel | null;

  constructor(private readonly configService: ConfigService<Env>) {
    const apiKey = this.configService.get('GEMINI_API_KEY', { infer: true });

    if (!apiKey) {
      this.logger.warn(
        'GEMINI_API_KEY not configured. Gemini service will not be available.',
      );
      this.genAI = null;
      this.model = null;
      return;
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-pro', // Gemini 2.5 Pro for best quality
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.7,
      },
    });

    this.logger.log('Gemini service initialized with gemini-2.5-pro');
  }

  async generateContent(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<unknown> {
    if (!this.model) {
      throw new Error(
        'GEMINI_API_KEY is required for Gemini service. Add it to your .env file.',
      );
    }

    try {
      this.logger.debug('Generating content with Gemini');

      const result: GenerateContentResult = await this.model.generateContent({
        systemInstruction: systemPrompt,
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      });

      const responseText = result.response.text();
      this.logger.debug(
        `Gemini response length: ${String(responseText.length)} chars`,
      );

      return JSON.parse(responseText);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Gemini generation failed: ${message}`);
      throw error;
    }
  }
}
