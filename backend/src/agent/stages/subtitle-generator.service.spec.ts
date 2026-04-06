import { Test, TestingModule } from '@nestjs/testing';
import { SubtitleGeneratorService } from './subtitle-generator.service';
import { AdScript } from '../contracts/ad-script';
import { VeoOutput } from '../contracts/veo-output';

describe('SubtitleGeneratorService', () => {
  let service: SubtitleGeneratorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SubtitleGeneratorService],
    }).compile();

    service = module.get<SubtitleGeneratorService>(SubtitleGeneratorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generate', () => {
    it('should generate chunked subtitle phrases from script', async () => {
      const script: AdScript = {
        jobId: 'test-job',
        scenarioId: 1,
        title: 'Test Script',
        hook: 'Test hook',
        voiceoverLines: [
          {
            text: 'This is a longer line that should be chunked',
            estimatedDurationSec: 4,
            scene: 1,
          },
          { text: 'Short line', estimatedDurationSec: 2, scene: 1 },
        ],
        cta: 'Shop now',
        fullText: 'This is a longer line that should be chunked. Short line',
        visualDescription: 'Test visual',
        totalEstimatedDuration: 6,
        generatedAt: new Date(),
      };

      const veoOutput: VeoOutput = {
        jobId: 'test-job',
        gcsPath: 'test/video.mp4',
        actualDurationSec: 6,
        resolution: { width: 1080, height: 1920 },
        fps: 24,
        generatedAt: new Date(),
      };

      const result = await service.generate('test-job', script, veoOutput);

      expect(result.jobId).toBe('test-job');
      // Should have more segments than voiceover lines due to chunking
      expect(result.segments.length).toBeGreaterThan(2);

      // First segment should start at 0
      expect(result.segments[0].startSec).toBe(0);

      // All segments should be contiguous
      for (let i = 1; i < result.segments.length; i++) {
        expect(result.segments[i].startSec).toBeCloseTo(
          result.segments[i - 1].endSec,
          2,
        );
      }
    });

    it('should scale subtitle timing to match actual video duration', async () => {
      const script: AdScript = {
        jobId: 'test-job',
        scenarioId: 1,
        title: 'Test Script',
        hook: 'Test hook',
        voiceoverLines: [
          { text: 'First line here', estimatedDurationSec: 4, scene: 1 },
          { text: 'Second line here', estimatedDurationSec: 4, scene: 1 },
        ],
        cta: 'Shop now',
        fullText: 'First line here Second line here',
        visualDescription: 'Test visual',
        totalEstimatedDuration: 8,
        generatedAt: new Date(),
      };

      const veoOutput: VeoOutput = {
        jobId: 'test-job',
        gcsPath: 'test/video.mp4',
        actualDurationSec: 10, // Actual video is longer
        resolution: { width: 1080, height: 1920 },
        fps: 24,
        generatedAt: new Date(),
      };

      const result = await service.generate('test-job', script, veoOutput);

      // Scaling factor should be 10/8 = 1.25
      expect(result.scalingFactor).toBe(1.25);

      // First segment should start at 0
      expect(result.segments[0].startSec).toBe(0);

      // Last segment should end close to actual duration
      const lastSegment = result.segments[result.segments.length - 1];
      expect(lastSegment.endSec).toBeCloseTo(10, 1);
    });

    it('should handle division by zero with scaling factor of 1', async () => {
      const script: AdScript = {
        jobId: 'test-job',
        scenarioId: 1,
        title: 'Test Script',
        hook: 'Test hook',
        voiceoverLines: [{ text: 'Line 1', estimatedDurationSec: 0, scene: 1 }],
        cta: 'Shop now',
        fullText: 'Line 1',
        visualDescription: 'Test visual',
        totalEstimatedDuration: 0, // Edge case: zero duration
        generatedAt: new Date(),
      };

      const veoOutput: VeoOutput = {
        jobId: 'test-job',
        gcsPath: 'test/video.mp4',
        actualDurationSec: 8,
        resolution: { width: 1080, height: 1920 },
        fps: 24,
        generatedAt: new Date(),
      };

      const result = await service.generate('test-job', script, veoOutput);

      // Should default to scaling factor of 1 to avoid division by zero
      expect(result.scalingFactor).toBe(1);
      expect(result.segments[0].startSec).toBe(0);
      expect(result.segments[0].endSec).toBe(0); // 0 * 1
    });

    it('should cover full planned duration before scaling', async () => {
      const script: AdScript = {
        jobId: 'test-job',
        scenarioId: 1,
        title: 'Test Script',
        hook: 'Test hook',
        voiceoverLines: [
          {
            text: 'First line with some words',
            estimatedDurationSec: 2,
            scene: 1,
          },
          {
            text: 'Second line with more words',
            estimatedDurationSec: 2,
            scene: 1,
          },
          {
            text: 'Third line with even more',
            estimatedDurationSec: 2,
            scene: 1,
          },
          {
            text: 'Fourth line to finish',
            estimatedDurationSec: 2,
            scene: 1,
          },
        ],
        cta: 'Shop now',
        fullText:
          'First line with some words Second line with more words Third line with even more Fourth line to finish',
        visualDescription: 'Test visual',
        totalEstimatedDuration: 8,
        generatedAt: new Date(),
      };

      const veoOutput: VeoOutput = {
        jobId: 'test-job',
        gcsPath: 'test/video.mp4',
        actualDurationSec: 8,
        resolution: { width: 1080, height: 1920 },
        fps: 24,
        generatedAt: new Date(),
      };

      const result = await service.generate('test-job', script, veoOutput);

      // Last subtitle should end at or very close to planned duration (8s)
      const lastSegment = result.segments[result.segments.length - 1];
      expect(lastSegment.endSec).toBeCloseTo(8, 1);

      // All segments should be contiguous
      for (let i = 1; i < result.segments.length; i++) {
        expect(result.segments[i].startSec).toBeCloseTo(
          result.segments[i - 1].endSec,
          2,
        );
      }
    });

    it('should include all required subtitle fields', async () => {
      const script: AdScript = {
        jobId: 'test-job',
        scenarioId: 1,
        title: 'Test Script',
        hook: 'Test hook',
        voiceoverLines: [
          {
            text: 'Test line with multiple words here',
            estimatedDurationSec: 8,
            scene: 1,
          },
        ],
        cta: 'Shop now',
        fullText: 'Test line with multiple words here',
        visualDescription: 'Test visual',
        totalEstimatedDuration: 8,
        generatedAt: new Date(),
      };

      const veoOutput: VeoOutput = {
        jobId: 'test-job',
        gcsPath: 'test/video.mp4',
        actualDurationSec: 8,
        resolution: { width: 1080, height: 1920 },
        fps: 24,
        generatedAt: new Date(),
      };

      const result = await service.generate('test-job', script, veoOutput);

      expect(result).toHaveProperty('jobId');
      expect(result).toHaveProperty('segments');
      expect(result).toHaveProperty('plannedDurationSec');
      expect(result).toHaveProperty('actualDurationSec');
      expect(result).toHaveProperty('scalingFactor');
      expect(result).toHaveProperty('style');
      expect(result).toHaveProperty('generatedAt');

      // Should have multiple segments due to chunking
      expect(result.segments.length).toBeGreaterThan(0);

      const segment = result.segments[0];
      expect(segment).toHaveProperty('id');
      expect(segment).toHaveProperty('text');
      expect(segment).toHaveProperty('startSec');
      expect(segment).toHaveProperty('endSec');
      expect(segment).toHaveProperty('lines');
      expect(segment).toHaveProperty('style');
    });

    it('should use provided subtitle style', async () => {
      const script: AdScript = {
        jobId: 'test-job',
        scenarioId: 1,
        hook: 'Test hook',
        voiceoverLines: [
          {
            text: 'Line with some words',
            estimatedDurationSec: 2,
            speaker: 'narrator',
          },
        ],
        cta: 'Test CTA',
        overlayText: [],
        totalEstimatedDuration: 2,
      };

      const veoOutput: VeoOutput = {
        jobId: 'test-job',
        gcsPath: 'test/path.mp4',
        actualDurationSec: 2,
        resolution: { width: 1080, height: 1920 },
        fps: 24,
        generatedAt: new Date(),
      };

      const result = await service.generate(
        'test-job',
        script,
        veoOutput,
        'kinetic',
      );

      expect(result.style).toBe('kinetic');
      result.segments.forEach((segment) => {
        expect(segment.style).toBe('kinetic');
      });
    });
  });
});
