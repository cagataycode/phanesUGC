import { Composition } from 'remotion';
import {
  REMOTION_COMPOSITION_ID,
  RenderRequest,
} from './constants';
import { KineticSubtitledVideo } from './compositions/KineticSubtitledVideo';
import { StandardSubtitledVideo } from './compositions/StandardSubtitledVideo';

const defaultProps: RenderRequest = {
  videoUrl: '',
  phrases: [],
  fps: 24,
  durationInFrames: 1,
  width: 1080,
  height: 1920,
  subtitleStyle: 'kinetic',
};

const SubtitleComponent: React.FC<RenderRequest> = (props) => {
  switch (props.subtitleStyle) {
    case 'standard':
      return <StandardSubtitledVideo {...props} />;
    case 'kinetic':
    default:
      return <KineticSubtitledVideo {...props} />;
  }
};

export const RemotionRoot = () => {
  return (
    <Composition
      id={REMOTION_COMPOSITION_ID}
      component={SubtitleComponent}
      calculateMetadata={({ props }) => {
        return {
          durationInFrames: props.durationInFrames || 1,
          fps: props.fps || 24,
          width: props.width || 1080,
          height: props.height || 1920,
        };
      }}
      durationInFrames={defaultProps.durationInFrames}
      fps={defaultProps.fps}
      width={defaultProps.width}
      height={defaultProps.height}
      defaultProps={defaultProps}
    />
  );
};
