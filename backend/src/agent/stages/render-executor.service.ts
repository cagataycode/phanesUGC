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

    // Get object path for the video source
    // Handle both full GCS URIs (gs://bucket/path) and plain object paths (path)
    const gcsPath = timeline.videoSource.gcsPath;
    const objectPath = gcsPath.startsWith('gs://')
      ? gcsPath.replace('gs://', '').split('/').slice(1).join('/')
      : gcsPath;

    // Download video locally for faster Remotion rendering
    const { mkdtemp, rm } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const path = await import('node:path');

    const tempDir = await mkdtemp(path.join(tmpdir(), 'phanes-video-'));
    const localVideoPath = path.join(tempDir, 'source-video.mp4');

    this.logger.debug(`Downloading source video to ${localVideoPath}`);
    await this.gcsStorage.downloadFile(objectPath, localVideoPath);

    // Prepare render request with local file path
    const renderRequest = {
      videoUrl: localVideoPath,
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
        gcsPath: finalGcsPath,
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
      // Cleanup temp files
      await cleanup();
      try {
        await rm(tempDir, { recursive: true, force: true });
        this.logger.debug(`Cleaned up temp video directory: ${tempDir}`);
      } catch (error) {
        this.logger.error(
          `Failed to cleanup temp video directory: ${tempDir}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }
}
