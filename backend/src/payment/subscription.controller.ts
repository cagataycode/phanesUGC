import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { BusinessOwnershipGuard } from '../auth/business-ownership.guard';
import { GetUser } from '../auth/get-user.decorator';
import { StripeService } from './stripe.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { ValidatePromoCodeDto } from './dto/validate-promo-code.dto';

@Controller('v1/subscriptions')
@UseGuards(FirebaseAuthGuard, BusinessOwnershipGuard)
export class SubscriptionController {
  constructor(private readonly stripeService: StripeService) {}

  @Post('checkout')
  async createCheckoutSession(
    @GetUser() user: { uid: string; email?: string },
    @Headers('x-business-id') businessId: string,
    @Body() dto: CreateCheckoutSessionDto,
  ) {
    if (!businessId) {
      throw new BadRequestException('x-business-id header is required');
    }

    const result = await this.stripeService.createCheckoutSession(
      user.uid,
      businessId,
      dto.tier,
      user.email,
      dto.promoCode,
      dto.successUrl,
      dto.cancelUrl,
    );

    return result;
  }

  @Post('cancel')
  async cancelSubscription(@Headers('x-business-id') businessId: string) {
    if (!businessId) {
      throw new BadRequestException('x-business-id header is required');
    }

    const result = await this.stripeService.cancelSubscription(businessId);
    return result;
  }

  @Get('portal')
  async getBillingPortal(@Headers('x-business-id') businessId: string) {
    if (!businessId) {
      throw new BadRequestException('x-business-id header is required');
    }

    const url = await this.stripeService.getBillingPortalUrl(businessId);
    return { url };
  }

  @Post('promo-codes/validate')
  async validatePromoCode(@Body() dto: ValidatePromoCodeDto) {
    const details = await this.stripeService.getPromoCodeDetails(dto.code);
    return details;
  }
}
