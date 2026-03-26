import { buildKaraokeCaptionPresentation } from '../src/render/remotion/compositions/karaoke-presenter';
import { SubtitlePhrase } from '../src/render/subtitles/subtitle-types';
import { SubtitleTimelineState } from '../src/render/subtitles/subtitle-timeline';

const phrase: SubtitlePhrase = {
  id: 'phrase-1',
  start: 0,
  end: 1.2,
  text: 'Make videos faster with AI',
  lines: ['Make videos', 'faster with AI'],
  words: [
    {
      id: '0-0',
      text: 'Make',
      start: 0,
      end: 0.2,
      sourceSegmentIndex: 0,
      sourceWordIndex: 0,
      normalized: 'make',
      trailingPunctuation: '',
    },
    {
      id: '0-1',
      text: 'videos',
      start: 0.2,
      end: 0.5,
      sourceSegmentIndex: 0,
      sourceWordIndex: 1,
      normalized: 'videos',
      trailingPunctuation: '',
    },
    {
      id: '0-2',
      text: 'faster',
      start: 0.5,
      end: 0.8,
      sourceSegmentIndex: 0,
      sourceWordIndex: 2,
      normalized: 'faster',
      trailingPunctuation: '',
    },
    {
      id: '0-3',
      text: 'with',
      start: 0.8,
      end: 1,
      sourceSegmentIndex: 0,
      sourceWordIndex: 3,
      normalized: 'with',
      trailingPunctuation: '',
    },
    {
      id: '0-4',
      text: 'AI',
      start: 1,
      end: 1.2,
      sourceSegmentIndex: 0,
      sourceWordIndex: 4,
      normalized: 'ai',
      trailingPunctuation: '',
    },
  ],
};

const timelineState: SubtitleTimelineState = {
  currentTimeSec: 0.65,
  activePhrase: phrase,
  activePhraseIndex: 0,
  activeWord: phrase.words[2],
  activeWordIndex: 2,
  spokenWords: phrase.words.slice(0, 3),
  isInPhraseGap: false,
};

describe('karaoke-presenter', () => {
  it('maps phrase lines into line-by-line karaoke presentation data', () => {
    const presentation = buildKaraokeCaptionPresentation(phrase, timelineState);

    expect(presentation.lines).toHaveLength(2);
    expect(presentation.lines[0].words.map((word) => word.text)).toEqual([
      'Make',
      'videos',
    ]);
    expect(presentation.lines[1].words.map((word) => word.text)).toEqual([
      'faster',
      'with',
      'AI',
    ]);
  });

  it('marks active and spoken words correctly', () => {
    const presentation = buildKaraokeCaptionPresentation(phrase, timelineState);
    const secondLineWords = presentation.lines[1].words;

    expect(secondLineWords[0]).toMatchObject({
      text: 'faster',
      isActive: true,
      isSpoken: true,
    });
    expect(secondLineWords[1]).toMatchObject({
      text: 'with',
      isActive: false,
      isSpoken: false,
    });
  });
});
