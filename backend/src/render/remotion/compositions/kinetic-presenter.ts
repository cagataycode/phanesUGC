import { SubtitlePhrase } from '../../subtitles/subtitle-types';

export type KineticLinePresentation = {
  text: string;
};

export type KineticCaptionPresentation = {
  lines: KineticLinePresentation[];
};

export const buildKineticCaptionPresentation = (
  phrase: SubtitlePhrase,
): KineticCaptionPresentation => {
  const lines = phrase.lines.map(
    (text) => ({ text }) satisfies KineticLinePresentation,
  );

  return {
    lines,
  };
};
