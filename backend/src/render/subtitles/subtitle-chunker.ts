import {
  DEFAULT_SUBTITLE_CHUNKING_OPTIONS,
  SubtitleChunkingOptions,
  SubtitlePhrase,
} from './subtitle-types';

const HARD_BREAK_PUNCTUATION_REGEX = /[.!?]/u;
const SOFT_BREAK_PUNCTUATION_REGEX = /[,;:]/u;

export const generateScriptSubtitles = (
  text: string,
  durationSec: number,
  options: Partial<SubtitleChunkingOptions> = {},
): SubtitlePhrase[] => {
  const settings = { ...DEFAULT_SUBTITLE_CHUNKING_OPTIONS, ...options };
  const allWords = text.split(/\s+/).filter(Boolean);

  if (allWords.length === 0) {
    return [];
  }

  const secondsPerWord = durationSec / allWords.length;
  const phrases: SubtitlePhrase[] = [];

  let currentWords: string[] = [];
  let currentStartIndex = 0;

  for (let i = 0; i < allWords.length; i++) {
    const word = allWords[i];
    currentWords.push(word);

    const isLastWord = i === allWords.length - 1;
    const isHardBreak = HARD_BREAK_PUNCTUATION_REGEX.test(word);
    const isSoftBreak = SOFT_BREAK_PUNCTUATION_REGEX.test(word);

    let shouldBreak = false;

    if (isLastWord) {
      shouldBreak = true;
    } else if (currentWords.length >= settings.maxWordsPerPhrase) {
      shouldBreak = true;
    } else if (currentWords.length >= settings.minWordsPerPhrase) {
      if (isHardBreak || isSoftBreak) {
        shouldBreak = true;
      }
    }

    if (shouldBreak) {
      const phraseText = currentWords.join(' ');
      const start = currentStartIndex * secondsPerWord;
      const end = (i + 1) * secondsPerWord;

      const lines = balanceLines(currentWords, settings.maxLines);

      phrases.push({
        id: `phrase-${phrases.length}`,
        start: Number(start.toFixed(3)),
        end: Number(end.toFixed(3)),
        text: phraseText,
        lines,
      });

      currentWords = [];
      currentStartIndex = i + 1;
    }
  }

  return phrases;
};

const balanceLines = (words: string[], maxLines: number): string[] => {
  if (words.length === 0) {
    return [];
  }

  if (maxLines <= 1 || words.length <= 2) {
    return [words.join(' ')];
  }

  let bestLines = [words.join(' ')];
  let bestScore = Number.POSITIVE_INFINITY;

  for (let breakIndex = 1; breakIndex < words.length; breakIndex += 1) {
    const firstLine = words.slice(0, breakIndex).join(' ');
    const secondLine = words.slice(breakIndex).join(' ');

    const score = Math.abs(firstLine.length - secondLine.length);
    if (score < bestScore) {
      bestScore = score;
      bestLines = [firstLine, secondLine];
    }
  }

  return bestLines;
};
