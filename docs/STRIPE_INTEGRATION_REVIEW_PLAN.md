# Stripe Integration Review Plan (April 2026)

This document provides a comprehensive implementation plan to review and modernize the Stripe integration according to current best practices as of April 2026.

## Executive Summary

The current Stripe integration is functional and secure, with all critical security issues addressed. This plan outlines recommended improvements to align with Stripe's latest API features, best practices, and production-readiness standards.

## Current State Assessment

### ✅ Completed Security Fixes
- StripeService initialization handles ENABLE_PAYMENTS=false gracefully
- Subscription status uses actual Stripe values (not hardcoded)
- Webhook idempotency prevents concurrent processing
- URL validation prevents open redirect vulnerabilities
- Comprehensive unit test coverage for critical paths
- Metadata validation in all webhook handlers
- Stripe configuration validation at startup

### 🎯 Areas for Improvement
1. API version management
2. Webhook event handling coverage
3. Error handling and retry logic
4. Monitoring and observability
5. Testing strategy
6. Documentation

---

## Phase 1: API Version & Feature Modernization

### 1.1 Stripe API Version Review
**Current**: `2024-12-18.acacia`
**Action**: Verify this is the latest stable version as of April 2026

```typescript
// backend/src/payment/stripe.service.ts
this.stripe = new Stripe(secretKey, {
  apiVersion: '2024-12-18.acacia', // Verify latest version
  typescript: true,
});
```

**Tasks**:
- [ ] Check Stripe changelog for breaking changes since 2024-12-18
- [ ] Review new features in latest API version
- [ ] Test integration with latest API version in staging
- [ ] Update API version if beneficial
- [ ] Document any migration steps required

### 1.2 Payment Methods Expansion
**Current**: Credit card only (via Checkout)
**Recommendation**: Consider adding alternative payment methods

**Potential additions**:
- ACH Direct Debit (US)
- SEPA Direct Debit (EU)
- Digital wallets (Apple Pay, Google Pay)
- Buy Now Pay Later (Klarna, Afterpay)

**Implementation**:
```typescript
// Add to createCheckoutSession
payment_method_types: ['card', 'us_bank_account', 'sepa_debit'],
```

**Decision criteria**:
- Target market geography
- Customer payment preferences
- Transaction fees vs. conversion rates
- Compliance requirements

### 1.3 Subscription Features
**Current**: Basic subscription management
**Recommendations**:

**A. Proration Handling**
```typescript
// When upgrading/downgrading
await this.stripe.subscriptions.update(subscriptionId, {
  items: [{ id: itemId, price: newPriceId }],
  proration_behavior: 'create_prorations', // or 'always_invoice'
});
```

**B. Trial Periods**
```typescript
// Add trial support to checkout
subscription_data: {
  trial_period_days: 14,
  trial_settings: {
    end_behavior: {
      missing_payment_method: 'cancel', // or 'pause'
    },
  },
},
```

**C. Usage-Based Billing** (if applicable)
```typescript
// For metered billing
await this.stripe.subscriptionItems.createUsageRecord(
  subscriptionItemId,
  {
    quantity: videoCount,
    timestamp: Math.floor(Date.now() / 1000),
    action: 'increment',
  }
);
```

---

## Phase 2: Webhook Event Coverage

### 2.1 Current Event Handlers
✅ Implemented:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

### 2.2 Recommended Additional Handlers

**A. Payment Intent Events** (for better payment tracking)
```typescript
case 'payment_intent.succeeded':
  await this.handlePaymentIntentSucceeded(event.data.object);
  break;
case 'payment_intent.payment_failed':
  await this.handlePaymentIntentFailed(event.data.object);
  break;
```

**B. Customer Events** (for account management)
```typescript
case 'customer.updated':
  await this.handleCustomerUpdated(event.data.object);
  break;
case 'customer.deleted':
  await this.handleCustomerDeleted(event.data.object);
  break;
```

**C. Subscription Schedule Events** (for advanced scheduling)
```typescript
case 'subscription_schedule.created':
case 'subscription_schedule.updated':
case 'subscription_schedule.canceled':
  await this.handleSubscriptionSchedule(event.data.object);
  break;
```

**D. Dispute Events** (for chargeback handling)
```typescript
case 'charge.dispute.created':
  await this.handleDisputeCreated(event.data.object);
  break;
case 'charge.dispute.closed':
  await this.handleDisputeClosed(event.data.object);
  break;
```

### 2.3 Event Versioning
```typescript
// Add event version tracking
await eventRef.create({
  processed: false,
  receivedAt: new Date(),
  type: event.type,
  apiVersion: event.api_version, // Track API version
  livemode: event.livemode, // Track test vs. live
});
```

---

## Phase 3: Error Handling & Resilience

### 3.1 Stripe Error Classification
```typescript
// Add structured error handling
private handleStripeError(error: any): never {
  if (error.type === 'StripeCardError') {
    // Card was declined
    throw new BadRequestException(error.message);
  } else if (error.type === 'StripeRateLimitError') {
    // Too many requests
    throw new ServiceUnavailableException('Rate limit exceeded');
  } else if (error.type === 'StripeInvalidRequestError') {
    // Invalid parameters
    throw new BadRequestException(error.message);
  } else if (error.type === 'StripeAPIError') {
    // Stripe API error
    throw new InternalServerErrorException('Payment service error');
  } else if (error.type === 'StripeConnectionError') {
    // Network error
    throw new ServiceUnavailableException('Payment service unavailable');
  } else if (error.type === 'StripeAuthenticationError') {
    // Authentication error
    this.logger.error('Stripe authentication failed - check API keys');
    throw new InternalServerErrorException('Payment configuration error');
  }
  throw error;
}
```

### 3.2 Retry Logic
```typescript
// Add exponential backoff for transient errors
private async retryStripeCall<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const isRetryable = 
        error.type === 'StripeConnectionError' ||
        error.type === 'StripeAPIError' ||
        error.statusCode === 429;

      if (!isRetryable || attempt === maxRetries - 1) {
        throw error;
      }

      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}
```

### 3.3 Circuit Breaker Pattern
```typescript
// Prevent cascading failures
import CircuitBreaker from 'opossum';

const circuitBreakerOptions = {
  timeout: 10000, // 10 seconds
  errorThresholdPercentage: 50,
  resetTimeout: 30000, // 30 seconds
};

this.stripeCircuitBreaker = new CircuitBreaker(
  async (operation) => operation(),
  circuitBreakerOptions
);
```

---

## Phase 4: Monitoring & Observability

### 4.1 Metrics to Track
```typescript
// Add Prometheus metrics or similar
private metrics = {
  checkoutSessionsCreated: new Counter({
    name: 'stripe_checkout_sessions_created_total',
    help: 'Total checkout sessions created',
    labelNames: ['tier'],
  }),
  webhooksReceived: new Counter({
    name: 'stripe_webhooks_received_total',
    help: 'Total webhooks received',
    labelNames: ['event_type', 'status'],
  }),
  paymentLatency: new Histogram({
    name: 'stripe_payment_latency_seconds',
    help: 'Payment operation latency',
    labelNames: ['operation'],
  }),
  subscriptionChanges: new Counter({
    name: 'stripe_subscription_changes_total',
    help: 'Subscription lifecycle events',
    labelNames: ['event', 'tier'],
  }),
};
```

### 4.2 Structured Logging Enhancements
```typescript
// Add more context to logs
this.structuredLogger.log('Stripe operation', {
  correlationId: `stripe-${operation}-${userId}`,
  operation,
  userId,
  businessId,
  tier,
  amount,
  currency,
  stripeRequestId: response.headers['request-id'], // Stripe request ID
  duration: Date.now() - startTime,
});
```

### 4.3 Alerting Rules
**Critical alerts**:
- Webhook signature verification failures > 5/min
- Payment failure rate > 10%
- Subscription cancellation rate spike (> 2x baseline)
- Stripe API errors > 1% of requests
- Webhook processing delays > 5 minutes

**Warning alerts**:
- Promo code validation failures
- Customer creation failures
- Billing portal access errors

---

## Phase 5: Testing Strategy

### 5.1 Integration Tests
```typescript
// backend/test/stripe-integration.e2e-spec.ts
describe('Stripe Integration (E2E)', () => {
  it('should complete full subscription lifecycle', async () => {
    // 1. Create checkout session
    const session = await createCheckoutSession();
    
    // 2. Simulate successful payment (Stripe test mode)
    await simulateStripeCheckout(session.id);
    
    // 3. Verify subscription created webhook
    await waitForWebhook('customer.subscription.created');
    
    // 4. Verify subscription in database
    const subscription = await getSubscription(businessId);
    expect(subscription.status).toBe('active');
    
    // 5. Cancel subscription
    await cancelSubscription(businessId);
    
    // 6. Verify cancellation webhook
    await waitForWebhook('customer.subscription.deleted');
  });
});
```

### 5.2 Webhook Testing
```typescript
// Use Stripe CLI for local webhook testing
// stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe

describe('Webhook Handlers', () => {
  it('should handle subscription.created with incomplete status', async () => {
    const event = createMockStripeEvent('customer.subscription.created', {
      status: 'incomplete',
      // ...
    });
    
    await service.handleWebhook(signature, JSON.stringify(event));
    
    // Verify no access granted
    const business = await getBusinessSubscription(businessId);
    expect(business.tier).toBe('free');
  });
});
```

### 5.3 Load Testing
```typescript
// Test webhook processing under load
describe('Webhook Performance', () => {
  it('should handle 100 concurrent webhooks', async () => {
    const webhooks = Array(100).fill(null).map((_, i) => 
      createMockWebhook(`evt_${i}`)
    );
    
    const results = await Promise.allSettled(
      webhooks.map(wh => service.handleWebhook(wh.signature, wh.body))
    );
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    expect(successful).toBe(100);
    
    // Verify no duplicate processing
    const processedEvents = await getProcessedEvents();
    expect(processedEvents.length).toBe(100);
  });
});
```

---

## Phase 6: Security Hardening

### 6.1 Webhook Signature Verification Enhancement
```typescript
// Add timestamp validation to prevent replay attacks
private verifyWebhookTimestamp(event: Stripe.Event): void {
  const eventTime = event.created * 1000;
  const now = Date.now();
  const tolerance = 5 * 60 * 1000; // 5 minutes

  if (Math.abs(now - eventTime) > tolerance) {
    throw new BadRequestException('Webhook timestamp too old');
  }
}
```

### 6.2 API Key Rotation
```typescript
// Support multiple API keys for zero-downtime rotation
private getStripeClient(version: 'primary' | 'secondary' = 'primary'): Stripe {
  const key = version === 'primary' 
    ? this.configService.get('STRIPE_SECRET_KEY')
    : this.configService.get('STRIPE_SECRET_KEY_SECONDARY');
    
  return new Stripe(key, { apiVersion: '2024-12-18.acacia' });
}
```

### 6.3 Rate Limiting
```typescript
// Add rate limiting for payment endpoints
@UseGuards(ThrottlerGuard)
@Throttle(10, 60) // 10 requests per minute
@Post('checkout')
async createCheckoutSession(...) {
  // ...
}
```

---

## Phase 7: Documentation

### 7.1 API Documentation
- Document all payment endpoints with OpenAPI/Swagger
- Include request/response examples
- Document error codes and handling
- Add authentication requirements

### 7.2 Runbooks
Create operational runbooks for:
- Webhook processing failures
- Payment disputes
- Subscription cancellations
- API key rotation
- Incident response

### 7.3 Developer Guide
- Local development setup with Stripe test mode
- Webhook testing with Stripe CLI
- Common integration patterns
- Troubleshooting guide

---

## Implementation Timeline

### Week 1-2: Assessment & Planning
- Review current Stripe API version
- Audit webhook event coverage
- Identify missing features
- Prioritize improvements

### Week 3-4: Core Improvements
- Update API version if needed
- Add missing webhook handlers
- Implement error handling improvements
- Add retry logic

### Week 5-6: Monitoring & Testing
- Implement metrics and logging
- Add integration tests
- Set up alerting
- Load testing

### Week 7-8: Security & Documentation
- Security hardening
- API key rotation support
- Complete documentation
- Runbook creation

---

## Success Metrics

### Technical Metrics
- Webhook processing success rate > 99.9%
- Payment success rate > 95%
- Average webhook processing time < 500ms
- Zero security vulnerabilities
- Test coverage > 80%

### Business Metrics
- Subscription conversion rate
- Churn rate
- Failed payment recovery rate
- Customer support tickets related to payments

---

## Maintenance Plan

### Monthly
- Review Stripe changelog for updates
- Analyze payment metrics and trends
- Review and update test cases
- Security audit

### Quarterly
- API version review and upgrade planning
- Load testing
- Disaster recovery drill
- Documentation review

### Annually
- Comprehensive security audit
- PCI compliance review (if applicable)
- Cost optimization review
- Feature roadmap planning

---

## Risk Assessment

### High Risk
- Webhook processing failures → Implement robust monitoring and alerting
- API key compromise → Implement key rotation and access controls
- Payment data exposure → Never log sensitive payment data

### Medium Risk
- API version deprecation → Stay current with Stripe updates
- Rate limiting → Implement exponential backoff
- Concurrent webhook processing → Already addressed with idempotency

### Low Risk
- Promo code abuse → Monitor usage patterns
- Test mode data in production → Strict environment separation

---

## Conclusion

The current Stripe integration is secure and functional. This plan provides a roadmap for modernization and production hardening. Prioritize improvements based on:

1. Business impact (revenue, conversion, churn)
2. Risk mitigation (security, reliability)
3. Operational efficiency (monitoring, debugging)
4. Development velocity (testing, documentation)

Implement changes incrementally, with thorough testing at each stage. Monitor metrics closely after each deployment to ensure improvements deliver expected benefits.
