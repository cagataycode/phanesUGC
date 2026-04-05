import { Injectable, Logger } from '@nestjs/common';
import { AdScript } from '../contracts/ad-script';
import { VeoOutput } from '../contracts/veo-output';
import { SubtitleData, SubtitleSegment } from '../contracts/subtitle-data';
import { generateScriptSubtitles } from '../../render/subtitles/subtitle-chunker';

/**
 * SubtitleGeneratorService - Generates subtitles from script
 *
 * Algorithmic generation based on script timing, then scaled to actual video duration
 * Uses chunker to split text into 3-4 word phrases for better readability
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

    // Generate chunked subtitle phrases from script voiceover lines
    // Each line is split into 3-4 word phrases with proper timing
    let cumulativeTime = 0;
    const allSegments: SubtitleSegment[] = [];

    script.voiceoverLines.forEach((line, lineIndex) => {
      const lineStartTime = cumulativeTime;
      const lineDuration = line.estimatedDurationSec;

      // Use chunker to split line into 3-4 word phrases
      const phrases = generateScriptSubtitles(line.text, lineDuration);

      // Convert phrases to segments with absolute timing
      phrases.forEach((phrase, phraseIndex) => {
        allSegments.push({
          id: `sub-${lineIndex}-${phraseIndex}`,
          text: phrase.text,
          startSec: lineStartTime + phrase.start,
          endSec: lineStartTime + phrase.end,
          lines: phrase.lines,
          style,
        });
      });

      cumulativeTime += lineDuration;
    });

    // Guard against division by zero
    const scalingFactor =
      script.totalEstimatedDuration > 0
        ? veoOutput.actualDurationSec / script.totalEstimatedDuration
        : 1;

    // Scale timing to match actual video duration
    const scaledSegments = allSegments.map((seg) => ({
      ...seg,
      startSec: seg.startSec * scalingFactor,
      endSec: seg.endSec * scalingFactor,
    }));

    this.logger.log(
      `Generated ${scaledSegments.length} subtitle phrases from ${script.voiceoverLines.length} voiceover lines`,
    );

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
