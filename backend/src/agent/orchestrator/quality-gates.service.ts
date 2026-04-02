import { Injectable, Logger } from '@nestjs/common';
import { AdScript } from '../contracts/ad-script';
import { VeoOutput } from '../contracts/veo-output';
import { SubtitleData } from '../contracts/subtitle-data';
import { FinalOutput, QualityReport } from '../contracts/final-output';

/**
 * QualityGatesService - Soft quality checks between pipeline stages
 *
 * For MVP, all gates are advisory - they log warnings but don't block the pipeline
 */
@Injectable()
export class QualityGatesService {
  private readonly logger = new Logger(QualityGatesService.name);

  /**
   * Script quality gate - checks after script generation
   */
  checkScript(script: AdScript, targetDuration: number): QualityReport {
    const issues: string[] = [];

    // Check total duration
    if (script.totalEstimatedDuration > targetDuration + 1) {
      issues.push(
        `Script duration (${script.totalEstimatedDuration}s) exceeds target (${targetDuration}s)`,
      );
    }

    // Check hook exists and is short
    if (!script.hook || script.hook.length === 0) {
      issues.push('Hook line is missing');
    }

    // Check CTA exists
    if (!script.cta || script.cta.length === 0) {
      issues.push('CTA is missing');
    }

    // Check voiceover lines exist
    if (script.voiceoverLines.length === 0) {
      issues.push('No voiceover lines found');
    }

    const status = issues.length === 0 ? 'pass' : 'warn';
    if (status === 'warn') {
      this.logger.warn(`Script quality gate: ${issues.join(', ')}`);
    }

    return {
      gate: 'script',
      status,
      issues,
      checkedAt: new Date(),
    };
  }

  /**
   * Veo output quality gate - checks after video generation
   */
  checkVeoOutput(
    output: VeoOutput,
    targetDuration: number,
    targetAspectRatio: string,
  ): QualityReport {
    const issues: string[] = [];

    // Check duration is within tolerance
    const durationDiff = Math.abs(output.actualDurationSec - targetDuration);
    if (durationDiff > 2) {
      issues.push(
        `Video duration (${output.actualDurationSec}s) differs from target (${targetDuration}s) by ${durationDiff}s`,
      );
    }

    // Check aspect ratio matches
    const { width, height } = output.resolution;
    const actualRatio = width / height;
    const expectedRatio =
      targetAspectRatio === '9:16'
        ? 9 / 16
        : targetAspectRatio === '16:9'
          ? 16 / 9
          : 1;
    const ratioDiff = Math.abs(actualRatio - expectedRatio);
    if (ratioDiff > 0.1) {
      issues.push(
        `Aspect ratio mismatch: expected ${targetAspectRatio}, got ${width}x${height}`,
      );
    }

    // Check file size is reasonable
    if (output.fileSizeBytes === 0) {
      issues.push('Video file size is 0 bytes');
    } else if (output.fileSizeBytes > 500 * 1024 * 1024) {
      issues.push(
        `Video file size (${output.fileSizeBytes} bytes) exceeds 500MB`,
      );
    }

    const status = issues.length === 0 ? 'pass' : 'warn';
    if (status === 'warn') {
      this.logger.warn(`Veo output quality gate: ${issues.join(', ')}`);
    }

    return {
      gate: 'veo_output',
      status,
      issues,
      checkedAt: new Date(),
    };
  }

  /**
   * Subtitle quality gate - checks after subtitle generation
   */
  checkSubtitles(subtitles: SubtitleData): QualityReport {
    const issues: string[] = [];

    // Check all narration lines have subtitles
    if (subtitles.segments.length === 0) {
      issues.push('No subtitle segments generated');
    }

    // Check subtitle line length
    for (const segment of subtitles.segments) {
      for (const line of segment.lines) {
        if (line.length > 42) {
          issues.push(
            `Subtitle line exceeds 42 characters: "${line.substring(0, 30)}..."`,
          );
        }
      }
      if (segment.lines.length > 2) {
        issues.push(`Subtitle segment has more than 2 lines: ${segment.id}`);
      }
    }

    // Check timing coverage
    const lastSegment = subtitles.segments[subtitles.segments.length - 1];
    if (lastSegment && lastSegment.endSec < subtitles.actualDurationSec - 0.5) {
      issues.push(
        `Subtitles don't cover full video duration (end at ${lastSegment.endSec}s, video is ${subtitles.actualDurationSec}s)`,
      );
    }

    const status = issues.length === 0 ? 'pass' : 'warn';
    if (status === 'warn') {
      this.logger.warn(`Subtitle quality gate: ${issues.join(', ')}`);
    }

    return {
      gate: 'subtitles',
      status,
      issues,
      checkedAt: new Date(),
    };
  }

  /**
   * Final render quality gate - checks after Remotion render
   */
  checkFinalRender(output: FinalOutput): QualityReport {
    const issues: string[] = [];

    // Check output exists
    if (!output.videoUrl || output.videoUrl.length === 0) {
      issues.push('Video URL is missing');
    }

    // Check file size
    if (output.metadata.fileSizeBytes === 0) {
      issues.push('Output file size is 0 bytes');
    } else if (output.metadata.fileSizeBytes > 500 * 1024 * 1024) {
      issues.push(
        `Output file size (${output.metadata.fileSizeBytes} bytes) exceeds 500MB`,
      );
    }

    // Check duration
    if (output.metadata.durationSec === 0) {
      issues.push('Output duration is 0 seconds');
    }

    const status = issues.length === 0 ? 'pass' : 'warn';
    if (status === 'warn') {
      this.logger.warn(`Final render quality gate: ${issues.join(', ')}`);
    }

    return {
      gate: 'final_render',
      status,
      issues,
      checkedAt: new Date(),
    };
  }

  /**
   * Calculate overall quality score from all reports
   */
  calculateQualityScore(reports: QualityReport[]): number {
    if (reports.length === 0) return 1.0;

    let score = 1.0;
    for (const report of reports) {
      if (report.status === 'warn') {
        score -= 0.1 * report.issues.length;
      } else if (report.status === 'fail') {
        score -= 0.2 * report.issues.length;
      }
    }

    return Math.max(0, Math.min(1, score));
  }
}
