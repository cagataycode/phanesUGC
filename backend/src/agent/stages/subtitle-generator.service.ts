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
  ): Promise<SubtitleData> {
    this.logger.log(`Generating subtitles for job ${jobId}`);

    // Generate subtitle segments from script voiceover lines
    // Timing is initially script-derived, then scaled to actual video duration
    const segments: SubtitleSegment[] = script.voiceoverLines.map(
      (line, index) => ({
        id: `sub-${index}`,
        text: line.text,
        startSec: index * 3,
        endSec: (index + 1) * 3,
        lines: [line.text],
        style: 'standard',
      }),
    );

    const scalingFactor =
      veoOutput.actualDurationSec / script.totalEstimatedDuration;

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
      style: 'standard',
      generatedAt: new Date(),
    });
  }
}
