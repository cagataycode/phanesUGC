import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

@Injectable()
export class VideoUtilsService {
  private readonly logger = new Logger(VideoUtilsService.name);

  async getVideoDuration(filePath: string): Promise<number> {
    try {
      const command = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;
      const { stdout } = await execAsync(command);
      const duration = parseFloat(stdout);
      if (isNaN(duration)) {
        throw new Error('Invalid duration output from ffprobe');
      }
      this.logger.log(`Extracted duration for ${filePath}: ${duration}s`);
      return duration;
    } catch (error) {
      this.logger.error(
        `Failed to get video duration for ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(`Could not get video duration for ${filePath}.`);
    }
  }
}
