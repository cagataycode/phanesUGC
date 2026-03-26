import {
  chunkSubtitleSegments,
  normalizeSubtitleWords,
} from '../src/render/subtitles/subtitle-chunker';
import { RawSubtitleSegment } from '../src/render/subtitles/subtitle-types';

const buildSegment = (
  words: Array<{ word: string; start: number; end: number }>,
): RawSubtitleSegment => ({
  start: words[0]?.start ?? 0,
  end: words[words.length - 1]?.end ?? 0,
  text: words.map((word) => word.word).join(' '),
  words,
});

describe('subtitle-chunker', () => {
  it('normalizes raw subtitle words into a flat ordered timeline', () => {
    const words = normalizeSubtitleWords([
      buildSegment([
        { word: 'Hello,', start: 0, end: 0.2 },
        { word: 'world!', start: 0.2, end: 0.5 },
      ]),
    ]);

    expect(words).toHaveLength(2);
    expect(words[0]).toMatchObject({
      text: 'Hello,',
      normalized: 'hello',
      trailingPunctuation: ',',
    });
    expect(words[1]).toMatchObject({
      text: 'world!',
      normalized: 'world',
      trailingPunctuation: '!',
    });
  });

  it('chunks words into readable karaoke phrases', () => {
    const phrases = chunkSubtitleSegments([
      buildSegment([
        { word: 'This', start: 0, end: 0.2 },
        { word: 'is', start: 0.2, end: 0.4 },
        { word: 'a', start: 0.4, end: 0.5 },
        { word: 'great', start: 0.5, end: 0.8 },
        { word: 'product', start: 0.8, end: 1.1 },
        { word: 'for', start: 1.1, end: 1.25 },
        { word: 'creators.', start: 1.25, end: 1.6 },
      ]),
    ]);

    expect(phrases).toHaveLength(1);
    expect(phrases[0]).toMatchObject({
      start: 0,
      end: 1.6,
      text: 'This is a great product for creators.',
    });
    expect(phrases[0].lines).toHaveLength(2);
  });

  it('splits on strong punctuation after the minimum phrase size', () => {
    const phrases = chunkSubtitleSegments([
      buildSegment([
        { word: 'Stop.', start: 0, end: 0.2 },
        { word: 'You', start: 0.2, end: 0.35 },
        { word: 'need', start: 0.35, end: 0.5 },
        { word: 'this', start: 0.5, end: 0.7 },
        { word: 'now.', start: 0.7, end: 0.9 },
        { word: 'It', start: 1, end: 1.1 },
        { word: 'saves', start: 1.1, end: 1.35 },
        { word: 'hours.', start: 1.35, end: 1.6 },
      ]),
    ]);

    expect(phrases).toHaveLength(2);
    expect(phrases[0].text).toBe('Stop. You need this now.');
    expect(phrases[1].text).toBe('It saves hours.');
  });

  it('splits on long silence gaps', () => {
    const phrases = chunkSubtitleSegments([
      buildSegment([
        { word: 'Make', start: 0, end: 0.2 },
        { word: 'content', start: 0.2, end: 0.4 },
        { word: 'faster', start: 0.4, end: 0.7 },
        { word: 'with', start: 1.3, end: 1.45 },
        { word: 'AI', start: 1.45, end: 1.7 },
        { word: 'today', start: 1.7, end: 2 },
      ]),
    ]);

    expect(phrases).toHaveLength(2);
    expect(phrases[0].text).toBe('Make content faster');
    expect(phrases[1].text).toBe('with AI today');
  });

  it('pulls a leading orphan word into the previous phrase when possible', () => {
    const phrases = chunkSubtitleSegments(
      [
        buildSegment([
          { word: 'Built', start: 0, end: 0.2 },
          { word: 'for', start: 0.2, end: 0.35 },
          { word: 'small', start: 0.35, end: 0.6 },
          { word: 'teams,', start: 0.6, end: 0.8 },
          { word: 'and', start: 0.8, end: 0.9 },
          { word: 'ready', start: 0.9, end: 1.15 },
          { word: 'to', start: 1.15, end: 1.3 },
          { word: 'scale.', start: 1.3, end: 1.6 },
        ]),
      ],
      { maxWordsPerPhrase: 5 },
    );

    expect(phrases).toHaveLength(2);
    expect(phrases[0].text).toBe('Built for small teams, and');
    expect(phrases[1].text).toBe('ready to scale.');
  });
});
