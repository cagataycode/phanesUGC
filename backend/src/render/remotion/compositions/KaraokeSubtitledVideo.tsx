import React from 'react';
import { AbsoluteFill, Sequence, Video, useCurrentFrame } from 'remotion';
import { RenderRequest } from '../constants';

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  left: 96,
  right: 96,
  bottom: 260,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
};

const captionStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  gap: '0.3em',
  fontSize: 64,
  fontWeight: 800,
  lineHeight: 1.2,
  color: '#ffffff',
  textAlign: 'center',
  textShadow:
    '0 2px 8px rgba(0,0,0,0.6), 0 0 24px rgba(0,0,0,0.35), 0 4px 16px rgba(0,0,0,0.5)',
};

export const KaraokeSubtitledVideo: React.FC<RenderRequest> = ({
  videoUrl,
  segments,
}) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      <Sequence from={0}>
        <Video src={videoUrl} style={{ width: '100%', height: '100%' }} />
      </Sequence>
      <div style={containerStyle}>
        <div style={captionStyle}>
          Placeholder karaoke subtitles at frame {frame} with {segments.length}{' '}
          segments
        </div>
      </div>
    </AbsoluteFill>
  );
};
