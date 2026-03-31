import {
  DEFAULT_SUBTITLE_CHUNKING_OPTIONS,
  SubtitleChunkingOptions,
  SubtitlePhrase,
} from './subtitle-types';

const HARD_BREAK_PUNCTUATION_REGEX = /[.!?]/u;
const SOFT_BREAK_PUNCTUATION_REGEX = /[,;:]/u;

// Placeholder for the actual ScenePlan type
export interface SimpleScene {
  narration: string;
  duration_sec: number;
}

export const generateSubtitlesFromScenes = (
  scenes: SimpleScene[],
  options: Partial<SubtitleChunkingOptions> = {},
): SubtitlePhrase[] => {
  let globalTimeOffset = 0;
  const allPhrases: SubtitlePhrase[] = [];

  scenes.forEach((scene) => {
    const scenePhrases = generateScriptSubtitles(
      scene.narration,
      scene.duration_sec,
      options,
    );

    scenePhrases.forEach((phrase) => {
      allPhrases.push({
        ...phrase,
        id: `phrase-${allPhrases.length}`,
        start: Number((phrase.start + globalTimeOffset).toFixed(3)),
        end: Number((phrase.end + globalTimeOffset).toFixed(3)),
      });
    });

    globalTimeOffset += scene.duration_sec;
  });

  return allPhrases;
};

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

  if (!Number.isFinite(durationSec) || durationSec <= 0) {
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

      const lines = balanceLines(
        currentWords,
        settings.maxLines,
        settings.maxCharsPerLine,
      );

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

  // Merge orphan phrases (too short trailing phrases)
  return mergeOrphanPhrases(phrases, settings);
};

export const scaleSubtitleTimestamps = (
  phrases: SubtitlePhrase[],
  scalingFactor: number,
): SubtitlePhrase[] => {
  return phrases.map((phrase) => ({
    ...phrase,
    start: Number((phrase.start * scalingFactor).toFixed(3)),
    end: Number((phrase.end * scalingFactor).toFixed(3)),
  }));
};

const balanceLines = (
  words: string[],
  maxLines: number,
  maxCharsPerLine: number,
): string[] => {
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

    // Skip if either line exceeds maxCharsPerLine
    if (
      firstLine.length > maxCharsPerLine ||
      secondLine.length > maxCharsPerLine
    ) {
      continue;
    }

    const score = Math.abs(firstLine.length - secondLine.length);
    if (score < bestScore) {
      bestScore = score;
      bestLines = [firstLine, secondLine];
    }
  }

  return bestLines;
};

const mergeOrphanPhrases = (
  phrases: SubtitlePhrase[],
  settings: SubtitleChunkingOptions,
): SubtitlePhrase[] => {
  if (phrases.length <= 1) {
    return phrases;
  }

  const result: SubtitlePhrase[] = [];

  for (let i = 0; i < phrases.length; i++) {
    const current = phrases[i];
    const wordCount = current.text.split(/\s+/).length;

    // If this is a too-short phrase and not the first one
    if (wordCount < settings.minWordsPerPhrase && result.length > 0) {
      // Merge with previous phrase
      const previous = result[result.length - 1];
      const mergedWords = [
        ...previous.text.split(/\s+/),
        ...current.text.split(/\s+/),
      ];

      // Check if merged phrase would exceed max
      if (mergedWords.length <= settings.maxWordsPerPhrase) {
        previous.text = mergedWords.join(' ');
        previous.end = current.end;
        previous.lines = balanceLines(
          mergedWords,
          settings.maxLines,
          settings.maxCharsPerLine,
        );
      } else {
        // Can't merge, keep as is
        result.push(current);
      }
    } else {
      result.push(current);
    }
  }

  // Re-index IDs
  return result.map((phrase, index) => ({
    ...phrase,
    id: `phrase-${index}`,
  }));
};
