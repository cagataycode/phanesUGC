import { getSubtitleTimelineState } from './subtitle-timeline';
import { SubtitlePhrase } from './subtitle-types';

describe('subtitle-timeline', () => {
  const phrases: SubtitlePhrase[] = [
    {
      id: 'p1',
      start: 0,
      end: 1,
      text: 'Hello world',
      lines: ['Hello world'],
      words: [
        {
          id: 'w1',
          text: 'Hello',
          normalized: 'hello',
          start: 0,
          end: 0.4,
          sourceSegmentIndex: 0,
          sourceWordIndex: 0,
          trailingPunctuation: '',
        },
        {
          id: 'w2',
          text: 'world',
          normalized: 'world',
          start: 0.5,
          end: 1,
          sourceSegmentIndex: 0,
          sourceWordIndex: 1,
          trailingPunctuation: '',
        },
      ],
    },
    {
      id: 'p2',
      start: 1.5,
      end: 2.5,
      text: 'Next phrase',
      lines: ['Next phrase'],
      words: [
        {
          id: 'w3',
          text: 'Next',
          normalized: 'next',
          start: 1.5,
          end: 1.9,
          sourceSegmentIndex: 1,
          sourceWordIndex: 0,
          trailingPunctuation: '',
        },
        {
          id: 'w4',
          text: 'phrase',
          normalized: 'phrase',
          start: 2,
          end: 2.5,
          sourceSegmentIndex: 1,
          sourceWordIndex: 1,
          trailingPunctuation: '',
        },
      ],
    },
  ];

  it('detects active phrase and word at start', () => {
    const state = getSubtitleTimelineState({ frame: 0, fps: 30, phrases });
    expect(state.activePhrase?.id).toBe('p1');
    expect(state.activeWord?.text).toBe('Hello');
    expect(state.isInPhraseGap).toBe(false);
  });

  it('detects active word in middle of phrase', () => {
    const state = getSubtitleTimelineState({ frame: 18, fps: 30, phrases }); // 0.6s
    expect(state.activePhrase?.id).toBe('p1');
    expect(state.activeWord?.text).toBe('world');
    expect(state.spokenWords).toHaveLength(2);
  });

  it('detects gap between words within a phrase', () => {
    // Gap is between 0.4 and 0.5. Let's pick 0.45 (frame 13.5 -> 14)
    // 14 / 30 = 0.466
    const state = getSubtitleTimelineState({
      frame: 14.7,
      fps: 30,
      phrases,
      options: { gapGraceMs: 0 },
    });
    expect(state.activePhrase?.id).toBe('p1');
    expect(state.activeWord).toBeNull();
    expect(state.isInPhraseGap).toBe(true);
  });

  it('applies grace period to keep previous word highlighted in small gaps', () => {
    // 0.41s is within 80ms grace of 0.4s end
    const state = getSubtitleTimelineState({
      frame: 12.3, // 12.3 / 30 = 0.41s
      fps: 30,
      phrases,
      options: { gapGraceMs: 80 },
    });
    expect(state.activePhrase?.id).toBe('p1');
    expect(state.activeWord?.text).toBe('Hello');
  });

  it('returns null when time is between phrases', () => {
    const state = getSubtitleTimelineState({ frame: 36, fps: 30, phrases }); // 1.2s
    expect(state.activePhrase).toBeNull();
    expect(state.activeWord).toBeNull();
  });

  it('correctly identifies spoken words', () => {
    const state = getSubtitleTimelineState({ frame: 15, fps: 30, phrases }); // 0.5s
    expect(state.spokenWords.map((w) => w.text)).toEqual(['Hello', 'world']);
  });

  it('handles second phrase correctly', () => {
    const state = getSubtitleTimelineState({ frame: 51, fps: 30, phrases }); // 1.7s
    expect(state.activePhrase?.id).toBe('p2');
    expect(state.activeWord?.text).toBe('Next');
  });
});
