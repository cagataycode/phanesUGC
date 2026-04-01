import { Injectable, Logger } from '@nestjs/common';
import { NormalizedRequest } from '../contracts/normalized-request';
import { ProductContext } from '../contracts/product-context';

/**
 * ContextAcquisitionService - Scrapes URLs and merges with manual input
 *
 * Enriches product data by scraping provided URLs
 */
@Injectable()
export class ContextAcquisitionService {
  private readonly logger = new Logger(ContextAcquisitionService.name);

  acquire(request: NormalizedRequest): Promise<ProductContext> {
    this.logger.log(`Acquiring context for job ${request.jobId}`);

    // TODO: Implement scraping logic
    // For now, return manual input only
    const context: ProductContext = {
      source: 'manual',
      name: request.product?.name || 'Unknown Product',
      description: request.product?.description || '',
      benefits: request.product?.benefits || [],
      acquiredAt: new Date(),
    };

    return Promise.resolve(context);
  }
}
