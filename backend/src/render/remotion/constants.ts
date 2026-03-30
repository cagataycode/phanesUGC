import {
  RawSubtitleSegment,
  SubtitlePhrase,
} from '../subtitles/subtitle-types';

export const REMOTION_COMPOSITION_ID = 'SubtitledVideo';

export type SubtitleStyle = 'standard' | 'kinetic';

export type RenderRequest = {
  videoUrl: string;
  segments: RawSubtitleSegment[];
  phrases?: SubtitlePhrase[];
  fps: number;
  durationInFrames: number;
  width: number;
  height: number;
  subtitleStyle: SubtitleStyle;
};
