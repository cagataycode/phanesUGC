import React, { useMemo } from 'react';
import { AbsoluteFill, Sequence, OffthreadVideo, useCurrentFrame, staticFile } from 'remotion';
import { RenderRequest } from '../constants';
import {
  getSubtitleTimelineState
} from '../../subtitles/subtitle-timeline';
import { buildStandardCaptionPresentation } from './standard-presenter';

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  left: 96,
  right: 96,
  bottom: 220,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
};

const captionStyle: React.CSSProperties = {
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  borderRadius: '0.5em',
  padding: '12px 24px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  fontSize: 56,
  fontWeight: 700,
  lineHeight: 1.3,
  textAlign: 'center',
  color: '#FFFFFF',
  textShadow: '1px 1px 4px rgba(0,0,0,0.5)',
};

const lineStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
};

export const StandardSubtitledVideo: React.FC<RenderRequest> = ({
  videoUrl,
  phrases,
  fps,
}) => {
  const resolvedVideoUrl = useMemo(() => {
    // Handle HTTP/HTTPS URLs directly
    if (videoUrl.startsWith('http://') || videoUrl.startsWith('https://')) {
      return videoUrl;
    }
    // All other paths are treated as files in public/ folder
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
    ? buildStandardCaptionPresentation(visiblePhrase)
    : null;

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      <Sequence from={0}>
        <OffthreadVideo
          src={resolvedVideoUrl}
          style={{ width: '100%', height: '100%' }}
        />
      </Sequence>
      {captionPresentation ? (
        <div style={containerStyle}>
          <div style={captionStyle}>
            {captionPresentation.lines.map((line, lineIndex) => (
              <div key={`${visiblePhrase?.id ?? 'line'}-${lineIndex}`} style={lineStyle}>
                <span>{line.text}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
