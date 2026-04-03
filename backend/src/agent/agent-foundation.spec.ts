import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QualityGatesService } from './orchestrator/quality-gates.service';
import { InputNormalizerService } from './stages/input-normalizer.service';
import { ScenarioGeneratorService } from './stages/scenario-generator.service';
import { LlmService } from '../ai/llm.service';
import {
  isValidTransition,
  getPipelineStage,
  SCENARIO_GENERATION_STAGES,
  VIDEO_GENERATION_STAGES,
} from './orchestrator/agent-state.model';
import { AdScript } from './contracts/ad-script';
import { VeoOutput } from './contracts/veo-output';

describe('Agent Foundation - Scenario Generation', () => {
  describe('State Machine', () => {
    it('should validate stage transitions', () => {
      expect(isValidTransition('created', 'platform_ready')).toBe(true);
      expect(isValidTransition('normalized', 'context_ready')).toBe(true);
      expect(isValidTransition('scenarios_ready', 'scenario_selected')).toBe(
        true,
      );
      expect(isValidTransition('created', 'completed')).toBe(false);
      expect(isValidTransition('normalized', 'script_ready')).toBe(false);
    });

    it('should identify pipeline stage for each stage', () => {
      expect(getPipelineStage('created')).toBe('scenario_generation');
      expect(getPipelineStage('normalized')).toBe('scenario_generation');
      expect(getPipelineStage('scenarios_ready')).toBe('scenario_generation');
      expect(getPipelineStage('scenario_selected')).toBe('video_generation');
      expect(getPipelineStage('script_ready')).toBe('video_generation');
      expect(getPipelineStage('completed')).toBe('video_generation');
    });

    it('should have correct pipeline stage lists', () => {
      expect(SCENARIO_GENERATION_STAGES).toContain('created');
      expect(SCENARIO_GENERATION_STAGES).toContain('scenarios_ready');
      expect(SCENARIO_GENERATION_STAGES).not.toContain('script_ready');

      expect(VIDEO_GENERATION_STAGES).toContain('scenario_selected');
      expect(VIDEO_GENERATION_STAGES).toContain('completed');
      expect(VIDEO_GENERATION_STAGES).not.toContain('normalized');
    });
  });

  describe('QualityGatesService', () => {
    let service: QualityGatesService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [QualityGatesService],
      }).compile();

      service = module.get<QualityGatesService>(QualityGatesService);
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should pass script quality gate for valid script', () => {
      const script: AdScript = {
        jobId: 'test-job',
        scenarioId: 1,
        title: 'Test Script',
        hook: 'Great hook!',
        voiceoverLines: [
          { text: 'Line 1', estimatedDurationSec: 3, scene: 1 },
          { text: 'Line 2', estimatedDurationSec: 3, scene: 1 },
        ],
        cta: 'Buy now!',
        fullText: 'Line 1 Line 2 Buy now!',
        totalEstimatedDuration: 7,
        generatedAt: new Date(),
      };

      const report = service.checkScript(script, 8);
      expect(report.status).toBe('pass');
      expect(report.issues).toHaveLength(0);
    });

    it('should warn on script quality issues', () => {
      const script: AdScript = {
        jobId: 'test-job',
        scenarioId: 1,
        title: 'Test Script',
        hook: '',
        voiceoverLines: [],
        cta: '',
        fullText: '',
        totalEstimatedDuration: 10,
        generatedAt: new Date(),
      };

      const report = service.checkScript(script, 8);
      expect(report.status).toBe('warn');
      expect(report.issues.length).toBeGreaterThan(0);
    });

    it('should pass Veo output quality gate for valid output', () => {
      const output: VeoOutput = {
        jobId: 'test-job',
        sceneId: 1,
        gcsPath: 'gs://bucket/video.mp4',
        actualDurationSec: 8,
        resolution: { width: 1080, height: 1920 },
        fps: 24,
        fileSizeBytes: 10 * 1024 * 1024,
        generatedAt: new Date(),
      };

      const report = service.checkVeoOutput(output, 8, '9:16');
      expect(report.status).toBe('pass');
      expect(report.issues).toHaveLength(0);
    });

    it('should warn on Veo output quality issues', () => {
      const output: VeoOutput = {
        jobId: 'test-job',
        sceneId: 1,
        gcsPath: 'gs://bucket/video.mp4',
        actualDurationSec: 12, // Too long
        resolution: { width: 1920, height: 1080 }, // Wrong aspect ratio
        fps: 24,
        fileSizeBytes: 0, // Invalid size
        generatedAt: new Date(),
      };

      const report = service.checkVeoOutput(output, 8, '9:16');
      expect(report.status).toBe('warn');
      expect(report.issues.length).toBeGreaterThan(0);
    });

    it('should calculate quality score from reports', () => {
      const reports = [
        {
          gate: 'script',
          status: 'pass' as const,
          issues: [],
          checkedAt: new Date(),
        },
        {
          gate: 'veo',
          status: 'warn' as const,
          issues: ['Issue 1'],
          checkedAt: new Date(),
        },
      ];

      const score = service.calculateQualityScore(reports);
      expect(score).toBeLessThan(1.0);
      expect(score).toBeGreaterThan(0);
    });
  });

  describe('Stage Services', () => {
    let inputNormalizer: InputNormalizerService;
    let scenarioGenerator: ScenarioGeneratorService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          InputNormalizerService,
          ScenarioGeneratorService,
<<<<<<< HEAD
          {
            provide: GeminiService,
            useValue: {
              generateContent: jest.fn().mockResolvedValue([
                {
                  scenarioId: 1,
                  title: 'Problem/Solution',
                  hook: 'Hook 1',
                  angle: 'problem/solution',
                  tone: 'serious',
                  visualDirection: 'Show problem',
                  ctaText: 'Buy now',
                  summary: 'Summary 1',
                },
                {
                  scenarioId: 2,
                  title: 'Social Proof',
                  hook: 'Hook 2',
                  angle: 'social proof',
                  tone: 'aspirational',
                  visualDirection: 'Show testimonials',
                  ctaText: 'Join now',
                  summary: 'Summary 2',
                },
                {
                  scenarioId: 3,
                  title: 'Urgency',
                  hook: 'Hook 3',
                  angle: 'urgency',
                  tone: 'urgent',
                  visualDirection: 'Fast-paced',
                  ctaText: 'Act now',
                  summary: 'Summary 3',
                },
                {
                  scenarioId: 4,
                  title: 'Educational',
                  hook: 'Hook 4',
                  angle: 'educational',
                  tone: 'educational',
                  visualDirection: 'Step-by-step',
                  ctaText: 'Learn more',
                  summary: 'Summary 4',
                },
              ]),
            },
          },
=======
          LlmService,
>>>>>>> a2bab17 (Phase 3: Update consumer services to use LlmService)
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'AWS_ACCESS_KEY_ID') return 'test-access-key';
                if (key === 'AWS_SECRET_ACCESS_KEY') return 'test-secret-key';
                if (key === 'AWS_REGION') return 'us-east-1';
                if (key === 'BEDROCK_MODEL_ID')
                  return 'us.anthropic.claude-sonnet-4-6';
                if (key === 'GEMINI_API_KEY') return 'test-api-key';
                return null;
              }),
            },
          },
        ],
      }).compile();

      inputNormalizer = module.get<InputNormalizerService>(
        InputNormalizerService,
      );
      scenarioGenerator = module.get<ScenarioGeneratorService>(
        ScenarioGeneratorService,
      );
    });

    it('should normalize input with defaults', async () => {
      const rawInput = {
        prompt: 'Test prompt',
        platform: 'tiktok',
      };

      const normalized = await inputNormalizer.normalize(
        'job-1',
        'biz-1',
        rawInput,
      );

      expect(normalized.jobId).toBe('job-1');
      expect(normalized.businessId).toBe('biz-1');
      expect(normalized.prompt).toBe('Test prompt');
      expect(normalized.platform).toBe('tiktok');
      expect(normalized.durationSec).toBe(8);
      expect(normalized.language).toBe('en');
      expect(normalized.aspectRatio).toBe('9:16');
    });

    it('should reject invalid prompt', async () => {
      const rawInput = {
        prompt: '', // Empty prompt
      };

      try {
        await inputNormalizer.normalize('job-1', 'biz-1', rawInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
      }
    });

    it('should reject invalid platform', async () => {
      const rawInput = {
        prompt: 'Test',
        platform: 'invalid-platform',
      };

      try {
        await inputNormalizer.normalize('job-1', 'biz-1', rawInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
      }
    });

    it('should reject invalid job ID', async () => {
      const rawInput = {
        prompt: 'Test',
      };

      try {
        await inputNormalizer.normalize('job/../etc/passwd', 'biz-1', rawInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
      }
    });

    it('should generate 4 scenarios', async () => {
      const brief = {
        productName: 'Test Product',
        offer: 'Great offer',
        audience: 'Everyone',
        painPoints: [],
        keyBenefits: ['Benefit 1'],
        tone: 'enthusiastic' as const,
        cta: 'Buy now',
        visualStyle: 'dynamic' as const,
        keyMessage: 'Test message',
        targetPlatform: 'tiktok' as const,
        targetDuration: 8,
        targetAspectRatio: '9:16' as const,
        language: 'en',
        createdAt: new Date(),
      };

      const scenarioSet = await scenarioGenerator.generate('job-1', brief);

      expect(scenarioSet.scenarios).toHaveLength(4);
      expect(scenarioSet.scenarios[0].scenarioId).toBe(1);
      expect(scenarioSet.scenarios[1].scenarioId).toBe(2);
      expect(scenarioSet.scenarios[2].scenarioId).toBe(3);
      expect(scenarioSet.scenarios[3].scenarioId).toBe(4);
      expect(scenarioSet.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('Contract Interfaces', () => {
    it('should have valid NormalizedRequest structure', () => {
      const request = {
        jobId: 'job-1',
        businessId: 'biz-1',
        prompt: 'Test prompt',
        platform: 'tiktok' as const,
        aspectRatio: '9:16' as const,
        durationSec: 8,
        language: 'en',
        normalizedAt: new Date(),
      };

      expect(request.jobId).toBeDefined();
      expect(request.durationSec).toBe(8);
    });

    it('should have valid Scenario structure', () => {
      const scenario = {
        scenarioId: 1,
        title: 'Test Scenario',
        hook: 'Great hook',
        angle: 'problem/solution',
        tone: 'serious' as const,
        visualDirection: 'Show problem',
        ctaText: 'Learn more',
        summary: 'Test summary',
        generatedAt: new Date(),
      };

      expect(scenario.scenarioId).toBe(1);
      expect(scenario.title).toBeDefined();
    });

    it('should have valid AdScript structure', () => {
      const script: AdScript = {
        jobId: 'job-1',
        scenarioId: 1,
        title: 'Test Script',
        hook: 'Hook',
        voiceoverLines: [{ text: 'Line 1', estimatedDurationSec: 3, scene: 1 }],
        cta: 'CTA',
        fullText: 'Full text',
        totalEstimatedDuration: 8,
        generatedAt: new Date(),
      };

      expect(script.voiceoverLines).toHaveLength(1);
      expect(script.totalEstimatedDuration).toBe(8);
    });
  });
});
