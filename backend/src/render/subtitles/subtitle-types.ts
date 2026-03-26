export type RawSubtitleWord = {
  word: string;
  start: number;
  end: number;
};

export type RawSubtitleSegment = {
  start: number;
  end: number;
  text: string;
  words: RawSubtitleWord[];
};

export type SubtitleWord = {
  id: string;
  text: string;
  start: number;
  end: number;
  sourceSegmentIndex: number;
  sourceWordIndex: number;
  normalized: string;
  trailingPunctuation: string;
};

export type SubtitlePhrase = {
  id: string;
  start: number;
  end: number;
  text: string;
  words: SubtitleWord[];
  lines: string[];
};

export type SubtitleChunkingOptions = {
  minWordsPerPhrase: number;
  maxWordsPerPhrase: number;
  maxCharsPerLine: number;
  maxLines: number;
  silenceGapThresholdSec: number;
};

export const DEFAULT_SUBTITLE_CHUNKING_OPTIONS: SubtitleChunkingOptions = {
  minWordsPerPhrase: 3,
  maxWordsPerPhrase: 7,
  maxCharsPerLine: 18,
  maxLines: 2,
  silenceGapThresholdSec: 0.45,
};
