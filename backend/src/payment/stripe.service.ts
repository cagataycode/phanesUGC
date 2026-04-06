import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Stripe = require('stripe');

type StripeInstance = ReturnType<typeof Stripe>;

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: StripeInstance;

  constructor(private readonly configService: ConfigService<Env, true>) {
    const secretKey = this.configService.get('STRIPE_SECRET_KEY', {
      infer: true,
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2024-12-18.acacia', // Latest stable API version as of 2026
      typescript: true,
    });

    this.logger.log('Stripe service initialized');
  }

  /**
   * Get Stripe client instance
   */
  getStripeClient(): StripeInstance {
    return this.stripe;
  }
}
