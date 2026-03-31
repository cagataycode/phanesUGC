import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { RenderRequest, REMOTION_COMPOSITION_ID } from './remotion/constants';
import { SubtitlePhrase } from './subtitles/subtitle-types';
import { Env } from '../config/env';

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
  private readonly renderTimeoutMs: number;

  constructor(private configService: ConfigService<Env>) {
    this.renderTimeoutMs = this.configService.get(
      'REMOTION_RENDER_TIMEOUT_MS',
      {
        infer: true,
      },
    )!;
    this.logger.log(`Render timeout configured: ${this.renderTimeoutMs}ms`);
  }

  prepareRenderRequest(request: PrepareRenderRequestInput): RenderRequest {
    return {
      ...request,
      phrases: request.phrases || [],
    };
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

    const renderPromise = renderMedia({
      serveUrl: prepared.bundleLocation,
      composition: prepared.composition,
      codec: 'h264',
      outputLocation,
      inputProps: prepared.inputProps,
      chromiumOptions: {
        disableWebSecurity: true,
        gl: 'angle',
      },
    });

    let timeoutHandle: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(
          new Error(
            `Remotion render timed out after ${this.renderTimeoutMs}ms`,
          ),
        );
      }, this.renderTimeoutMs);
    });

    try {
      await Promise.race([renderPromise, timeoutPromise]);
    } catch (error) {
      this.logger.error(
        `Render failed or timed out: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
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
