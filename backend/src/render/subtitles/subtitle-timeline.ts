import { SubtitlePhrase } from './subtitle-types';

export type SubtitleTimelineState = {
  currentTimeSec: number;
  activePhrase: SubtitlePhrase | null;
  activePhraseIndex: number;
};

export const getSubtitleTimelineState = ({
  frame,
  fps,
  phrases,
}: {
  frame: number;
  fps: number;
  phrases: SubtitlePhrase[];
}): SubtitleTimelineState => {
  const currentTimeSec = Math.max(frame, 0) / fps;

  const activePhraseIndex = phrases.findIndex(
    (phrase) => currentTimeSec >= phrase.start && currentTimeSec < phrase.end,
  );

  if (activePhraseIndex === -1) {
    return {
      currentTimeSec,
      activePhrase: null,
      activePhraseIndex: -1,
    };
  }

  const activePhrase = phrases[activePhraseIndex];

  return {
    currentTimeSec,
    activePhrase,
    activePhraseIndex,
  };
};
