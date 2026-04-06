import { Controller, Post, Headers } from '@nestjs/common';
import { StripeService } from './stripe.service';

@Controller('api/v1/webhooks/stripe')
export class WebhookController {
  constructor(private readonly stripeService: StripeService) {}

  @Post()
  handleWebhook() {
    // TODO: Implement in Phase 4
    // Parameters will be used when implementing webhook signature verification
    return {
      received: true,
      message: 'Webhook handling - to be implemented',
    };
  }
}
