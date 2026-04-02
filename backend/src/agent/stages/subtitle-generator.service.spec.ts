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
    it('should generate subtitles with cumulative timing from script', async () => {
      const script: AdScript = {
        jobId: 'test-job',
        scenarioId: 1,
        title: 'Test Script',
        hook: 'Test hook',
        voiceoverLines: [
          { text: 'Line 1', estimatedDurationSec: 2, scene: 1 },
          { text: 'Line 2', estimatedDurationSec: 3, scene: 1 },
          { text: 'Line 3', estimatedDurationSec: 3, scene: 1 },
        ],
        cta: 'Shop now',
        fullText: 'Line 1 Line 2 Line 3',
        visualDescription: 'Test visual',
        totalEstimatedDuration: 8,
        generatedAt: new Date(),
      };

      const veoOutput: VeoOutput = {
        jobId: 'test-job',
        gcsPath: 'test/video.mp4',
        actualDurationSec: 8,
        resolution: { width: 1080, height: 1920 },
        generatedAt: new Date(),
      };

      const result = await service.generate('test-job', script, veoOutput);

      expect(result.jobId).toBe('test-job');
      expect(result.segments).toHaveLength(3);

      // Check cumulative timing (before scaling)
      expect(result.segments[0].startSec).toBe(0);
      expect(result.segments[0].endSec).toBe(2);
      expect(result.segments[1].startSec).toBe(2);
      expect(result.segments[1].endSec).toBe(5);
      expect(result.segments[2].startSec).toBe(5);
      expect(result.segments[2].endSec).toBe(8);
    });

    it('should scale subtitle timing to match actual video duration', async () => {
      const script: AdScript = {
        jobId: 'test-job',
        scenarioId: 1,
        title: 'Test Script',
        hook: 'Test hook',
        voiceoverLines: [
          { text: 'Line 1', estimatedDurationSec: 4, scene: 1 },
          { text: 'Line 2', estimatedDurationSec: 4, scene: 1 },
        ],
        cta: 'Shop now',
        fullText: 'Line 1 Line 2',
        visualDescription: 'Test visual',
        totalEstimatedDuration: 8,
        generatedAt: new Date(),
      };

      const veoOutput: VeoOutput = {
        jobId: 'test-job',
        gcsPath: 'test/video.mp4',
        actualDurationSec: 10, // Actual video is longer
        resolution: { width: 1080, height: 1920 },
        generatedAt: new Date(),
      };

      const result = await service.generate('test-job', script, veoOutput);

      // Scaling factor should be 10/8 = 1.25
      expect(result.scalingFactor).toBe(1.25);

      // Check scaled timing
      expect(result.segments[0].startSec).toBe(0);
      expect(result.segments[0].endSec).toBe(5); // 4 * 1.25
      expect(result.segments[1].startSec).toBe(5);
      expect(result.segments[1].endSec).toBe(10); // 8 * 1.25
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
          { text: 'Line 1', estimatedDurationSec: 2, scene: 1 },
          { text: 'Line 2', estimatedDurationSec: 2, scene: 1 },
          { text: 'Line 3', estimatedDurationSec: 2, scene: 1 },
          { text: 'Line 4', estimatedDurationSec: 2, scene: 1 },
        ],
        cta: 'Shop now',
        fullText: 'Line 1 Line 2 Line 3 Line 4',
        visualDescription: 'Test visual',
        totalEstimatedDuration: 8,
        generatedAt: new Date(),
      };

      const veoOutput: VeoOutput = {
        jobId: 'test-job',
        gcsPath: 'test/video.mp4',
        actualDurationSec: 8,
        resolution: { width: 1080, height: 1920 },
        generatedAt: new Date(),
      };

      const result = await service.generate('test-job', script, veoOutput);

      // Last subtitle should end at planned duration (8s)
      const lastSegment = result.segments[result.segments.length - 1];
      expect(lastSegment.endSec).toBe(8);

      // All segments should be contiguous
      for (let i = 1; i < result.segments.length; i++) {
        expect(result.segments[i].startSec).toBe(result.segments[i - 1].endSec);
      }
    });

    it('should include all required subtitle fields', async () => {
      const script: AdScript = {
        jobId: 'test-job',
        scenarioId: 1,
        title: 'Test Script',
        hook: 'Test hook',
        voiceoverLines: [
          { text: 'Test line', estimatedDurationSec: 8, scene: 1 },
        ],
        cta: 'Shop now',
        fullText: 'Test line',
        visualDescription: 'Test visual',
        totalEstimatedDuration: 8,
        generatedAt: new Date(),
      };

      const veoOutput: VeoOutput = {
        jobId: 'test-job',
        gcsPath: 'test/video.mp4',
        actualDurationSec: 8,
        resolution: { width: 1080, height: 1920 },
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

      const segment = result.segments[0];
      expect(segment).toHaveProperty('id');
      expect(segment).toHaveProperty('text');
      expect(segment).toHaveProperty('startSec');
      expect(segment).toHaveProperty('endSec');
      expect(segment).toHaveProperty('lines');
      expect(segment).toHaveProperty('style');
    });
  });
});
