import { Injectable } from '@nestjs/common';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'node:path';
import { RenderRequest, REMOTION_COMPOSITION_ID } from './remotion/constants';
import { chunkSubtitleSegments } from './subtitles/subtitle-chunker';
import { RawSubtitleSegment, SubtitlePhrase } from './subtitles/subtitle-types';

export type PrepareRenderRequestInput = Omit<RenderRequest, 'phrases'> & {
  phrases?: SubtitlePhrase[];
};

@Injectable()
export class RenderService {
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

    const bundleLocation = await bundle({
      entryPoint,
      webpackOverride: (config) => config,
    });

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: REMOTION_COMPOSITION_ID,
      inputProps: preparedRequest,
    });

    return {
      bundleLocation,
      composition,
      inputProps: preparedRequest,
    };
  }

  async render(request: PrepareRenderRequestInput, outputLocation: string) {
    const prepared = await this.prepareRender(request);

    await renderMedia({
      serveUrl: prepared.bundleLocation,
      composition: prepared.composition,
      codec: 'h264',
      outputLocation,
      inputProps: prepared.inputProps,
    });

    return outputLocation;
  }
}
