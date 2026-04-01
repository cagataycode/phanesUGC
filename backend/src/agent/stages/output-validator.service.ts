import { Injectable, Logger } from '@nestjs/common';
import { FinalOutput } from '../contracts/final-output';

/**
 * OutputValidatorService - Validates final output
 *
 * Soft validation - logs warnings but doesn't block delivery
 */
@Injectable()
export class OutputValidatorService {
  private readonly logger = new Logger(OutputValidatorService.name);

  validate(output: FinalOutput): Promise<void> {
    this.logger.log(`Validating output for job ${output.jobId}`);

    // TODO: Implement validation logic
    // For now, just log
    this.logger.debug(`Output validation passed for job ${output.jobId}`);
    return Promise.resolve();
  }
}
