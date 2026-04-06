import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import { StripeService } from './stripe.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { ValidatePromoCodeDto } from './dto/validate-promo-code.dto';

@Controller('api/v1/subscriptions')
@UseGuards(FirebaseAuthGuard)
export class SubscriptionController {
  constructor(private readonly stripeService: StripeService) {}

  @Post('checkout')
  createCheckoutSession(
    @GetUser() user: { uid: string; email?: string },
    @Body() dto: CreateCheckoutSessionDto,
  ) {
    // TODO: Implement in Phase 3
    return {
      message: 'Checkout session creation - to be implemented',
      tier: dto.tier,
    };
  }

  @Post('cancel')
  cancelSubscription(@GetUser() user: { uid: string }) {
    // TODO: Implement in Phase 3
    return {
      message: 'Subscription cancellation - to be implemented',
      userId: user.uid,
    };
  }

  @Get('portal')
  getBillingPortal(@GetUser() user: { uid: string }) {
    // TODO: Implement in Phase 3
    return {
      message: 'Billing portal - to be implemented',
      userId: user.uid,
    };
  }

  @Post('promo-codes/validate')
  validatePromoCode(@Body() dto: ValidatePromoCodeDto) {
    // TODO: Implement in Phase 3
    return {
      message: 'Promo code validation - to be implemented',
      code: dto.code,
    };
  }
}
