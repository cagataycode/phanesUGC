import { Injectable, Logger } from '@nestjs/common';
import { AdScript } from '../contracts/ad-script';
import { VeoOutput } from '../contracts/veo-output';
import { SubtitleData, SubtitleSegment } from '../contracts/subtitle-data';

/**
 * SubtitleGeneratorService - Generates subtitles from script
 *
 * Algorithmic generation based on script timing, then scaled to actual video duration
 */
@Injectable()
export class SubtitleGeneratorService {
  private readonly logger = new Logger(SubtitleGeneratorService.name);

  generate(
    jobId: string,
    script: AdScript,
    veoOutput: VeoOutput,
    style: 'standard' | 'kinetic' = 'standard',
  ): Promise<SubtitleData> {
    this.logger.log(
      `Generating subtitles for job ${jobId} with style: ${style}`,
    );

    // Generate subtitle segments from script voiceover lines
    // Use cumulative timing from script's estimatedDurationSec
    let cumulativeTime = 0;
    const segments: SubtitleSegment[] = script.voiceoverLines.map(
      (line, index) => {
        const startSec = cumulativeTime;
        const endSec = cumulativeTime + line.estimatedDurationSec;
        cumulativeTime = endSec;

        return {
          id: `sub-${index}`,
          text: line.text,
          startSec,
          endSec,
          lines: [line.text],
          style,
        };
      },
    );

    // Guard against division by zero
    const scalingFactor =
      script.totalEstimatedDuration > 0
        ? veoOutput.actualDurationSec / script.totalEstimatedDuration
        : 1;

    // Scale timing to match actual video duration
    const scaledSegments = segments.map((seg) => ({
      ...seg,
      startSec: seg.startSec * scalingFactor,
      endSec: seg.endSec * scalingFactor,
    }));

    return Promise.resolve({
      jobId,
      segments: scaledSegments,
      plannedDurationSec: script.totalEstimatedDuration,
      actualDurationSec: veoOutput.actualDurationSec,
      scalingFactor,
      style,
      generatedAt: new Date(),
    });
  }
}
