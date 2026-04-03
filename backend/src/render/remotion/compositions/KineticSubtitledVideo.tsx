import React, { useMemo } from 'react';
import { AbsoluteFill, Sequence, Video, useCurrentFrame, staticFile } from 'remotion';
import { RenderRequest } from '../constants';
import {
  getSubtitleTimelineState
} from '../../subtitles/subtitle-timeline';
import { buildKineticCaptionPresentation } from './kinetic-presenter';

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
  flexDirection: 'column',
  alignItems: 'center',
  gap: 12,
  fontSize: 64,
  fontWeight: 800,
  lineHeight: 1.2,
  textAlign: 'center',
};

const wordShadow =
  '0 2px 8px rgba(0,0,0,0.6), 0 0 24px rgba(0,0,0,0.35), 0 4px 16px rgba(0,0,0,0.5)';

const lineStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  gap: '0.24em',
};

const getChunkStyle = (): React.CSSProperties => {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.08em 0.18em',
    borderRadius: '0.28em',
    color: '#0f172a',
    backgroundColor: '#facc15',
    border: '1px solid rgba(255,255,255,0.32)',
    transform: 'scale(1.06)',
    boxShadow: '0 8px 24px rgba(250, 204, 21, 0.35)',
    textShadow: 'none',
  };
};

export const KineticSubtitledVideo: React.FC<RenderRequest> = ({
  videoUrl,
  phrases,
  fps,
}) => {
  const resolvedVideoUrl = useMemo(() => {
    if (videoUrl.startsWith('http://') || videoUrl.startsWith('https://')) {
      return videoUrl;
    }
    return staticFile(videoUrl);
  }, [videoUrl]);

  const frame = useCurrentFrame();
  const renderPhrases = phrases ?? [];
  const subtitleState = getSubtitleTimelineState({
    frame,
    fps,
    phrases: renderPhrases,
  });
  const visiblePhrase = subtitleState.activePhrase;
  const captionPresentation = visiblePhrase
    ? buildKineticCaptionPresentation(visiblePhrase)
    : null;

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      <Sequence from={0}>
        <Video
          src={resolvedVideoUrl}
          style={{ width: '100%', height: '100%' }}
          onError={(e) => {
            console.error('Video loading error:', e);
            throw new Error(`Failed to load video: ${resolvedVideoUrl}`);
          }}
        />
      </Sequence>
      {captionPresentation ? (
        <div style={containerStyle}>
          <div style={captionStyle}>
            {captionPresentation.lines.map((line, lineIndex) => (
              <div key={`${visiblePhrase?.id ?? 'line'}-${lineIndex}`} style={lineStyle}>
                  <span style={getChunkStyle()}>
                    {line.text}
                  </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
