/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { FirestoreService } from '../firebase/firestore.service';
import { StructuredLoggerService } from '../monitoring/structured-logger.service';

// Mock Stripe SDK
const mockStripe = {
  webhooks: {
    constructEvent: jest.fn(),
  },
  customers: {
    create: jest.fn(),
  },
  checkout: {
    sessions: {
      create: jest.fn(),
    },
  },
  subscriptions: {
    update: jest.fn(),
    retrieve: jest.fn(),
  },
  billingPortal: {
    sessions: {
      create: jest.fn(),
    },
  },
  promotionCodes: {
    list: jest.fn(),
  },
} as unknown as ReturnType<typeof Stripe>;

jest.mock('stripe', () => {
  return jest.fn(() => mockStripe);
});

describe('StripeService', () => {
  let service: StripeService;

  const mockFirestoreDoc = {
    get: jest.fn(),
    set: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const mockFirestoreCollection = {
    doc: jest.fn(() => mockFirestoreDoc),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                ENABLE_PAYMENTS: 'true',
                STRIPE_SECRET_KEY: 'sk_test_mock_key',
                STRIPE_WEBHOOK_SECRET: 'whsec_mock_secret',
                STRIPE_STARTER_PRICE_ID: 'price_starter',
                STRIPE_PRO_PRICE_ID: 'price_pro',
                STRIPE_ENTERPRISE_PRICE_ID: 'price_enterprise',
                STRIPE_BILLING_PORTAL_RETURN_URL:
                  'https://app.phanes.ai/settings',
              };
              return config[key];
            }),
          },
        },
        {
          provide: FirestoreService,
          useValue: {
            collection: jest.fn(() => mockFirestoreCollection),
          },
        },
        {
          provide: StructuredLoggerService,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<StripeService>(StripeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize Stripe client when ENABLE_PAYMENTS=true', () => {
    const stripeClient = service.getStripeClient();
    expect(stripeClient).toBeDefined();
    expect(typeof stripeClient).toBe('object');
  });

  it('should return correct price IDs', () => {
    expect(service.getPriceId('starter')).toBe('price_starter');
    expect(service.getPriceId('pro')).toBe('price_pro');
    expect(service.getPriceId('enterprise')).toBe('price_enterprise');
  });

  describe('createCheckoutSession', () => {
    it('should validate and reject invalid redirect URLs', async () => {
      mockFirestoreDoc.get.mockResolvedValue({
        data: () => ({ subscription: { stripeCustomerId: 'cus_test' } }),
      });

      mockStripe.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test',
        url: 'https://checkout.stripe.com/test',
      });

      // Test with invalid domain
      await service.createCheckoutSession(
        'user123',
        'biz123',
        'starter',
        'test@example.com',
        undefined,
        'https://evil.com/redirect',
        undefined,
      );

      // Should use default URL instead of invalid one

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          success_url: 'https://app.phanes.ai/settings/billing?success=true',
        }),
      );
    });

    it('should allow localhost URLs with HTTP', async () => {
      mockFirestoreDoc.get.mockResolvedValue({
        data: () => ({ subscription: { stripeCustomerId: 'cus_test' } }),
      });

      mockStripe.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test',
        url: 'https://checkout.stripe.com/test',
      });

      await service.createCheckoutSession(
        'user123',
        'biz123',
        'starter',
        'test@example.com',
        undefined,
        'http://localhost:3000/success',
        undefined,
      );

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          success_url: 'http://localhost:3000/success',
        }),
      );
    });

    it('should require HTTPS for non-localhost domains', async () => {
      mockFirestoreDoc.get.mockResolvedValue({
        data: () => ({ subscription: { stripeCustomerId: 'cus_test' } }),
      });

      mockStripe.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test',
        url: 'https://checkout.stripe.com/test',
      });

      await service.createCheckoutSession(
        'user123',
        'biz123',
        'starter',
        'test@example.com',
        undefined,
        'http://app.phanes.ai/success',
        undefined,
      );

      // Should reject HTTP for non-localhost and use default

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          success_url: 'https://app.phanes.ai/settings/billing?success=true',
        }),
      );
    });

    it('should throw error when session URL is missing', async () => {
      mockFirestoreDoc.get.mockResolvedValue({
        data: () => ({ subscription: { stripeCustomerId: 'cus_test' } }),
      });

      mockStripe.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test',
        url: null, // Stripe can return null in some cases
      });

      await expect(
        service.createCheckoutSession(
          'user123',
          'biz123',
          'starter',
          'test@example.com',
        ),
      ).rejects.toThrow('Stripe checkout session created but URL is missing');
    });
  });

  describe('handleWebhook', () => {
    it('should verify webhook signature', async () => {
      const mockEvent = {
        id: 'evt_test',
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_test',
            status: 'active',
            metadata: { userId: 'user123', businessId: 'biz123' },
            items: { data: [{ price: { id: 'price_starter' } }] },
            current_period_start: 1234567890,
            current_period_end: 1234567890,
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockFirestoreDoc.create.mockResolvedValue(undefined);
      mockFirestoreDoc.update.mockResolvedValue(undefined);
      mockFirestoreDoc.set.mockResolvedValue(undefined);

      const result = await service.handleWebhook('test_signature', 'raw_body');

      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        'raw_body',
        'test_signature',
        'whsec_mock_secret',
      );
      expect(result).toEqual({ received: true });
    });

    it('should throw BadRequestException on signature verification failure', async () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      await expect(
        service.handleWebhook('invalid_signature', 'raw_body'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle duplicate events idempotently', async () => {
      const mockEvent = {
        id: 'evt_test',
        type: 'customer.subscription.created',
        data: { object: {} },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      // Simulate event already exists
      mockFirestoreDoc.create.mockRejectedValue({ code: 'already-exists' });
      mockFirestoreDoc.get.mockResolvedValue({
        data: () => ({ processed: true }),
      });

      const result = await service.handleWebhook('test_signature', 'raw_body');

      expect(result).toEqual({ received: true });
      // Should not process the event again
      expect(mockFirestoreDoc.update).not.toHaveBeenCalled();
    });

    it('should skip concurrent processing when event exists but not processed', async () => {
      const mockEvent = {
        id: 'evt_test',
        type: 'customer.subscription.created',
        data: { object: {} },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      // Simulate event exists but not processed (concurrent delivery)
      mockFirestoreDoc.create.mockRejectedValue({ code: 'already-exists' });
      mockFirestoreDoc.get.mockResolvedValue({
        data: () => ({ processed: false }),
      });

      const result = await service.handleWebhook('test_signature', 'raw_body');

      expect(result).toEqual({ received: true });
      // Should not continue processing to avoid concurrent execution
      expect(mockFirestoreDoc.update).not.toHaveBeenCalled();
    });
  });

  describe('subscription status handling', () => {
    it('should use actual subscription status from Stripe, not hardcode active', async () => {
      const mockEvent = {
        id: 'evt_test',
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_test',
            status: 'incomplete', // Not active!
            metadata: { userId: 'user123', businessId: 'biz123' },
            items: { data: [{ price: { id: 'price_starter' } }] },
            current_period_start: 1234567890,
            current_period_end: 1234567890,
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockFirestoreDoc.create.mockResolvedValue(undefined);
      mockFirestoreDoc.update.mockResolvedValue(undefined);
      mockFirestoreDoc.set.mockResolvedValue(undefined);

      await service.handleWebhook('test_signature', 'raw_body');

      // Should persist actual status and not grant access for incomplete status
      expect(mockFirestoreDoc.set).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription: expect.objectContaining({
            status: 'incomplete',
            tier: 'free', // Should not grant paid tier for incomplete status
          }),
        }),
        { merge: true },
      );
    });

    it('should grant access for active subscription', async () => {
      const mockEvent = {
        id: 'evt_test',
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_test',
            status: 'active',
            metadata: { userId: 'user123', businessId: 'biz123' },
            items: { data: [{ price: { id: 'price_starter' } }] },
            current_period_start: 1234567890,
            current_period_end: 1234567890,
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockFirestoreDoc.create.mockResolvedValue(undefined);
      mockFirestoreDoc.update.mockResolvedValue(undefined);
      mockFirestoreDoc.set.mockResolvedValue(undefined);

      await service.handleWebhook('test_signature', 'raw_body');

      expect(mockFirestoreDoc.set).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription: expect.objectContaining({
            status: 'active',
            tier: 'starter', // Should grant access
          }),
        }),
        { merge: true },
      );
    });

    it('should grant access for trialing subscription', async () => {
      const mockEvent = {
        id: 'evt_test',
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_test',
            status: 'trialing',
            metadata: { userId: 'user123', businessId: 'biz123' },
            items: { data: [{ price: { id: 'price_pro' } }] },
            current_period_start: 1234567890,
            current_period_end: 1234567890,
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockFirestoreDoc.create.mockResolvedValue(undefined);
      mockFirestoreDoc.update.mockResolvedValue(undefined);
      mockFirestoreDoc.set.mockResolvedValue(undefined);

      await service.handleWebhook('test_signature', 'raw_body');

      expect(mockFirestoreDoc.set).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription: expect.objectContaining({
            status: 'trialing',
            tier: 'pro', // Should grant access during trial
          }),
        }),
        { merge: true },
      );
    });
  });

  describe('payments disabled', () => {
    let disabledService: StripeService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          StripeService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'ENABLE_PAYMENTS') return 'false';
                return undefined;
              }),
            },
          },
          {
            provide: FirestoreService,
            useValue: {
              collection: jest.fn(() => mockFirestoreCollection),
            },
          },
          {
            provide: StructuredLoggerService,
            useValue: {
              log: jest.fn(),
              error: jest.fn(),
            },
          },
        ],
      }).compile();

      disabledService = module.get<StripeService>(StripeService);
    });

    it('should throw clear error when payments are disabled', () => {
      expect(() => disabledService.getStripeClient()).toThrow(
        BadRequestException,
      );
      expect(() => disabledService.getStripeClient()).toThrow(
        'Payment functionality is currently disabled',
      );
    });

    it('should throw error for all payment methods when disabled', async () => {
      await expect(
        disabledService.createCheckoutSession('user123', 'biz123', 'starter'),
      ).rejects.toThrow('Payment functionality is currently disabled');

      await expect(
        disabledService.cancelSubscription('biz123'),
      ).rejects.toThrow('Payment functionality is currently disabled');

      await expect(
        disabledService.getBillingPortalUrl('biz123'),
      ).rejects.toThrow('Payment functionality is currently disabled');
    });
  });
});
