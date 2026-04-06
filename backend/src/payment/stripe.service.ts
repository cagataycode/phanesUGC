import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FirestoreService } from '../firebase/firestore.service';
import { StructuredLoggerService } from '../monitoring/structured-logger.service';
import { Env } from '../config/env';

// Stripe SDK uses CommonJS exports
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
    // Check if payments are enabled
    const paymentsEnabled =
      this.configService.get('ENABLE_PAYMENTS', { infer: true }) === 'true';

    if (!paymentsEnabled) {
      this.logger.warn(
        'Stripe service initialized but ENABLE_PAYMENTS=false - payment endpoints will return errors',
      );
      // Initialize with null/stub values when payments are disabled
      // This prevents runtime errors when accessing these properties
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      this.stripe = null as any;
      this.priceIds = {
        starter: '',
        pro: '',
        enterprise: '',
      };
      return;
    }

    // Validate required Stripe configuration
    const secretKey = this.configService.get('STRIPE_SECRET_KEY', {
      infer: true,
    });
    const webhookSecret = this.configService.get('STRIPE_WEBHOOK_SECRET', {
      infer: true,
    });
    const starterPriceId = this.configService.get('STRIPE_STARTER_PRICE_ID', {
      infer: true,
    });
    const proPriceId = this.configService.get('STRIPE_PRO_PRICE_ID', {
      infer: true,
    });
    const enterprisePriceId = this.configService.get(
      'STRIPE_ENTERPRISE_PRICE_ID',
      { infer: true },
    );
    const billingPortalUrl = this.configService.get(
      'STRIPE_BILLING_PORTAL_RETURN_URL',
      { infer: true },
    );

    if (
      !secretKey ||
      !webhookSecret ||
      !starterPriceId ||
      !proPriceId ||
      !enterprisePriceId ||
      !billingPortalUrl
    ) {
      throw new Error(
        'Missing required Stripe configuration. Ensure ENABLE_PAYMENTS=true and all STRIPE_* variables are set.',
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2024-12-18.acacia', // Latest stable API version as of 2026
      typescript: true,
    });

    // Load price IDs from config
    this.priceIds = {
      starter: starterPriceId,
      pro: proPriceId,
      enterprise: enterprisePriceId,
    };

    this.logger.log('Stripe service initialized successfully');
  }

  /**
   * Check if payments are enabled and throw clear error if not
   */
  private assertPaymentsEnabled(): void {
    const paymentsEnabled =
      this.configService.get('ENABLE_PAYMENTS', { infer: true }) === 'true';

    if (!paymentsEnabled) {
      throw new BadRequestException(
        'Payment functionality is currently disabled',
      );
    }
  }

  /**
   * Get Stripe client instance
   */
  getStripeClient(): StripeInstance {
    this.assertPaymentsEnabled();
    return this.stripe;
  }

  /**
   * Get price ID for a subscription tier
   */
  getPriceId(tier: 'starter' | 'pro' | 'enterprise'): string {
    this.assertPaymentsEnabled();
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
    this.assertPaymentsEnabled();

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
    this.assertPaymentsEnabled();

    try {
      // Validate redirect URLs to prevent open redirects
      const allowedDomains = ['app.phanes.ai', 'localhost'];
      const defaultSuccessUrl =
        'https://app.phanes.ai/settings/billing?success=true';
      const defaultCancelUrl =
        'https://app.phanes.ai/settings/billing?canceled=true';

      let validatedSuccessUrl = defaultSuccessUrl;
      let validatedCancelUrl = defaultCancelUrl;

      if (successUrl) {
        try {
          const url = new URL(successUrl);
          // Require HTTPS for non-localhost domains
          const isLocalhost =
            url.hostname === 'localhost' || url.hostname === '127.0.0.1';
          const isHttps = url.protocol === 'https:';
          const isAllowedDomain = allowedDomains.some(
            (domain) =>
              url.hostname === domain || url.hostname.endsWith(`.${domain}`),
          );

          if (isAllowedDomain && (isHttps || isLocalhost)) {
            validatedSuccessUrl = successUrl;
          } else {
            this.logger.warn(
              `Invalid success URL (domain: ${url.hostname}, protocol: ${url.protocol}), using default`,
            );
          }
        } catch {
          this.logger.warn(
            `Invalid success URL format: ${successUrl}, using default`,
          );
        }
      }

      if (cancelUrl) {
        try {
          const url = new URL(cancelUrl);
          // Require HTTPS for non-localhost domains
          const isLocalhost =
            url.hostname === 'localhost' || url.hostname === '127.0.0.1';
          const isHttps = url.protocol === 'https:';
          const isAllowedDomain = allowedDomains.some(
            (domain) =>
              url.hostname === domain || url.hostname.endsWith(`.${domain}`),
          );

          if (isAllowedDomain && (isHttps || isLocalhost)) {
            validatedCancelUrl = cancelUrl;
          } else {
            this.logger.warn(
              `Invalid cancel URL (domain: ${url.hostname}, protocol: ${url.protocol}), using default`,
            );
          }
        } catch {
          this.logger.warn(
            `Invalid cancel URL format: ${cancelUrl}, using default`,
          );
        }
      }

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
        success_url: validatedSuccessUrl,
        cancel_url: validatedCancelUrl,
        subscription_data: {
          metadata: {
            userId,
            businessId,
          },
        },
      };

      // Handle promo code - single API call for validation and ID retrieval
      if (promoCode) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const promoCodes = await this.stripe.promotionCodes.list({
          code: promoCode,
          active: true,
          limit: 1,
        });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (!promoCodes.data || promoCodes.data.length === 0) {
          throw new BadRequestException('Invalid promo code');
        }

        sessionParams.discounts = [
          {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            promotion_code: promoCodes.data[0].id,
          },
        ];
      } else {
        // Allow users to enter promo codes during checkout
        sessionParams.allow_promotion_codes = true;
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const session = await this.stripe.checkout.sessions.create(sessionParams);

      // Validate session URL (Stripe can return null in some cases)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (!session.url) {
        throw new Error('Stripe checkout session created but URL is missing');
      }

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
    this.assertPaymentsEnabled();

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
    this.assertPaymentsEnabled();

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
    this.assertPaymentsEnabled();

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
    this.assertPaymentsEnabled();

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

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const hasPercentOff = coupon.percent_off != null;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const hasAmountOff = coupon.amount_off != null;

      if (!hasPercentOff && !hasAmountOff) {
        return { valid: false };
      }

      return {
        valid: true,
        discount: {
          type: hasPercentOff ? 'percentage' : 'fixed',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
          value: hasPercentOff ? coupon.percent_off : coupon.amount_off / 100, // Convert minor units to major units
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get promo code details: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { valid: false };
    }
  }

  /**
   * Handle Stripe webhook events
   * CRITICAL: Must use raw body for signature verification
   */
  async handleWebhook(
    signature: string,
    rawBody: Buffer | string,
  ): Promise<{ received: boolean }> {
    this.assertPaymentsEnabled();

    const webhookSecret = this.configService.get('STRIPE_WEBHOOK_SECRET', {
      infer: true,
    });

    try {
      // Verify webhook signature
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      );

      // Check for duplicate events (idempotency) using event ID
      // Best practice per Stripe docs: Store event ID and check if already processed
      // This simple approach is recommended over complex locking mechanisms
      // Reference: https://stripe.com/docs/webhooks/best-practices
      // NOTE: stripe_events collection will grow over time. Implement cleanup via:
      // 1. Firestore TTL policy on receivedAt field, OR
      // 2. Scheduled Cloud Function to delete events older than 30 days
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const eventId = event.id;
      const eventRef = this.firestore
        .collection('stripe_events')
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        .doc(eventId);

      try {
        // Atomically create the event document - will fail if already exists
        await eventRef.create({
          processed: false,
          receivedAt: new Date(),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          type: event.type,
        });
      } catch (error: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (error.code === 6 || error.code === 'already-exists') {
          // Event document already exists - do not continue processing here,
          // because concurrent deliveries could otherwise process the same
          // event at the same time before `processed` is updated.
          const existingEvent = await eventRef.get();
          const existingEventData = existingEvent.data() as
            | { processed?: boolean }
            | undefined;

          if (existingEventData?.processed === true) {
            this.logger.log(`Event ${eventId as string} already processed`);
          } else {
            this.logger.log(
              `Event ${eventId as string} already claimed or pending; skipping duplicate delivery`,
            );
          }

          return { received: true };
        } else {
          throw error;
        }
      }

      // Process event based on type
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      switch (event.type) {
        case 'customer.subscription.created':
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          await this.handleSubscriptionCreated(event.data.object);
          break;
        case 'customer.subscription.updated':
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          await this.handleSubscriptionUpdated(event.data.object);
          break;
        case 'customer.subscription.deleted':
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          await this.handleSubscriptionDeleted(event.data.object);
          break;
        case 'invoice.payment_succeeded':
        case 'invoice.paid': // Alternative event type
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          this.handlePaymentSucceeded(event.data.object);
          break;
        case 'invoice.payment_failed':
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          await this.handlePaymentFailed(event.data.object);
          break;
        default:
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          this.logger.log(`Unhandled event type: ${event.type as string}`);
      }

      // Mark event as processed
      await eventRef.update({
        processed: true,
        processedAt: new Date(),
      });

      return { received: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Webhook error: ${message}`);

      // Re-throw BadRequestException (signature verification failures)
      if (error instanceof BadRequestException) {
        throw error;
      }

      // Check for signature-related errors
      const normalizedMessage = message.toLowerCase();
      if (
        normalizedMessage.includes('signature') ||
        normalizedMessage.includes('webhook')
      ) {
        throw new BadRequestException('Invalid Stripe webhook signature');
      }

      // Re-throw other errors so Stripe retries (5xx response)
      throw error;
    }
  }

  /**
   * Handle subscription.created event
   */
  private async handleSubscriptionCreated(subscription: any): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const metadata = subscription.metadata as StripeCustomerMetadata;
      const { businessId, userId } = metadata;

      // Validate required metadata
      if (!businessId || !userId) {
        this.logger.error(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          `Subscription created without required metadata. subscriptionId=${subscription.id as string}`,
        );
        return; // Skip processing - subscription created outside our flow
      }

      // Determine tier from price ID
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const priceId = subscription.items.data[0].price.id;
      const tier = this.getTierFromPriceId(priceId as string);

      // Use actual subscription status from Stripe
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const status = subscription.status;

      // Only grant access for valid states (active, trialing)
      // Other states: incomplete, incomplete_expired, past_due, canceled, unpaid
      const validStates = ['active', 'trialing'];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const shouldGrantAccess = validStates.includes(status);

      await this.firestore
        .collection('businesses')
        .doc(businessId)
        .set(
          {
            subscription: {
              tier: shouldGrantAccess ? tier : 'free',
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              status,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
              stripeSubscriptionId: subscription.id,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              stripePriceId: priceId,
              currentPeriodStart: new Date(
                subscription.current_period_start * 1000, // eslint-disable-line @typescript-eslint/no-unsafe-member-access
              ),
              currentPeriodEnd: new Date(
                subscription.current_period_end * 1000, // eslint-disable-line @typescript-eslint/no-unsafe-member-access
              ),
              cancelAtPeriodEnd: false,
            },
          },
          { merge: true },
        );

      this.structuredLogger.log('Subscription created', {
        correlationId: `stripe-sub-created-${businessId}`,
        businessId,
        tier: shouldGrantAccess ? tier : 'free',

        status,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        subscriptionId: subscription.id,
      });
    } catch (error) {
      this.logger.error(
        `Failed to handle subscription.created: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Handle subscription.updated event
   */
  private async handleSubscriptionUpdated(subscription: any): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const metadata = subscription.metadata as StripeCustomerMetadata;
      const { businessId, userId } = metadata;

      // Validate required metadata
      if (!businessId || !userId) {
        this.logger.error(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          `Subscription updated without required metadata. subscriptionId=${subscription.id as string}`,
        );
        return; // Skip processing - subscription created outside our flow
      }

      // Determine tier from price ID
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const priceId = subscription.items.data[0].price.id;
      const tier = this.getTierFromPriceId(priceId as string);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const status = subscription.status;

      await this.firestore
        .collection('businesses')
        .doc(businessId)
        .set(
          {
            subscription: {
              tier,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              status,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              stripePriceId: priceId,
              currentPeriodStart: new Date(
                subscription.current_period_start * 1000, // eslint-disable-line @typescript-eslint/no-unsafe-member-access
              ),
              currentPeriodEnd: new Date(
                subscription.current_period_end * 1000, // eslint-disable-line @typescript-eslint/no-unsafe-member-access
              ),
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
            },
          },
          { merge: true },
        );

      this.structuredLogger.log('Subscription updated', {
        correlationId: `stripe-sub-updated-${businessId}`,
        businessId,
        tier,

        status,
      });
    } catch (error) {
      this.logger.error(
        `Failed to handle subscription.updated: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Handle subscription.deleted event
   * Downgrade to Free tier (GDPR compliant - keep data)
   */
  private async handleSubscriptionDeleted(subscription: any): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const metadata = subscription.metadata as StripeCustomerMetadata;
      const { businessId, userId } = metadata;

      // Validate required metadata
      if (!businessId || !userId) {
        this.logger.error(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          `Subscription deleted without required metadata. subscriptionId=${subscription.id as string}`,
        );
        return; // Skip processing - subscription created outside our flow
      }

      // Downgrade to Free tier but keep data (GDPR compliant)
      await this.firestore
        .collection('businesses')
        .doc(businessId)
        .set(
          {
            subscription: {
              tier: 'free',
              status: 'canceled',
              canceledAt: new Date(),
            },
          },
          { merge: true },
        );

      this.structuredLogger.log('Subscription canceled - downgraded to Free', {
        correlationId: `stripe-sub-deleted-${businessId}`,
        businessId,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        subscriptionId: subscription.id,
      });
    } catch (error) {
      this.logger.error(
        `Failed to handle subscription.deleted: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Handle invoice.payment_succeeded event
   */
  private handlePaymentSucceeded(invoice: any): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const subscriptionId = invoice.subscription;

      this.structuredLogger.log('Payment succeeded', {
        correlationId: `stripe-payment-success-${subscriptionId as string}`,

        subscriptionId,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        amount: invoice.amount_paid,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        currency: invoice.currency,
      });

      // Payment succeeded - subscription should already be active
      // No action needed, just log for audit trail
    } catch (error) {
      this.logger.error(
        `Failed to handle payment.succeeded: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Handle invoice.payment_failed event
   * Immediate downgrade to Free tier (per requirements)
   */
  private async handlePaymentFailed(invoice: any): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const subscriptionId = invoice.subscription;

      // Get subscription to find businessId
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const subscription =
        await this.stripe.subscriptions.retrieve(subscriptionId); // eslint-disable-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const metadata = subscription.metadata as StripeCustomerMetadata;
      const { businessId, userId } = metadata;

      // Validate required metadata
      if (!businessId || !userId) {
        this.logger.error(
          `Payment failed for subscription without required metadata. subscriptionId=${subscriptionId as string}`,
        );
        return; // Skip processing - subscription created outside our flow
      }

      // Immediate downgrade to Free tier (per requirements)
      await this.firestore
        .collection('businesses')
        .doc(businessId)
        .set(
          {
            subscription: {
              tier: 'free',
              status: 'past_due',
              paymentFailedAt: new Date(),
            },
          },
          { merge: true },
        );

      this.structuredLogger.log('Payment failed - downgraded to Free', {
        correlationId: `stripe-payment-failed-${businessId}`,
        businessId,

        subscriptionId,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        attemptCount: invoice.attempt_count,
      });

      // TODO: Send email notification to user about payment failure
    } catch (error) {
      this.logger.error(
        `Failed to handle payment.failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Get tier from Stripe price ID
   */
  private getTierFromPriceId(
    priceId: string,
  ): 'free' | 'starter' | 'pro' | 'enterprise' {
    if (priceId === this.priceIds.starter) return 'starter';
    if (priceId === this.priceIds.pro) return 'pro';
    if (priceId === this.priceIds.enterprise) return 'enterprise';
    return 'free';
  }
}
