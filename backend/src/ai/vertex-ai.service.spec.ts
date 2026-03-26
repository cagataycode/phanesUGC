import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { VertexAiService } from './vertex-ai.service';
import { GoogleGenAI } from '@google/genai';

// Mock the GoogleGenAI module
jest.mock('@google/genai', () => {
  return {
    GoogleGenAI: jest.fn().mockImplementation(() => {
      return {
        models: {
          generateVideos: jest.fn(),
          generateContent: jest.fn(),
        },
        operations: {
          getVideosOperation: jest.fn(),
        },
      };
    }),
  };
});

describe('VertexAiService', () => {
  let service: VertexAiService;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let configService: ConfigService;

  let mockGenAIInstance: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Default config values for the majority of tests
    const mockConfig = {
      GCP_PROJECT_ID: 'test-project',
      VERTEX_AI_LOCATION: 'us-central1',
      VERTEX_AI_MODEL_ID: 'test-model',
      FIREBASE_CLIENT_EMAIL: 'test@test.com',
      FIREBASE_PRIVATE_KEY: 'test-key\nline2',
      VERTEX_AI_API_KEY: undefined,
      VERTEX_OUTPUT_GCS_URI: 'gs://test-bucket/output',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VertexAiService,
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn()
              .mockImplementation(
                (key) => mockConfig[key as keyof typeof mockConfig],
              ),
          },
        },
      ],
    }).compile();

    configService = module.get<ConfigService>(ConfigService);
    service = module.get<VertexAiService>(VertexAiService);

    // Get the instance returned by the mock constructor
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    mockGenAIInstance = (GoogleGenAI as jest.Mock).mock.results[0].value;
  });

  describe('Initialization', () => {
    it('should initialize with Firebase credentials if available', () => {
      expect(GoogleGenAI).toHaveBeenCalledWith({
        vertexai: true,
        project: 'test-project',
        location: 'us-central1',
        googleAuthOptions: {
          credentials: {
            client_email: 'test@test.com',
            private_key: 'test-key\nline2',
          },
          projectId: 'test-project',
          scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        },
      });
    });

    it('should initialize with API key if Firebase credentials are not available', async () => {
      jest.clearAllMocks();

      const mockConfigApiKey = {
        GCP_PROJECT_ID: 'test-project',
        VERTEX_AI_LOCATION: 'us-central1',
        VERTEX_AI_MODEL_ID: 'test-model',
        FIREBASE_CLIENT_EMAIL: undefined,
        FIREBASE_PRIVATE_KEY: undefined,
        VERTEX_AI_API_KEY: 'test-api-key',
        VERTEX_OUTPUT_GCS_URI: 'gs://test-bucket/output',
      };

      await Test.createTestingModule({
        providers: [
          VertexAiService,
          {
            provide: ConfigService,
            useValue: {
              get: jest
                .fn()
                .mockImplementation(
                  (key) =>
                    mockConfigApiKey[key as keyof typeof mockConfigApiKey],
                ),
            },
          },
        ],
      }).compile();

      expect(GoogleGenAI).toHaveBeenCalledWith({
        vertexai: false,
        apiKey: 'test-api-key',
      });
      expect(process.env.GOOGLE_GENAI_USE_VERTEXAI).toBe('true');
      expect(process.env.GOOGLE_API_KEY).toBe('test-api-key');
    });

    it('should throw error if neither auth method is configured', async () => {
      const mockConfigEmpty = {
        GCP_PROJECT_ID: 'test-project',
        VERTEX_AI_LOCATION: 'us-central1',
        VERTEX_AI_MODEL_ID: 'test-model',
        FIREBASE_CLIENT_EMAIL: undefined,
        FIREBASE_PRIVATE_KEY: undefined,
        VERTEX_AI_API_KEY: undefined,
        VERTEX_OUTPUT_GCS_URI: undefined,
      };

      await expect(
        Test.createTestingModule({
          providers: [
            VertexAiService,
            {
              provide: ConfigService,
              useValue: {
                get: jest
                  .fn()
                  .mockImplementation(
                    (key) =>
                      mockConfigEmpty[key as keyof typeof mockConfigEmpty],
                  ),
              },
            },
          ],
        }).compile(),
      ).rejects.toThrow('Vertex AI auth is not configured');
    });
  });

  describe('generateVideoFromPrompt', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should successfully generate and poll for a video', async () => {
      const initialOperation = { name: 'operations/123', done: false };
      const completedOperation = {
        name: 'operations/123',
        done: true,
        response: {
          generatedVideos: [{ video: { uri: 'gs://test/video.mp4' } }],
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockGenAIInstance.models.generateVideos.mockResolvedValueOnce(
        initialOperation,
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockGenAIInstance.operations.getVideosOperation.mockResolvedValueOnce(
        completedOperation,
      );

      const promise = service.generateVideoFromPrompt('A test video prompt', {
        aspectRatio: '16:9',
      });

      // Allow first generateVideos call to resolve
      await Promise.resolve();
      // Advance timer for the poll loop wait
      jest.advanceTimersByTime(10000);

      const result = await promise;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(mockGenAIInstance.models.generateVideos).toHaveBeenCalledWith({
        model: 'test-model',
        prompt: 'A test video prompt',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        config: expect.objectContaining({
          numberOfVideos: 1,
          prompt: 'A test video prompt',
          aspectRatio: '16:9',
          outputGcsUri: 'gs://test-bucket/output',
        }),
      });

      expect(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        mockGenAIInstance.operations.getVideosOperation,
      ).toHaveBeenCalledWith({
        operation: initialOperation,
      });

      expect(result).toEqual({
        providerJobId: 'operations/123',
        providerStatus: 'completed',
        downloadUrl: 'gs://test/video.mp4',
      });
    });

    it('should throw an error if the operation fails', async () => {
      const initialOperation = { name: 'operations/123', done: false };
      const failedOperation = {
        name: 'operations/123',
        done: true,
        error: { message: 'Generation failed' },
      };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockGenAIInstance.models.generateVideos.mockResolvedValueOnce(
        initialOperation,
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockGenAIInstance.operations.getVideosOperation.mockResolvedValueOnce(
        failedOperation,
      );

      const promise = service.generateVideoFromPrompt('A test video prompt');

      await Promise.resolve();
      jest.advanceTimersByTime(10000);

      await expect(promise).rejects.toThrow(
        'Vertex AI video generation failed',
      );
    });

    it('should throw an error if no video is returned', async () => {
      const initialOperation = { name: 'operations/123', done: false };
      const completedOperation = {
        name: 'operations/123',
        done: true,
        response: { generatedVideos: [] },
      };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockGenAIInstance.models.generateVideos.mockResolvedValueOnce(
        initialOperation,
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockGenAIInstance.operations.getVideosOperation.mockResolvedValueOnce(
        completedOperation,
      );

      const promise = service.generateVideoFromPrompt('A test video prompt');

      await Promise.resolve();
      jest.advanceTimersByTime(10000);

      await expect(promise).rejects.toThrow(
        'Vertex AI returned no generated video asset',
      );
    });
  });

  describe('generateContent', () => {
    it('should successfully generate and parse JSON content', async () => {
      const mockResponse = {
        candidates: [
          {
            content: { parts: [{ text: '{"key": "value"}' }] },
          },
        ],
      };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockGenAIInstance.models.generateContent.mockResolvedValueOnce(
        mockResponse,
      );

      const result = await service.generateContent('Generate JSON');

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(mockGenAIInstance.models.generateContent).toHaveBeenCalledWith({
        model: 'test-model',
        contents: {
          role: 'user',
          parts: [{ text: 'Generate JSON' }],
        },
      });

      expect(result).toEqual({ key: 'value' });
    });

    it('should return raw text if JSON parsing fails', async () => {
      const mockResponse = {
        candidates: [
          {
            content: { parts: [{ text: 'Plain text response' }] },
          },
        ],
      };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockGenAIInstance.models.generateContent.mockResolvedValueOnce(
        mockResponse,
      );

      const result = await service.generateContent('Generate text');

      expect(result).toEqual({ text: 'Plain text response' });
    });

    it('should throw an error for invalid response format', async () => {
      const mockResponse = { invalid: 'format' };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      mockGenAIInstance.models.generateContent.mockResolvedValueOnce(
        mockResponse,
      );

      await expect(service.generateContent('Generate content')).rejects.toThrow(
        'Invalid response from Vertex AI',
      );
    });
  });
});
