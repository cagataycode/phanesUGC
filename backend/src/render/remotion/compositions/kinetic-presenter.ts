import { SubtitlePhrase } from '../../subtitles/subtitle-types';
import { SubtitleTimelineState } from '../../subtitles/subtitle-timeline';

export type KineticLinePresentation = {
  text: string;
};

export type KineticCaptionPresentation = {
  lines: KineticLinePresentation[];
  isActive: boolean;
};

export const buildKineticCaptionPresentation = (
  phrase: SubtitlePhrase,
  subtitleState: SubtitleTimelineState,
): KineticCaptionPresentation => {
  const lines = phrase.lines.map(
    (text) => ({ text }) satisfies KineticLinePresentation,
  );

  return {
    lines,
    isActive: subtitleState.activePhrase?.id === phrase.id,
  };
};
