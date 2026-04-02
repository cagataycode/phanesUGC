import { Injectable, Logger } from '@nestjs/common';
import { FinalOutput } from '../contracts/final-output';
import { GcsStorageService } from '../../storage/gcs-storage.service';

/**
 * OutputValidatorService - Validates final output
 *
 * Soft validation - logs warnings but doesn't block delivery
 */

export interface ValidationResult {
  passed: boolean;
  warnings: string[];
  errors: string[];
  checks: {
    fileExists: boolean;
    durationValid: boolean;
    resolutionValid: boolean;
    fileSizeValid: boolean;
    subtitlesValid: boolean;
  };
}

@Injectable()
export class OutputValidatorService {
  private readonly logger = new Logger(OutputValidatorService.name);

  constructor(private readonly storage: GcsStorageService) {}

  /**
   * Validate final output
   * Soft validation - logs warnings but doesn't block
   */
  async validate(
    output: FinalOutput,
    expectedDuration: number,
    expectedAspectRatio: string,
  ): Promise<ValidationResult> {
    this.logger.log(`Validating output for job ${output.jobId}`);

    const warnings: string[] = [];
    const errors: string[] = [];
    const checks = {
      fileExists: false,
      durationValid: false,
      resolutionValid: false,
      fileSizeValid: false,
      subtitlesValid: false,
    };

    // Check 1: File exists in storage
    try {
      checks.fileExists = await this.checkFileExists(output.gcsPath);
      if (!checks.fileExists) {
        errors.push(`Video file not found at ${output.gcsPath}`);
      }
    } catch (error) {
      errors.push(
        `Failed to check file existence: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Check 2: Duration is within tolerance
    checks.durationValid = this.checkDuration(
      output.metadata.durationSec,
      expectedDuration,
      2, // 2 second tolerance
    );
    if (!checks.durationValid) {
      warnings.push(
        `Duration ${output.metadata.durationSec}s differs from expected ${expectedDuration}s`,
      );
    }

    // Check 3: Resolution matches aspect ratio
    checks.resolutionValid = this.checkResolution(
      output.metadata.width,
      output.metadata.height,
      expectedAspectRatio,
    );
    if (!checks.resolutionValid) {
      warnings.push(
        `Resolution ${output.metadata.width}x${output.metadata.height} doesn't match expected aspect ratio ${expectedAspectRatio}`,
      );
    }

    // Check 4: File size is reasonable
    checks.fileSizeValid = this.checkFileSize(
      output.metadata.fileSizeBytes,
      1, // Min 1 byte
      500 * 1024 * 1024, // Max 500MB
    );
    if (!checks.fileSizeValid) {
      warnings.push(
        `File size ${output.metadata.fileSizeBytes} bytes is outside acceptable range`,
      );
    }

    // Check 5: Subtitles cover full duration
    checks.subtitlesValid = this.checkSubtitles(
      output.subtitles,
      output.metadata.durationSec,
    );
    if (!checks.subtitlesValid) {
      warnings.push('Subtitles do not cover full video duration');
    }

    const passed = errors.length === 0;

    // Log results
    if (passed) {
      this.logger.log(
        `Output validation passed for job ${output.jobId} with ${warnings.length} warnings`,
      );
      if (warnings.length > 0) {
        warnings.forEach((warning) => this.logger.warn(warning));
      }
    } else {
      this.logger.error(
        `Output validation failed for job ${output.jobId} with ${errors.length} errors`,
      );
      errors.forEach((error) => this.logger.error(error));
    }

    return {
      passed,
      warnings,
      errors,
      checks,
    };
  }

  /**
   * Check if video file exists in storage
   */
  private async checkFileExists(gcsPath: string): Promise<boolean> {
    try {
      // gcsPath is objectPath format (jobId/final.mp4)
      await this.storage.createSignedVideoUrl(gcsPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if duration is within tolerance
   */
  private checkDuration(
    actualDuration: number,
    expectedDuration: number,
    toleranceSec: number = 2,
  ): boolean {
    const diff = Math.abs(actualDuration - expectedDuration);
    return diff <= toleranceSec;
  }

  /**
   * Check if resolution matches aspect ratio
   */
  private checkResolution(
    width: number,
    height: number,
    expectedAspectRatio: string,
  ): boolean {
    const actualRatio = width / height;

    // Parse expected aspect ratio
    const [expectedWidth, expectedHeight] = expectedAspectRatio
      .split(':')
      .map(Number);
    const expectedRatio = expectedWidth / expectedHeight;

    // Allow 5% tolerance for aspect ratio
    const tolerance = 0.05;
    const diff = Math.abs(actualRatio - expectedRatio);
    return diff <= expectedRatio * tolerance;
  }

  /**
   * Check if file size is reasonable
   */
  private checkFileSize(
    fileSizeBytes: number,
    minBytes: number = 1,
    maxBytes: number = 500 * 1024 * 1024,
  ): boolean {
    return fileSizeBytes >= minBytes && fileSizeBytes <= maxBytes;
  }

  /**
   * Check if subtitles cover full duration
   */
  private checkSubtitles(
    subtitles: Array<{ text: string; startSec: number; endSec: number }>,
    videoDuration: number,
  ): boolean {
    if (subtitles.length === 0) {
      return false;
    }

    // Check if first subtitle starts near beginning (within 1 second)
    const firstStart = subtitles[0].startSec;
    if (firstStart > 1) {
      return false;
    }

    // Check if last subtitle ends near end (within 1 second)
    const lastEnd = subtitles[subtitles.length - 1].endSec;
    if (Math.abs(lastEnd - videoDuration) > 1) {
      return false;
    }

    return true;
  }
}
