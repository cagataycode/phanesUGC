export type RawSubtitleSegment = {
  start: number;
  end: number;
  text: string;
};

export type SubtitlePhrase = {
  id: string;
  start: number;
  end: number;
  text: string;
  lines: string[];
};

export type SubtitleChunkingOptions = {
  minWordsPerPhrase: number;
  maxWordsPerPhrase: number;
  maxLines: number;
};

export const DEFAULT_SUBTITLE_CHUNKING_OPTIONS: SubtitleChunkingOptions = {
  minWordsPerPhrase: 3,
  maxWordsPerPhrase: 4,
  maxLines: 2,
};
