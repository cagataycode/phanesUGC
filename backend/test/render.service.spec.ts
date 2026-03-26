import { RenderService } from '../src/render/render.service';
import { SubtitlePhrase } from '../src/render/subtitles/subtitle-types';

describe('RenderService', () => {
  const renderService = new RenderService();

  it('prepares chunked phrases when phrases are not supplied', () => {
    const request = renderService.prepareRenderRequest({
      videoUrl: 'https://example.com/video.mp4',
      segments: [
        {
          start: 0,
          end: 0.8,
          text: 'Make videos faster',
          words: [
            { word: 'Make', start: 0, end: 0.2 },
            { word: 'videos', start: 0.2, end: 0.45 },
            { word: 'faster', start: 0.45, end: 0.8 },
          ],
        },
      ],
      fps: 30,
      durationInFrames: 90,
      width: 1080,
      height: 1920,
    });

    expect(request.phrases).toBeDefined();
    expect(request.phrases).toHaveLength(1);
    expect(request.phrases?.[0].text).toBe('Make videos faster');
  });

  it('preserves explicitly supplied phrases', () => {
    const phrases: SubtitlePhrase[] = [
      {
        id: 'phrase-1',
        start: 0,
        end: 1,
        text: 'Provided phrase',
        lines: ['Provided phrase'],
        words: [
          {
            id: '0-0',
            text: 'Provided',
            start: 0,
            end: 0.4,
            sourceSegmentIndex: 0,
            sourceWordIndex: 0,
            normalized: 'provided',
            trailingPunctuation: '',
          },
          {
            id: '0-1',
            text: 'phrase',
            start: 0.4,
            end: 1,
            sourceSegmentIndex: 0,
            sourceWordIndex: 1,
            normalized: 'phrase',
            trailingPunctuation: '',
          },
        ],
      },
    ];

    const request = renderService.prepareRenderRequest({
      videoUrl: 'https://example.com/video.mp4',
      segments: [],
      phrases,
      fps: 30,
      durationInFrames: 90,
      width: 1080,
      height: 1920,
    });

    expect(request.phrases).toBe(phrases);
  });

  it('builds phrase metadata usable by downstream orchestration', () => {
    const request = renderService.prepareRenderRequest({
      videoUrl: 'https://example.com/video.mp4',
      segments: [
        {
          start: 0,
          end: 1.2,
          text: 'Make videos faster with AI',
          words: [
            { word: 'Make', start: 0, end: 0.2 },
            { word: 'videos', start: 0.2, end: 0.45 },
            { word: 'faster', start: 0.45, end: 0.7 },
            { word: 'with', start: 0.7, end: 0.95 },
            { word: 'AI', start: 0.95, end: 1.2 },
          ],
        },
      ],
      fps: 30,
      durationInFrames: 90,
      width: 1080,
      height: 1920,
    });

    expect(request.phrases?.[0]).toMatchObject({
      start: 0,
      end: 1.2,
      text: 'Make videos faster with AI',
    });
  });

  it('returns a temp render result shape with cleanup contract', async () => {
    const originalRender = renderService.render.bind(renderService);
    renderService.render = jest.fn().mockResolvedValue('/tmp/fake-output.mp4');

    const result = await renderService.renderToTempFile({
      videoUrl: 'https://example.com/video.mp4',
      segments: [
        {
          start: 0,
          end: 0.4,
          text: 'Hello world',
          words: [
            { word: 'Hello', start: 0, end: 0.2 },
            { word: 'world', start: 0.2, end: 0.4 },
          ],
        },
      ],
      fps: 30,
      durationInFrames: 30,
      width: 1080,
      height: 1920,
    });

    expect(result.outputPath.endsWith('subtitled-output.mp4')).toBe(true);
    expect(result.request.phrases?.length).toBeGreaterThan(0);
    await expect(result.cleanup()).resolves.toBeUndefined();

    renderService.render = originalRender;
  });
});
