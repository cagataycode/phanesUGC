import {
  getSubtitleTimelineState,
  resolveRenderPhrases,
} from '../src/render/subtitles/subtitle-timeline';
import {
  RawSubtitleSegment,
  SubtitlePhrase,
} from '../src/render/subtitles/subtitle-types';

const buildSegments = (): RawSubtitleSegment[] => [
  {
    start: 0,
    end: 0.65,
    text: 'Make videos faster',
    words: [
      { word: 'Make', start: 0, end: 0.25 },
      { word: 'videos', start: 0.3, end: 0.65 },
    ],
  },
  {
    start: 0.7,
    end: 1.2,
    text: 'faster with AI',
    words: [
      { word: 'faster', start: 0.7, end: 0.95 },
      { word: 'with', start: 0.98, end: 1.08 },
      { word: 'AI', start: 1.1, end: 1.2 },
    ],
  },
  {
    start: 1.8,
    end: 2.3,
    text: 'today only',
    words: [
      { word: 'today', start: 1.8, end: 2.05 },
      { word: 'only', start: 2.08, end: 2.3 },
    ],
  },
];

describe('subtitle-timeline', () => {
  it('resolves render phrases from chunked segments when phrases are not provided', () => {
    const phrases = resolveRenderPhrases(buildSegments());

    expect(phrases.length).toBeGreaterThan(0);
    expect(phrases[0].text).toBe('Make videos faster with AI');
  });

  it('prefers explicit phrases when provided', () => {
    const explicitPhrases: SubtitlePhrase[] = [
      {
        id: 'phrase-explicit',
        start: 0,
        end: 1,
        text: 'Explicit phrase',
        lines: ['Explicit phrase'],
        words: [
          {
            id: '0-0',
            text: 'Explicit',
            start: 0,
            end: 0.4,
            sourceSegmentIndex: 0,
            sourceWordIndex: 0,
            normalized: 'explicit',
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

    const phrases = resolveRenderPhrases(buildSegments(), explicitPhrases);

    expect(phrases).toBe(explicitPhrases);
  });

  it('returns the active phrase and active word for a frame time', () => {
    const phrases = resolveRenderPhrases(buildSegments());
    const state = getSubtitleTimelineState({
      frame: 10,
      fps: 20,
      phrases,
    });

    expect(state.activePhrase?.text).toBe('Make videos faster with AI');
    expect(state.activeWord?.text).toBe('videos');
    expect(state.activeWordIndex).toBe(1);
  });

  it('keeps the previous word highlighted briefly during tiny gaps', () => {
    const phrases = resolveRenderPhrases(buildSegments());
    const state = getSubtitleTimelineState({
      frame: 5.6,
      fps: 20,
      phrases,
    });

    expect(state.activePhrase?.text).toBe('Make videos faster with AI');
    expect(state.activeWord?.text).toBe('Make');
    expect(state.isInPhraseGap).toBe(false);
  });

  it('returns no active phrase outside subtitle timing windows', () => {
    const phrases = resolveRenderPhrases(buildSegments());
    const state = getSubtitleTimelineState({
      frame: 80,
      fps: 20,
      phrases,
    });

    expect(state.activePhrase).toBeNull();
    expect(state.activeWord).toBeNull();
    expect(state.activePhraseIndex).toBe(-1);
  });
});
