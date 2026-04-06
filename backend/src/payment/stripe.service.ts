import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FirestoreService } from '../firebase/firestore.service';
import { StructuredLoggerService } from '../monitoring/structured-logger.service';
import { Env } from '../config/env';

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const Stripe = require('stripe');

type StripeInstance = ReturnType<typeof Stripe>;

interface StripeCustomerMetadata {
  userId: string;
  businessId: string;
}

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: StripeInstance;
  private readonly priceIds: {
    starter: string;
    pro: string;
    enterprise: string;
  };

  constructor(
    private readonly configService: ConfigService<Env, true>,
    private readonly firestore: FirestoreService,
    private readonly structuredLogger: StructuredLoggerService,
  ) {
    const secretKey = this.configService.get('STRIPE_SECRET_KEY', {
      infer: true,
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2024-12-18.acacia', // Latest stable API version as of 2026
      typescript: true,
    });

    // Load price IDs from config
    this.priceIds = {
      starter: this.configService.get('STRIPE_STARTER_PRICE_ID', {
        infer: true,
      }),
      pro: this.configService.get('STRIPE_PRO_PRICE_ID', { infer: true }),
      enterprise: this.configService.get('STRIPE_ENTERPRISE_PRICE_ID', {
        infer: true,
      }),
    };

    this.logger.log('Stripe service initialized');
  }

  /**
   * Get Stripe client instance
   */
  getStripeClient(): StripeInstance {
    return this.stripe;
  }

  /**
   * Get price ID for a subscription tier
   */
  getPriceId(tier: 'starter' | 'pro' | 'enterprise'): string {
    return this.priceIds[tier];
  }

  /**
   * Get or create Stripe customer for a user
   * Best practice: Create customer on first subscription, not on registration
   */
  async getOrCreateCustomer(
    userId: string,
    businessId: string,
    email?: string,
  ): Promise<string> {
    try {
      // Check if customer already exists in Firestore
      const businessDoc = await this.firestore
        .collection('businesses')
        .doc(businessId)
        .get();

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const existingCustomerId =
        businessDoc.data()?.subscription?.stripeCustomerId; // eslint-disable-line @typescript-eslint/no-unsafe-member-access

      if (existingCustomerId) {
        this.structuredLogger.log('Using existing Stripe customer', {
          correlationId: `stripe-customer-${userId}`,
          userId,
          businessId,

          customerId: existingCustomerId,
        });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return existingCustomerId;
      }

      // Create new customer
      const customer = await this.createCustomer(userId, businessId, email);

      this.structuredLogger.log('Created new Stripe customer', {
        correlationId: `stripe-customer-${userId}`,
        userId,
        businessId,
        customerId: customer,
      });

      return customer;
    } catch (error) {
      this.logger.error(
        `Failed to get or create customer: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Create a new Stripe customer
   */
  async createCustomer(
    userId: string,
    businessId: string,
    email?: string,
  ): Promise<string> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const customer = await this.stripe.customers.create({
        email,
        metadata: {
          userId,
          businessId,
        } as StripeCustomerMetadata,
      });

      // Store customer ID in Firestore
      await this.firestore
        .collection('businesses')
        .doc(businessId)
        .set(
          {
            subscription: {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
              stripeCustomerId: customer.id,
            },
          },
          { merge: true },
        );

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
      return customer.id;
    } catch (error) {
      this.logger.error(
        `Failed to create Stripe customer: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Create a Stripe Checkout Session for subscription
   */
  async createCheckoutSession(
    userId: string,
    businessId: string,
    tier: 'starter' | 'pro' | 'enterprise',
    email?: string,
    promoCode?: string,
    successUrl?: string,
    cancelUrl?: string,
  ): Promise<{ sessionId: string; url: string }> {
    try {
      const customerId = await this.getOrCreateCustomer(
        userId,
        businessId,
        email,
      );
      const priceId = this.getPriceId(tier);

      const sessionParams: {
        customer: string;
        mode: string;
        line_items: Array<{ price: string; quantity: number }>;
        success_url: string;
        cancel_url: string;
        allow_promotion_codes?: boolean;
        discounts?: Array<{ promotion_code: string }>;
        subscription_data: {
          metadata: StripeCustomerMetadata;
        };
      } = {
        customer: customerId,
        mode: 'subscription',
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url:
          successUrl || 'https://app.phanes.ai/settings/billing?success=true',
        cancel_url:
          cancelUrl || 'https://app.phanes.ai/settings/billing?canceled=true',
        subscription_data: {
          metadata: {
            userId,
            businessId,
          },
        },
      };

      // Handle promo code
      if (promoCode) {
        // Validate promo code first
        const isValid = await this.validatePromoCode(promoCode);
        if (!isValid) {
          throw new BadRequestException('Invalid promo code');
        }

        // Get promotion code ID from Stripe
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const promoCodes = await this.stripe.promotionCodes.list({
          code: promoCode,
          active: true,
          limit: 1,
        });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (promoCodes.data && promoCodes.data.length > 0) {
          sessionParams.discounts = [
            {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
              promotion_code: promoCodes.data[0].id,
            },
          ];
        }
      } else {
        // Allow users to enter promo codes during checkout
        sessionParams.allow_promotion_codes = true;
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const session = await this.stripe.checkout.sessions.create(sessionParams);

      this.structuredLogger.log('Created Stripe checkout session', {
        correlationId: `stripe-checkout-${userId}`,
        userId,
        businessId,
        tier,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        sessionId: session.id,
      });

      return {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        sessionId: session.id,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        url: session.url,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create checkout session: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Cancel a subscription (at period end)
   */
  async cancelSubscription(businessId: string): Promise<{
    success: boolean;
    endsAt: Date;
  }> {
    try {
      // Get subscription ID from Firestore
      const businessDoc = await this.firestore
        .collection('businesses')
        .doc(businessId)
        .get();

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const subscriptionId =
        businessDoc.data()?.subscription?.stripeSubscriptionId; // eslint-disable-line @typescript-eslint/no-unsafe-member-access

      if (!subscriptionId) {
        throw new BadRequestException('No active subscription found');
      }

      // Cancel at period end (GDPR compliant - user keeps access until paid period ends)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const subscription = await this.stripe.subscriptions.update(
        subscriptionId,
        {
          cancel_at_period_end: true,
        },
      );

      // Update Firestore
      await this.firestore
        .collection('businesses')
        .doc(businessId)
        .set(
          {
            subscription: {
              cancelAtPeriodEnd: true,

              currentPeriodEnd: new Date(
                subscription.current_period_end * 1000, // eslint-disable-line @typescript-eslint/no-unsafe-member-access
              ),
            },
          },
          { merge: true },
        );

      this.structuredLogger.log('Canceled subscription at period end', {
        correlationId: `stripe-cancel-${businessId}`,
        businessId,

        subscriptionId,
      });

      return {
        success: true,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        endsAt: new Date(subscription.current_period_end * 1000),
      };
    } catch (error) {
      this.logger.error(
        `Failed to cancel subscription: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Get Stripe Billing Portal URL
   */
  async getBillingPortalUrl(businessId: string): Promise<string> {
    try {
      // Get customer ID from Firestore
      const businessDoc = await this.firestore
        .collection('businesses')
        .doc(businessId)
        .get();

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const customerId = businessDoc.data()?.subscription?.stripeCustomerId;

      if (!customerId) {
        throw new BadRequestException('No Stripe customer found');
      }

      const returnUrl = this.configService.get(
        'STRIPE_BILLING_PORTAL_RETURN_URL',
        { infer: true },
      );

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const session = await this.stripe.billingPortal.sessions.create({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        customer: customerId,
        return_url: returnUrl,
      });

      this.structuredLogger.log('Generated billing portal URL', {
        correlationId: `stripe-portal-${businessId}`,
        businessId,

        customerId,
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
      return session.url;
    } catch (error) {
      this.logger.error(
        `Failed to get billing portal URL: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Validate a promo code
   */
  async validatePromoCode(code: string): Promise<boolean> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const promoCodes = await this.stripe.promotionCodes.list({
        code,
        active: true,
        limit: 1,
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
      return promoCodes.data && promoCodes.data.length > 0;
    } catch (error) {
      this.logger.error(
        `Failed to validate promo code: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * Get promo code details
   */
  async getPromoCodeDetails(code: string): Promise<{
    valid: boolean;
    discount?: {
      type: 'percentage' | 'fixed';
      value: number;
    };
  }> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const promoCodes = await this.stripe.promotionCodes.list({
        code,
        active: true,
        limit: 1,
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (!promoCodes.data || promoCodes.data.length === 0) {
        return { valid: false };
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const promoCode = promoCodes.data[0];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const coupon = promoCode.coupon;

      return {
        valid: true,
        discount: {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          type: coupon.percent_off ? 'percentage' : 'fixed',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
          value: coupon.percent_off || coupon.amount_off / 100, // Convert cents to euros
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get promo code details: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { valid: false };
    }
  }
}
