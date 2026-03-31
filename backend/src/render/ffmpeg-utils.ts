import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Logger } from '@nestjs/common';

const execFileAsync = promisify(execFile);

const logger = new Logger('FFmpegUtils');

/**
 * Transcodes a video file into a Remotion-compatible format using FFmpeg.
 *
 * Converts to H.264 / AAC with constant frame rate (CFR) and yuv420p pixel format
 * to avoid macOS VideoToolbox decode errors (e.g. VTDecompressionOutputCallback -12909)
 * that occur with HEVC, VFR, or unusual profile/level source videos from Vertex AI / Veo.
 *
 * @param inputPath  - Absolute path to the source video file.
 * @param outputPath - Absolute path where the transcoded file will be written.
 * @param options    - Optional overrides (fps, crf, preset).
 */
export async function transcodeForRemotion(
  inputPath: string,
  outputPath: string,
  options?: { fps?: number; crf?: number; preset?: string },
): Promise<void> {
  const fps = options?.fps ?? 30;
  const crf = options?.crf ?? 18;
  const preset = options?.preset ?? 'fast';

  logger.log(
    `Transcoding "${inputPath}" → "${outputPath}" (h264, ${fps}fps, crf ${crf}, preset ${preset})`,
  );

  const args = [
    '-i',
    inputPath,
    // Video codec
    '-c:v',
    'libx264',
    '-preset',
    preset,
    '-crf',
    String(crf),
    // Ensure even dimensions (required by H.264)
    '-vf',
    'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    // Constant frame rate
    '-r',
    String(fps),
    // Most compatible pixel format
    '-pix_fmt',
    'yuv420p',
    // Audio codec
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    // Streamable MP4 (moov atom at front)
    '-movflags',
    '+faststart',
    // Overwrite output without prompting
    '-y',
    outputPath,
  ];

  try {
    await execFileAsync('ffmpeg', args, { maxBuffer: 10 * 1024 * 1024 });
    logger.log(`Transcoding complete: "${outputPath}"`);
  } catch (error) {
    logger.error(
      `FFmpeg transcoding failed for "${inputPath}"`,
      error instanceof Error ? error.stack : undefined,
    );
    throw new Error(
      `FFmpeg transcoding failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
