import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RenderService } from '../src/render/render.service';
import { SubtitlePhrase } from '../src/render/subtitles/subtitle-types';

describe('RenderService', () => {
  let renderService: RenderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RenderService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'REMOTION_RENDER_TIMEOUT_MS') {
                return 300000;
              }
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    renderService = module.get<RenderService>(RenderService);
  });

  it('prepares an empty phrases array when phrases are not supplied', () => {
    const request = renderService.prepareRenderRequest({
      videoUrl: 'https://example.com/video.mp4',
      fps: 24,
      durationInFrames: 192, // 8 seconds at 24 fps
      width: 1080,
      height: 1920,
      subtitleStyle: 'kinetic',
    });

    expect(request.phrases).toBeDefined();
    expect(request.phrases).toHaveLength(0);
  });

  it('preserves explicitly supplied phrases', () => {
    const phrases: SubtitlePhrase[] = [
      {
        id: 'phrase-1',
        start: 0,
        end: 1,
        text: 'Provided phrase',
        lines: ['Provided phrase'],
      },
    ];

    const request = renderService.prepareRenderRequest({
      videoUrl: 'https://example.com/video.mp4',
      phrases,
      fps: 24,
      durationInFrames: 192,
      width: 1080,
      height: 1920,
      subtitleStyle: 'kinetic',
    });

    expect(request.phrases).toBe(phrases);
  });

  it('builds phrase metadata usable by downstream orchestration', () => {
    const request = renderService.prepareRenderRequest({
      videoUrl: 'https://example.com/video.mp4',
      phrases: [
        {
          id: 'phrase-2',
          start: 0,
          end: 1.2,
          text: 'Make videos faster with AI',
          lines: ['Make videos faster with AI'],
        },
      ],
      fps: 24,
      durationInFrames: 192,
      width: 1080,
      height: 1920,
      subtitleStyle: 'kinetic',
    });

    expect(request.phrases?.[0]).toMatchObject({
      start: 0,
      end: 1.2,
      text: 'Make videos faster with AI',
    });
  });

  it('returns a temp render result shape with cleanup contract', async () => {
    const renderSpy = jest
      .spyOn(renderService, 'render')
      .mockResolvedValue('/tmp/fake-output.mp4');

    const result = await renderService.renderToTempFile({
      videoUrl: 'https://example.com/video.mp4',
      phrases: [
        {
          id: 'phrase-3',
          start: 0,
          end: 0.4,
          text: 'Hello world',
          lines: ['Hello world'],
        },
      ],
      fps: 24,
      durationInFrames: 192,
      width: 1080,
      height: 1920,
      subtitleStyle: 'kinetic',
    });

    expect(result.outputPath.endsWith('subtitled-output.mp4')).toBe(true);
    expect(result.request.phrases?.length).toBeGreaterThan(0);
    await expect(result.cleanup()).resolves.toBeUndefined();

    renderSpy.mockRestore();
  });
});
