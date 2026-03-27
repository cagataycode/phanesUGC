import { Injectable, Logger } from '@nestjs/common';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { RenderRequest, REMOTION_COMPOSITION_ID } from './remotion/constants';
import { chunkSubtitleSegments } from './subtitles/subtitle-chunker';
import { RawSubtitleSegment, SubtitlePhrase } from './subtitles/subtitle-types';

export type PrepareRenderRequestInput = Omit<RenderRequest, 'phrases'> & {
  phrases?: SubtitlePhrase[];
};

export type RenderToTempFileResult = {
  outputPath: string;
  cleanup: () => Promise<void>;
  request: RenderRequest;
};

@Injectable()
export class RenderService {
  private readonly logger = new Logger(RenderService.name);

  prepareRenderRequest(request: PrepareRenderRequestInput): RenderRequest {
    return {
      ...request,
      phrases:
        request.phrases && request.phrases.length > 0
          ? request.phrases
          : this.prepareSubtitlePhrases(request.segments),
    };
  }

  prepareSubtitlePhrases(segments: RawSubtitleSegment[]): SubtitlePhrase[] {
    return chunkSubtitleSegments(segments);
  }

  async prepareRender(request: PrepareRenderRequestInput) {
    const preparedRequest = this.prepareRenderRequest(request);
    const entryPoint = path.resolve(
      process.cwd(),
      'src/render/remotion/index.ts',
    );

    const publicDir = path.resolve(process.cwd(), 'src/render/remotion/public');
    const bundleLocation = await bundle({
      entryPoint,
      publicDir,
      webpackOverride: (config) => config,
    });

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: REMOTION_COMPOSITION_ID,
      inputProps: preparedRequest,
    });

    return {
      bundleLocation: bundleLocation,
      composition,
      inputProps: preparedRequest,
    };
  }

  async render(request: PrepareRenderRequestInput, outputLocation: string) {
    const startTime = Date.now();
    const prepared = await this.prepareRender(request);

    this.logger.log(
      `Starting Remotion render: ${prepared.inputProps.width}x${prepared.inputProps.height}, ${prepared.inputProps.fps}fps, ${prepared.inputProps.durationInFrames} frames`,
    );

    const RENDER_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
    const renderPromise = renderMedia({
      serveUrl: prepared.bundleLocation,
      composition: prepared.composition,
      codec: 'h264',
      outputLocation,
      inputProps: prepared.inputProps,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      chromiumOptions: {
        disableWebSecurity: true,
        gl: 'angle',
        args: [
          '--disable-gpu',
          '--no-sandbox',
          '--disable-accelerated-video-decode',
        ],
      } as any,
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(`Remotion render timed out after ${RENDER_TIMEOUT_MS}ms`),
        );
      }, RENDER_TIMEOUT_MS);
    });

    try {
      await Promise.race([renderPromise, timeoutPromise]);
    } catch (error) {
      this.logger.error(
        `Render failed or timed out: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }

    const duration = Date.now() - startTime;
    this.logger.log(
      `Remotion render completed in ${duration}ms. Output: ${outputLocation}`,
    );

    return outputLocation;
  }

  async renderToTempFile(
    request: PrepareRenderRequestInput,
  ): Promise<RenderToTempFileResult> {
    const tempDirectory = await mkdtemp(
      path.join(tmpdir(), 'phanes-remotion-render-'),
    );
    const outputPath = path.join(tempDirectory, 'subtitled-output.mp4');
    const preparedRequest = this.prepareRenderRequest(request);

    await this.render(preparedRequest, outputPath);

    return {
      outputPath,
      request: preparedRequest,
      cleanup: async () => {
        try {
          await rm(tempDirectory, { recursive: true, force: true });
          this.logger.debug(
            `Cleaned up temp render directory: ${tempDirectory}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to cleanup temp render directory: ${tempDirectory}`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      },
    };
  }
}
