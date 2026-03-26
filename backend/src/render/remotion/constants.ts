export const REMOTION_COMPOSITION_ID = 'KaraokeSubtitledVideo';

export type SubtitleWord = {
  word: string;
  start: number;
  end: number;
};

export type SubtitleSegment = {
  start: number;
  end: number;
  text: string;
  words: SubtitleWord[];
};

export type RenderRequest = {
  videoUrl: string;
  segments: SubtitleSegment[];
  fps: number;
  durationInFrames: number;
  width: number;
  height: number;
};
