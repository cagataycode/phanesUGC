import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

@Injectable()
export class VideoUtilsService {
  private readonly logger = new Logger(VideoUtilsService.name);

  async getVideoDuration(filePath: string): Promise<number> {
    try {
      const { stdout } = await execFileAsync('ffprobe', [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        filePath,
      ]);
      const duration = parseFloat(stdout);
      if (isNaN(duration)) {
        throw new Error('Invalid duration output from ffprobe');
      }
      this.logger.log(`Extracted duration for ${filePath}: ${duration}s`);
      return duration;
    } catch (error: unknown) {
      this.logger.error(
        `Failed to get video duration for ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (
        error instanceof Error &&
        'code' in error &&
        (error as NodeJS.ErrnoException).code === 'ENOENT'
      ) {
        throw new Error('ffprobe is not installed or not found in PATH.');
      }
      throw new Error(`Could not get video duration for ${filePath}.`);
    }
  }
}
