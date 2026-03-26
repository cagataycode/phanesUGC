import {
  DEFAULT_SUBTITLE_CHUNKING_OPTIONS,
  RawSubtitleSegment,
  SubtitleChunkingOptions,
  SubtitlePhrase,
  SubtitleWord,
} from './subtitle-types';

const STRIP_EDGE_PUNCTUATION_REGEX = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;
const TRAILING_PUNCTUATION_REGEX = /[.,!?;:]+$/u;
const HARD_BREAK_PUNCTUATION_REGEX = /[.!?]/u;
const SOFT_BREAK_PUNCTUATION_REGEX = /[,;:]/u;
const ORPHAN_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'but',
  'by',
  'for',
  'if',
  'in',
  'of',
  'on',
  'or',
  'so',
  'the',
  'to',
  'up',
  'yet',
]);

export const normalizeSubtitleWords = (
  segments: RawSubtitleSegment[],
): SubtitleWord[] => {
  return segments.flatMap((segment, segmentIndex) => {
    return segment.words
      .filter(
        (word) => Number.isFinite(word.start) && Number.isFinite(word.end),
      )
      .map((word, wordIndex) => {
        const text = word.word.trim();
        const normalized = text
          .toLowerCase()
          .replace(STRIP_EDGE_PUNCTUATION_REGEX, '');
        const trailingPunctuation =
          text.match(TRAILING_PUNCTUATION_REGEX)?.[0] ?? '';

        return {
          id: `${segmentIndex}-${wordIndex}`,
          text,
          start: word.start,
          end: Math.max(word.end, word.start),
          sourceSegmentIndex: segmentIndex,
          sourceWordIndex: wordIndex,
          normalized,
          trailingPunctuation,
        } satisfies SubtitleWord;
      })
      .filter((word) => word.text.length > 0);
  });
};

export const chunkSubtitleSegments = (
  segments: RawSubtitleSegment[],
  options: Partial<SubtitleChunkingOptions> = {},
): SubtitlePhrase[] => {
  const settings = { ...DEFAULT_SUBTITLE_CHUNKING_OPTIONS, ...options };
  const words = normalizeSubtitleWords(segments);

  if (words.length === 0) {
    return [];
  }

  const phrases: SubtitlePhrase[] = [];
  let currentPhraseWords: SubtitleWord[] = [];

  const flushCurrentPhrase = () => {
    if (currentPhraseWords.length === 0) {
      return;
    }

    phrases.push(createPhrase(currentPhraseWords, phrases.length, settings));
    currentPhraseWords = [];
  };

  words.forEach((word, index) => {
    currentPhraseWords.push(word);

    const nextWord = words[index + 1];
    const shouldBreak = shouldBreakPhrase(
      currentPhraseWords,
      word,
      nextWord,
      settings,
    );

    if (shouldBreak) {
      flushCurrentPhrase();
    }
  });

  flushCurrentPhrase();

  rebalanceTrailingOrphans(phrases, settings);

  return phrases.map((phrase, index) =>
    createPhrase(phrase.words, index, settings),
  );
};

const shouldBreakPhrase = (
  phraseWords: SubtitleWord[],
  currentWord: SubtitleWord,
  nextWord: SubtitleWord | undefined,
  options: SubtitleChunkingOptions,
) => {
  if (!nextWord) {
    return true;
  }

  if (phraseWords.length >= options.maxWordsPerPhrase) {
    return true;
  }

  const gapToNextWord = nextWord.start - currentWord.end;
  if (
    phraseWords.length >= options.minWordsPerPhrase &&
    gapToNextWord >= options.silenceGapThresholdSec
  ) {
    return true;
  }

  if (
    phraseWords.length >= options.minWordsPerPhrase &&
    HARD_BREAK_PUNCTUATION_REGEX.test(currentWord.trailingPunctuation)
  ) {
    return true;
  }

  if (
    phraseWords.length >= options.minWordsPerPhrase + 1 &&
    SOFT_BREAK_PUNCTUATION_REGEX.test(currentWord.trailingPunctuation)
  ) {
    return true;
  }

  const projectedWords = [...phraseWords, nextWord];
  const projectedLines = balanceLines(projectedWords, options.maxLines);
  if (projectedLines.some((line) => line.length > options.maxCharsPerLine)) {
    return phraseWords.length >= options.minWordsPerPhrase;
  }

  return false;
};

const rebalanceTrailingOrphans = (
  phrases: SubtitlePhrase[],
  options: SubtitleChunkingOptions,
) => {
  for (let index = 1; index < phrases.length; index += 1) {
    const previous = phrases[index - 1];
    const current = phrases[index];

    if (
      current.words.length === 1 &&
      previous.words.length < options.maxWordsPerPhrase
    ) {
      previous.words.push(current.words[0]);
      phrases.splice(index, 1);
      index -= 1;
      continue;
    }

    const firstWord = current.words[0];
    if (
      current.words.length >= 2 &&
      previous.words.length < options.maxWordsPerPhrase &&
      ORPHAN_WORDS.has(firstWord.normalized)
    ) {
      previous.words.push(firstWord);
      current.words.shift();
    }
  }
};

const createPhrase = (
  words: SubtitleWord[],
  index: number,
  options: SubtitleChunkingOptions,
): SubtitlePhrase => {
  const lines = balanceLines(words, options.maxLines);

  return {
    id: `phrase-${index}`,
    start: words[0].start,
    end: words[words.length - 1].end,
    text: words.map((word) => word.text).join(' '),
    words: [...words],
    lines,
  };
};

const balanceLines = (words: SubtitleWord[], maxLines: number): string[] => {
  if (words.length === 0) {
    return [];
  }

  if (maxLines <= 1 || words.length <= 2) {
    return [words.map((word) => word.text).join(' ')];
  }

  let bestLines = [words.map((word) => word.text).join(' ')];
  let bestScore = Number.POSITIVE_INFINITY;

  for (let breakIndex = 1; breakIndex < words.length; breakIndex += 1) {
    const firstLine = words
      .slice(0, breakIndex)
      .map((word) => word.text)
      .join(' ');
    const secondLine = words
      .slice(breakIndex)
      .map((word) => word.text)
      .join(' ');

    const score = Math.abs(firstLine.length - secondLine.length);
    if (score < bestScore) {
      bestScore = score;
      bestLines = [firstLine, secondLine];
    }
  }

  return bestLines;
};
