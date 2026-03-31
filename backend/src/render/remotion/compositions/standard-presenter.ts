import { SubtitlePhrase } from '../../subtitles/subtitle-types';

export type StandardLinePresentation = {
  text: string;
};

export type StandardCaptionPresentation = {
  lines: StandardLinePresentation[];
};

export const buildStandardCaptionPresentation = (
  phrase: SubtitlePhrase,
): StandardCaptionPresentation => {
  const lines = phrase.lines.map(
    (text) => ({ text }) satisfies StandardLinePresentation,
  );

  return {
    lines,
  };
};
