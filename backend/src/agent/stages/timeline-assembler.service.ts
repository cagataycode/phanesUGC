import { Injectable, Logger } from '@nestjs/common';
import { VeoOutput } from '../contracts/veo-output';
import { SubtitleData } from '../contracts/subtitle-data';
import { NormalizedRequest } from '../contracts/normalized-request';
import { RenderTimeline } from '../contracts/render-timeline';

/**
 * TimelineAssemblerService - Assembles Remotion render specification
 *
 * Pure algorithmic assembly - no AI involved
 */
@Injectable()
export class TimelineAssemblerService {
  private readonly logger = new Logger(TimelineAssemblerService.name);

  assemble(
    jobId: string,
    veoOutput: VeoOutput,
    subtitleData: SubtitleData,
    request: NormalizedRequest,
  ): Promise<RenderTimeline> {
    this.logger.log(`Assembling render timeline for job ${jobId}`);

    const fps = 30;
    const durationInFrames = Math.round(veoOutput.actualDurationSec * fps);

    const timeline: RenderTimeline = {
      jobId,
      videoSource: {
        gcsPath: veoOutput.gcsPath,
        durationSec: veoOutput.actualDurationSec,
        width: veoOutput.resolution.width,
        height: veoOutput.resolution.height,
      },
      subtitles: {
        enabled: !request.disableCaptions,
        segments: subtitleData.segments.map((seg) => ({
          id: seg.id,
          text: seg.text,
          startSec: seg.startSec,
          endSec: seg.endSec,
          lines: seg.lines,
        })),
        style: subtitleData.style,
      },
      backgroundMusic: {
        enabled: !request.disableBackgroundMusic,
        volume: 0.3,
      },
      ctaOverlay: {
        enabled: !request.disableCtaOverlay,
        text: request.cta || '',
        startSec: veoOutput.actualDurationSec - 2,
        endSec: veoOutput.actualDurationSec,
      },
      output: {
        fps,
        width: veoOutput.resolution.width,
        height: veoOutput.resolution.height,
        durationInFrames,
      },
      assembledAt: new Date(),
    };

    return Promise.resolve(timeline);
  }
}
