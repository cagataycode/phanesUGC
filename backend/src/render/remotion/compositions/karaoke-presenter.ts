import { SubtitlePhrase } from '../../subtitles/subtitle-types';
import { SubtitleTimelineState } from '../../subtitles/subtitle-timeline';

export type KaraokeWordPresentation = {
  id: string;
  text: string;
  isActive: boolean;
  isSpoken: boolean;
};

export type KaraokeLinePresentation = {
  text: string;
  words: KaraokeWordPresentation[];
};

export type KaraokeCaptionPresentation = {
  lines: KaraokeLinePresentation[];
};

export const buildKaraokeCaptionPresentation = (
  phrase: SubtitlePhrase,
  subtitleState: SubtitleTimelineState,
): KaraokeCaptionPresentation => {
  const spokenWordIds = new Set(
    subtitleState.spokenWords.map((word) => word.id),
  );
  let wordCursor = 0;

  const lines = phrase.lines.map((lineText) => {
    const lineWords = lineText.split(/\s+/).filter(Boolean);
    const words = lineWords.map(() => {
      const phraseWord = phrase.words[wordCursor];
      wordCursor += 1;

      return {
        id: phraseWord.id,
        text: phraseWord.text,
        isActive: subtitleState.activeWord?.id === phraseWord.id,
        isSpoken: spokenWordIds.has(phraseWord.id),
      } satisfies KaraokeWordPresentation;
    });

    return {
      text: lineText,
      words,
    } satisfies KaraokeLinePresentation;
  });

  return { lines };
};
