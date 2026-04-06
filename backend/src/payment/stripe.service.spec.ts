import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StripeService } from './stripe.service';
import { FirestoreService } from '../firebase/firestore.service';
import { StructuredLoggerService } from '../monitoring/structured-logger.service';

describe('StripeService', () => {
  let service: StripeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
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
            collection: jest.fn(),
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

  it('should initialize Stripe client', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const stripeClient = service.getStripeClient();
    expect(stripeClient).toBeDefined();
    expect(typeof stripeClient).toBe('object');
  });

  it('should return correct price IDs', () => {
    expect(service.getPriceId('starter')).toBe('price_starter');
    expect(service.getPriceId('pro')).toBe('price_pro');
    expect(service.getPriceId('enterprise')).toBe('price_enterprise');
  });
});
