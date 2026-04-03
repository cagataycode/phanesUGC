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
    },
    {
      id: 'p2',
      start: 1.5,
      end: 2.5,
      text: 'Next phrase',
      lines: ['Next phrase'],
    },
  ];

  it('detects active phrase at start', () => {
    const state = getSubtitleTimelineState({ frame: 0, fps: 24, phrases });
    expect(state.activePhrase?.id).toBe('p1');
    expect(state.activePhraseIndex).toBe(0);
  });

  it('detects active phrase in middle', () => {
    const state = getSubtitleTimelineState({ frame: 14, fps: 24, phrases }); // 0.58s at 24fps
    expect(state.activePhrase?.id).toBe('p1');
  });

  it('returns null when time is between phrases', () => {
    const state = getSubtitleTimelineState({ frame: 29, fps: 24, phrases }); // 1.2s at 24fps
    expect(state.activePhrase).toBeNull();
    expect(state.activePhraseIndex).toBe(-1);
  });

  it('handles second phrase correctly', () => {
    const state = getSubtitleTimelineState({ frame: 41, fps: 24, phrases }); // 1.7s at 24fps
    expect(state.activePhrase?.id).toBe('p2');
    expect(state.activePhraseIndex).toBe(1);
  });
});
