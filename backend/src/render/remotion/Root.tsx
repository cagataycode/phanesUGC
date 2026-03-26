import { Composition } from 'remotion';
import {
  REMOTION_COMPOSITION_ID,
  RenderRequest,
} from './constants';
import { KaraokeSubtitledVideo } from './compositions/KaraokeSubtitledVideo';

const defaultProps: RenderRequest = {
  videoUrl: '',
  segments: [],
  fps: 30,
  durationInFrames: 1,
  width: 1080,
  height: 1920,
};

export const RemotionRoot = () => {
  return (
    <Composition
      id={REMOTION_COMPOSITION_ID}
      component={KaraokeSubtitledVideo}
      durationInFrames={defaultProps.durationInFrames}
      fps={defaultProps.fps}
      width={defaultProps.width}
      height={defaultProps.height}
      defaultProps={defaultProps}
    />
  );
};
