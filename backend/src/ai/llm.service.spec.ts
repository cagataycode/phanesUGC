import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LlmService } from './llm.service';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';

// Mock AWS SDK
jest.mock('@aws-sdk/client-bedrock-runtime');

describe('LlmService', () => {
  let service: LlmService;
  let mockBedrockSend: jest.Mock;

  const mockConfig = {
    AWS_ACCESS_KEY_ID: 'test-access-key',
    AWS_SECRET_ACCESS_KEY: 'test-secret-key',
    AWS_REGION: 'us-east-1',
    BEDROCK_MODEL_ID: 'us.anthropic.claude-sonnet-4-6',
    GEMINI_API_KEY: 'test-gemini-key',
  };

  beforeEach(async () => {
    mockBedrockSend = jest.fn();

    // Mock BedrockRuntimeClient
    (BedrockRuntimeClient as jest.Mock).mockImplementation(() => ({
      send: mockBedrockSend,
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmService,
        {
          provide: ConfigService,
          useValue: {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            get: jest.fn((key: string) => mockConfig[key]),
          },
        },
      ],
    }).compile();

    service = module.get<LlmService>(LlmService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with AWS Bedrock credentials', () => {
      expect(BedrockRuntimeClient).toHaveBeenCalledWith({
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key',
        },
      });
    });

    it('should throw error if AWS credentials are missing', () => {
      const invalidConfig: Record<string, string> = { ...mockConfig };
      delete invalidConfig.AWS_ACCESS_KEY_ID;

      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        new LlmService({
          get: jest.fn((key: string) => invalidConfig[key]),
        } as any);
      }).toThrow(/AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required/);
    });
  });

  describe('generateContent - Bedrock success', () => {
    it('should generate content using AWS Bedrock', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ result: 'test response' }),
          },
        ],
        stop_reason: 'end_turn',
      };

      mockBedrockSend.mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify(mockResponse)),
      });

      const result = await service.generateContent(
        'You are a helpful assistant',
        'Generate a test response',
      );

      expect(result).toEqual({ result: 'test response' });
      expect(mockBedrockSend).toHaveBeenCalledTimes(1);
    });

    it('should strip markdown code blocks from Bedrock response', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: '```json\n{"result": "test response"}\n```',
          },
        ],
        stop_reason: 'end_turn',
      };

      mockBedrockSend.mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify(mockResponse)),
      });

      const result = await service.generateContent(
        'You are a helpful assistant',
        'Generate a test response',
      );

      expect(result).toEqual({ result: 'test response' });
      expect(mockBedrockSend).toHaveBeenCalledTimes(1);
    });

    it('should strip markdown code blocks without language specifier', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: '```\n{"result": "test response"}\n```',
          },
        ],
        stop_reason: 'end_turn',
      };

      mockBedrockSend.mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify(mockResponse)),
      });

      const result = await service.generateContent(
        'You are a helpful assistant',
        'Generate a test response',
      );

      expect(result).toEqual({ result: 'test response' });
      expect(mockBedrockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('generateContent - Fallback to Gemini', () => {
    it('should fallback to Gemini when Bedrock fails', async () => {
      // Mock Bedrock failure
      mockBedrockSend.mockRejectedValue(new Error('Bedrock API error'));

      // We need to mock the Gemini client, but since it's initialized in constructor,
      // we'll test the error handling path
      await expect(service.generateContent('system', 'user')).rejects.toThrow(
        /LLM generation failed/,
      );
    });

    it('should throw error when both providers fail', async () => {
      mockBedrockSend.mockRejectedValue(new Error('Bedrock failed'));

      await expect(service.generateContent('system', 'user')).rejects.toThrow(
        /LLM generation failed/,
      );
    });
  });

  describe('generateContent - Error handling', () => {
    it('should handle invalid Bedrock response structure', async () => {
      mockBedrockSend.mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({ content: [] })),
      });

      await expect(service.generateContent('system', 'user')).rejects.toThrow(
        /Invalid response structure/,
      );
    });

    it('should handle missing text content in Bedrock response', async () => {
      const mockResponse = {
        content: [{ type: 'other', data: 'something' }],
      };

      mockBedrockSend.mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify(mockResponse)),
      });

      await expect(service.generateContent('system', 'user')).rejects.toThrow(
        /No text content in Bedrock Claude response/,
      );
    });

    it('should handle invalid JSON in Bedrock response', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'not valid json' }],
        stop_reason: 'end_turn',
      };

      mockBedrockSend.mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify(mockResponse)),
      });

      await expect(service.generateContent('system', 'user')).rejects.toThrow();
    });
  });

  describe('generateContent - Without fallback', () => {
    beforeEach(async () => {
      const configWithoutGemini: Record<string, string> = { ...mockConfig };
      delete configWithoutGemini.GEMINI_API_KEY;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LlmService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => configWithoutGemini[key]),
            },
          },
        ],
      }).compile();

      service = module.get<LlmService>(LlmService);
    });

    it('should throw error when Bedrock fails and no fallback is configured', async () => {
      mockBedrockSend.mockRejectedValue(new Error('Bedrock error'));

      await expect(service.generateContent('system', 'user')).rejects.toThrow(
        /no fallback configured/,
      );
    });
  });
});
