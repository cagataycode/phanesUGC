import { chunkSubtitleSegments } from './subtitle-chunker';
import {
  RawSubtitleSegment,
  SubtitlePhrase,
  SubtitleWord,
} from './subtitle-types';

export type SubtitleTimelineState = {
  currentTimeSec: number;
  activePhrase: SubtitlePhrase | null;
  activePhraseIndex: number;
  activeWord: SubtitleWord | null;
  activeWordIndex: number;
  spokenWords: SubtitleWord[];
  isInPhraseGap: boolean;
};

export type SubtitleTimelineOptions = {
  gapGraceMs: number;
};

const DEFAULT_TIMELINE_OPTIONS: SubtitleTimelineOptions = {
  gapGraceMs: 80,
};

export const getSubtitleTimelineState = ({
  frame,
  fps,
  phrases,
  options,
}: {
  frame: number;
  fps: number;
  phrases: SubtitlePhrase[];
  options?: Partial<SubtitleTimelineOptions>;
}): SubtitleTimelineState => {
  const settings = { ...DEFAULT_TIMELINE_OPTIONS, ...options };
  const currentTimeSec = Math.max(frame, 0) / fps;

  const activePhraseIndex = phrases.findIndex(
    (phrase) => currentTimeSec >= phrase.start && currentTimeSec <= phrase.end,
  );

  if (activePhraseIndex === -1) {
    return {
      currentTimeSec,
      activePhrase: null,
      activePhraseIndex: -1,
      activeWord: null,
      activeWordIndex: -1,
      spokenWords: [],
      isInPhraseGap: false,
    };
  }

  const activePhrase = phrases[activePhraseIndex];
  const activeWordIndex = findActiveWordIndex(
    currentTimeSec,
    activePhrase.words,
    settings,
  );
  const activeWord =
    activeWordIndex >= 0 ? activePhrase.words[activeWordIndex] : null;
  const spokenWords = activePhrase.words.filter(
    (word) => currentTimeSec >= word.start,
  );

  return {
    currentTimeSec,
    activePhrase,
    activePhraseIndex,
    activeWord,
    activeWordIndex,
    spokenWords,
    isInPhraseGap: activeWordIndex === -1,
  };
};

export const resolveRenderPhrases = (
  segments: RawSubtitleSegment[],
  phrases?: SubtitlePhrase[],
): SubtitlePhrase[] => {
  if (phrases && phrases.length > 0) {
    return phrases;
  }

  return chunkSubtitleSegments(segments);
};

const findActiveWordIndex = (
  currentTimeSec: number,
  words: SubtitleWord[],
  options: SubtitleTimelineOptions,
) => {
  const directMatchIndex = words.findIndex(
    (word) => currentTimeSec >= word.start && currentTimeSec <= word.end,
  );

  if (directMatchIndex >= 0) {
    return directMatchIndex;
  }

  const graceSec = options.gapGraceMs / 1000;

  for (let index = 0; index < words.length - 1; index += 1) {
    const currentWord = words[index];
    const nextWord = words[index + 1];

    const withinGap =
      currentTimeSec > currentWord.end && currentTimeSec < nextWord.start;
    const keepCurrentHighlighted =
      withinGap && currentTimeSec <= currentWord.end + graceSec;

    if (keepCurrentHighlighted) {
      return index;
    }
  }

  return -1;
};
