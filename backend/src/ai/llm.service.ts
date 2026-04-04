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
import { StructuredLoggerService } from '../monitoring/structured-logger.service';
import { PerformanceMonitorService } from '../monitoring/performance-monitor.service';
import { CostTrackerService } from '../cost/cost-tracker.service';

interface BedrockResponseContent {
  type: string;
  text?: string;
}

interface BedrockUsage {
  input_tokens: number;
  output_tokens: number;
}

interface BedrockResponse {
  content: BedrockResponseContent[];
  stop_reason: string;
  usage: BedrockUsage;
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

  constructor(
    private readonly configService: ConfigService<Env>,
    private readonly structuredLogger: StructuredLoggerService,
    private readonly performanceMonitor: PerformanceMonitorService,
    private readonly costTracker: CostTrackerService,
  ) {
    // Initialize AWS Bedrock (Primary Provider)
    const awsAccessKeyId = this.configService.get('AWS_ACCESS_KEY_ID', {
      infer: true,
    });
    const awsSecretAccessKey = this.configService.get('AWS_SECRET_ACCESS_KEY', {
      infer: true,
    });
    const awsSessionToken = this.configService.get('AWS_SESSION_TOKEN', {
      infer: true,
    });
    const awsRegion =
      this.configService.get('AWS_REGION', { infer: true }) || 'us-east-1';
    this.bedrockModelId =
      this.configService.get('BEDROCK_MODEL_ID', {
        infer: true,
      }) || 'us.anthropic.claude-sonnet-4-6';

    // Configure Bedrock client with explicit credentials if provided,
    // otherwise use AWS SDK default credential chain (IAM roles, etc.)
    const bedrockConfig: {
      region: string;
      credentials?: {
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken?: string;
      };
    } = {
      region: awsRegion,
    };

    if (awsAccessKeyId && awsSecretAccessKey) {
      bedrockConfig.credentials = {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey,
      };

      // Add session token if provided (required for temporary credentials from STS/SSO)
      if (awsSessionToken) {
        bedrockConfig.credentials.sessionToken = awsSessionToken;
        this.logger.log(
          `AWS Bedrock initialized with temporary credentials (session token) for model ${this.bedrockModelId} in region ${awsRegion}`,
        );
      } else {
        this.logger.log(
          `AWS Bedrock initialized with explicit credentials for model ${this.bedrockModelId} in region ${awsRegion}`,
        );
      }
    } else {
      this.logger.log(
        `AWS Bedrock initialized using default credential chain for model ${this.bedrockModelId} in region ${awsRegion}`,
      );
    }

    this.bedrockClient = new BedrockRuntimeClient(bedrockConfig);

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
   * @param correlationId - Correlation ID for tracking
   * @param jobId - Job ID for cost tracking (optional)
   * @param businessId - Business ID for cost tracking (optional)
   * @returns Parsed JSON object matching the expected schema
   */
  async generateContent(
    systemPrompt: string,
    userPrompt: string,
    correlationId?: string,
    jobId?: string,
    businessId?: string,
  ): Promise<unknown> {
    const context = {
      correlationId: correlationId || 'unknown',
      service: 'llm',
    };

    // Try AWS Bedrock first (Primary Provider)
    try {
      return await this.generateWithBedrock(
        systemPrompt,
        userPrompt,
        context,
        jobId,
        businessId,
      );
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

          // Log fallback event
          this.structuredLogger.logFallback(
            'bedrock-claude',
            'gemini',
            bedrockMessage,
            context,
          );

          return await this.generateWithGemini(
            systemPrompt,
            userPrompt,
            context,
            jobId,
            businessId,
          );
        } catch (geminiError) {
          const geminiMessage =
            geminiError instanceof Error
              ? geminiError.message
              : String(geminiError);
          this.logger.error(
            `Both providers failed. Bedrock: ${bedrockMessage}, Gemini: ${geminiMessage}`,
          );

          this.structuredLogger.error(
            'All LLM providers failed',
            new Error(`Bedrock: ${bedrockMessage}, Gemini: ${geminiMessage}`),
            context,
          );

          throw new Error(
            `LLM generation failed on all providers. Primary (Bedrock): ${bedrockMessage}, Fallback (Gemini): ${geminiMessage}`,
          );
        }
      } else {
        this.logger.error(
          `AWS Bedrock failed and no fallback available: ${bedrockMessage}`,
        );

        this.structuredLogger.error(
          'LLM generation failed with no fallback',
          bedrockError as Error,
          context,
        );

        throw new Error(
          `LLM generation failed: ${bedrockMessage} (no fallback configured)`,
        );
      }
    }
  }

  /**
   * Generate content using AWS Bedrock Claude
   *
   * Note: Uses Claude's native JSON mode without strict schema enforcement.
   * The system prompt should specify the expected JSON structure.
   */
  private async generateWithBedrock(
    systemPrompt: string,
    userPrompt: string,
    context: { correlationId: string; service: string },
    jobId?: string,
    businessId?: string,
  ): Promise<unknown> {
    this.logger.debug('Generating content with AWS Bedrock Claude');

    const startTime = Date.now();

    try {
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

      const latency = Date.now() - startTime;

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
      // Handle both Unix (\n) and Windows (\r\n) line endings
      if (jsonText.startsWith('```')) {
        jsonText = jsonText
          .replace(/^```(?:json)?(?:\r?\n)?/, '')
          .replace(/(?:\r?\n)?```\s*$/, '');
      }

      const result = JSON.parse(jsonText) as unknown;

      // Track cost if jobId and businessId are provided
      if (jobId && businessId && responseBody.usage) {
        const inputTokens = responseBody.usage.input_tokens;
        const outputTokens = responseBody.usage.output_tokens;
        const cost = this.costTracker.calculateClaudeCost(
          inputTokens,
          outputTokens,
        );

        // Track API call cost asynchronously (don't block response)
        void this.costTracker
          .trackApiCall(jobId, businessId, {
            service: 'claude',
            operation: 'generate-content',
            inputTokens,
            outputTokens,
            cost,
            timestamp: new Date(),
          })
          .catch((error) => {
            this.logger.error(
              `Failed to track Claude cost: ${error instanceof Error ? error.message : String(error)}`,
            );
          });

        this.logger.debug(
          `Claude cost: ${cost.toFixed(4)} USD (${inputTokens} input + ${outputTokens} output tokens)`,
        );
      }

      // Log API call with performance metrics (success)
      this.performanceMonitor.trackLatency(
        'bedrock-claude',
        'generate-content',
        latency,
        {
          ...context,
          modelId: this.bedrockModelId,
          responseLength: textContent.text.length,
          stopReason: responseBody.stop_reason,
        },
        'success',
      );

      return result;
    } catch (error) {
      const latency = Date.now() - startTime;

      // Log API call with performance metrics (failure)
      this.performanceMonitor.trackLatency(
        'bedrock-claude',
        'generate-content',
        latency,
        {
          ...context,
          modelId: this.bedrockModelId,
          error: error instanceof Error ? error.message : String(error),
        },
        'failure',
      );

      throw error;
    }
  }

  /**
   * Generate content using Gemini (Fallback Provider)
   */
  private async generateWithGemini(
    systemPrompt: string,
    userPrompt: string,
    context: { correlationId: string; service: string },
    jobId?: string,
    businessId?: string,
  ): Promise<unknown> {
    if (!this.geminiModel) {
      throw new Error('Gemini fallback not initialized');
    }

    this.logger.debug('Generating content with Gemini fallback');

    const startTime = Date.now();

    try {
      const result: GenerateContentResult =
        await this.geminiModel.generateContent({
          systemInstruction: systemPrompt,
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        });

      const latency = Date.now() - startTime;

      const responseText = result.response.text();
      this.logger.debug(`Gemini response length: ${responseText.length} chars`);

      const parsedResult = JSON.parse(responseText) as unknown;

      // Track cost if jobId and businessId are provided
      if (jobId && businessId && result.response.usageMetadata) {
        const inputTokens = result.response.usageMetadata.promptTokenCount || 0;
        const outputTokens =
          result.response.usageMetadata.candidatesTokenCount || 0;
        const cost = this.costTracker.calculateGeminiCost(
          inputTokens,
          outputTokens,
        );

        // Track API call cost asynchronously (don't block response)
        void this.costTracker
          .trackApiCall(jobId, businessId, {
            service: 'gemini',
            operation: 'generate-content',
            inputTokens,
            outputTokens,
            cost,
            timestamp: new Date(),
          })
          .catch((error) => {
            this.logger.error(
              `Failed to track Gemini cost: ${error instanceof Error ? error.message : String(error)}`,
            );
          });

        this.logger.debug(
          `Gemini cost: ${cost.toFixed(4)} USD (${inputTokens} input + ${outputTokens} output tokens)`,
        );
      }

      // Log API call with performance metrics (success)
      this.performanceMonitor.trackLatency(
        'gemini',
        'generate-content',
        latency,
        {
          ...context,
          modelId: 'gemini-2.5-pro',
          responseLength: responseText.length,
        },
        'success',
      );

      return parsedResult;
    } catch (error) {
      const latency = Date.now() - startTime;

      // Log API call with performance metrics (failure)
      this.performanceMonitor.trackLatency(
        'gemini',
        'generate-content',
        latency,
        {
          ...context,
          modelId: 'gemini-2.5-pro',
          error: error instanceof Error ? error.message : String(error),
        },
        'failure',
      );

      throw error;
    }
  }
}
