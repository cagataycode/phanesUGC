import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelCommandInput,
} from '@aws-sdk/client-bedrock-runtime';
import {
  GoogleGenerativeAI,
  GenerativeModel,
  GenerateContentResult,
} from '@google/generative-ai';
import { Env } from '../config/env';

interface BedrockResponseContent {
  type: string;
  text?: string;
}

interface BedrockResponse {
  content: BedrockResponseContent[];
  stop_reason: string;
}

/**
 * LlmService - Unified LLM service with AWS Bedrock Claude as primary and Gemini as fallback
 *
 * Primary Provider: AWS Bedrock Claude Sonnet 4.6
 * Fallback Provider: Google Gemini API
 *
 * This service maintains the same interface as the legacy GeminiService
 * but provides automatic fallback capability for improved reliability.
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly bedrockClient: BedrockRuntimeClient;
  private readonly bedrockModelId: string;
  private readonly geminiClient?: GoogleGenerativeAI;
  private readonly geminiModel?: GenerativeModel;
  private readonly hasFallback: boolean;

  constructor(private readonly configService: ConfigService<Env>) {
    // Initialize AWS Bedrock (Primary Provider)
    const awsAccessKeyId = this.configService.get('AWS_ACCESS_KEY_ID', {
      infer: true,
    });
    const awsSecretAccessKey = this.configService.get('AWS_SECRET_ACCESS_KEY', {
      infer: true,
    });
    const awsRegion = this.configService.get('AWS_REGION', { infer: true });
    this.bedrockModelId = this.configService.get('BEDROCK_MODEL_ID', {
      infer: true,
    })!;

    if (!awsAccessKeyId || !awsSecretAccessKey) {
      throw new Error(
        'AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required for Bedrock',
      );
    }

    this.bedrockClient = new BedrockRuntimeClient({
      region: awsRegion,
      credentials: {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey,
      },
    });

    this.logger.log(
      `AWS Bedrock initialized with model ${this.bedrockModelId} in region ${awsRegion}`,
    );

    // Initialize Gemini (Fallback Provider) - Optional
    const geminiApiKey = this.configService.get('GEMINI_API_KEY', {
      infer: true,
    });

    if (geminiApiKey) {
      this.geminiClient = new GoogleGenerativeAI(geminiApiKey);
      this.geminiModel = this.geminiClient.getGenerativeModel({
        model: 'gemini-2.5-pro',
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.7,
        },
      });
      this.hasFallback = true;
      this.logger.log('Gemini fallback provider initialized');
    } else {
      this.hasFallback = false;
      this.logger.warn(
        'GEMINI_API_KEY not provided - fallback provider unavailable',
      );
    }
  }

  /**
   * Generate content using LLM with automatic fallback
   *
   * @param systemPrompt - Instructions defining the LLM's role and output format
   * @param userPrompt - The specific content request
   * @returns Parsed JSON object matching the expected schema
   */
  async generateContent(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<unknown> {
    // Try AWS Bedrock first (Primary Provider)
    try {
      return await this.generateWithBedrock(systemPrompt, userPrompt);
    } catch (bedrockError) {
      const bedrockMessage =
        bedrockError instanceof Error
          ? bedrockError.message
          : String(bedrockError);
      this.logger.warn(
        `AWS Bedrock generation failed: ${bedrockMessage}. Attempting fallback...`,
      );

      // Fallback to Gemini if available
      if (this.hasFallback && this.geminiModel) {
        try {
          this.logger.log('Using Gemini fallback provider');
          return await this.generateWithGemini(systemPrompt, userPrompt);
        } catch (geminiError) {
          const geminiMessage =
            geminiError instanceof Error
              ? geminiError.message
              : String(geminiError);
          this.logger.error(
            `Both providers failed. Bedrock: ${bedrockMessage}, Gemini: ${geminiMessage}`,
          );
          throw new Error(
            `LLM generation failed on all providers. Primary (Bedrock): ${bedrockMessage}, Fallback (Gemini): ${geminiMessage}`,
          );
        }
      } else {
        this.logger.error(
          `AWS Bedrock failed and no fallback available: ${bedrockMessage}`,
        );
        throw new Error(
          `LLM generation failed: ${bedrockMessage} (no fallback configured)`,
        );
      }
    }
  }

  /**
   * Generate content using AWS Bedrock Claude with Structured Outputs
   */
  private async generateWithBedrock(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<unknown> {
    this.logger.debug('Generating content with AWS Bedrock Claude');

    // Build Claude request with JSON mode (not strict schema)
    const requestBody = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 4096,
      temperature: 0.7,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: userPrompt,
            },
          ],
        },
      ],
    };

    const input: InvokeModelCommandInput = {
      modelId: this.bedrockModelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(requestBody),
    };

    const command = new InvokeModelCommand(input);
    const response = await this.bedrockClient.send(command);

    // Parse Bedrock response
    const responseBody = JSON.parse(
      new TextDecoder().decode(response.body),
    ) as BedrockResponse;

    this.logger.debug(
      `Bedrock response: stop_reason=${responseBody.stop_reason}`,
    );

    // Extract text from Claude's response structure
    if (
      !responseBody.content ||
      !Array.isArray(responseBody.content) ||
      responseBody.content.length === 0
    ) {
      throw new Error('Invalid response structure from Bedrock Claude');
    }

    const textContent = responseBody.content.find(
      (block) => block.type === 'text',
    );

    if (!textContent?.text) {
      throw new Error('No text content in Bedrock Claude response');
    }

    this.logger.debug(
      `Bedrock response length: ${textContent.text.length} chars`,
    );

    // Parse JSON from response text, stripping markdown code blocks if present
    let jsonText: string = textContent.text.trim();

    // Remove markdown code blocks (```json ... ``` or ``` ... ```)
    if (jsonText.startsWith('```')) {
      jsonText = jsonText
        .replace(/^```(?:json)?\n?/, '')
        .replace(/\n?```$/, '');
    }

    return JSON.parse(jsonText) as unknown;
  }

  /**
   * Generate content using Gemini (Fallback Provider)
   */
  private async generateWithGemini(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<unknown> {
    if (!this.geminiModel) {
      throw new Error('Gemini fallback not initialized');
    }

    this.logger.debug('Generating content with Gemini fallback');

    const result: GenerateContentResult =
      await this.geminiModel.generateContent({
        systemInstruction: systemPrompt,
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      });

    const responseText = result.response.text();
    this.logger.debug(`Gemini response length: ${responseText.length} chars`);

    return JSON.parse(responseText) as unknown;
  }
}
