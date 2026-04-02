import { Injectable, Logger } from '@nestjs/common';
import { RenderTimeline } from '../contracts/render-timeline';
import { FinalOutput } from '../contracts/final-output';
import { RenderService } from '../../render/render.service';
import { GcsStorageService } from '../../storage/gcs-storage.service';
import { SubtitlePhrase } from '../../render/subtitles/subtitle-types';

/**
 * RenderExecutorService - Executes Remotion render
 *
 * Triggers Remotion to produce the final video with subtitles
 */
@Injectable()
export class RenderExecutorService {
  private readonly logger = new Logger(RenderExecutorService.name);

  constructor(
    private readonly renderService: RenderService,
    private readonly gcsStorage: GcsStorageService,
  ) {}

  async render(timeline: RenderTimeline): Promise<FinalOutput> {
    this.logger.log(`Rendering final video for job ${timeline.jobId}`);

    // Convert SubtitleData segments to SubtitlePhrase format
    const phrases: SubtitlePhrase[] = timeline.subtitles.segments.map(
      (seg) => ({
        id: seg.id,
        start: seg.startSec,
        end: seg.endSec,
        text: seg.text,
        lines: seg.lines,
      }),
    );

    // Get signed URL for the video source
    const videoUrl = await this.gcsStorage.createSignedVideoUrl(
      timeline.videoSource.gcsPath
        .replace('gs://', '')
        .split('/')
        .slice(1)
        .join('/'),
    );

    // Prepare render request
    const renderRequest = {
      videoUrl,
      phrases: timeline.subtitles.enabled ? phrases : [],
      fps: timeline.output.fps,
      durationInFrames: timeline.output.durationInFrames,
      width: timeline.output.width,
      height: timeline.output.height,
      subtitleStyle: timeline.subtitles.style,
    };

    // Render to temp file
    const { outputPath, cleanup } =
      await this.renderService.renderToTempFile(renderRequest);

    try {
      // Upload rendered video to GCS
      const finalGcsPath = `${timeline.jobId}/final.mp4`;
      await this.gcsStorage.uploadLocalFile(
        outputPath,
        finalGcsPath,
        'video/mp4',
      );

      // Create signed URL for the final video
      const finalVideoUrl =
        await this.gcsStorage.createSignedVideoUrl(finalGcsPath);

      const output: FinalOutput = {
        jobId: timeline.jobId,
        videoUrl: finalVideoUrl,
        gcsPath: `gs://${finalGcsPath}`,
        metadata: {
          durationSec: timeline.videoSource.durationSec,
          width: timeline.output.width,
          height: timeline.output.height,
          fileSizeBytes: 0, // File size retrieved by OutputValidator
          fps: timeline.output.fps,
        },
        subtitles: timeline.subtitles.segments.map((seg) => ({
          text: seg.text,
          startSec: seg.startSec,
          endSec: seg.endSec,
        })),
        transcript: timeline.subtitles.segments
          .map((seg) => seg.text)
          .join(' '),
        qualityReports: [],
        qualityScore: 1.0,
        finalizedAt: new Date(),
      };

      this.logger.log(`Final video rendered: ${finalGcsPath}`);

      return output;
    } finally {
      // Cleanup temp file
      await cleanup();
    }
  }
}
