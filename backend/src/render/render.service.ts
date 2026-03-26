import { Injectable } from '@nestjs/common';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'node:path';
import { RenderRequest, REMOTION_COMPOSITION_ID } from './remotion/constants';

@Injectable()
export class RenderService {
  async prepareRender(request: RenderRequest) {
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
      inputProps: request,
    });

    return {
      bundleLocation,
      composition,
      inputProps: request,
    };
  }

  async render(request: RenderRequest, outputLocation: string) {
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
