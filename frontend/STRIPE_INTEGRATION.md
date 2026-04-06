# Stripe Integration

This document describes the Stripe Pricing Table integration for subscription management.

## Overview

The frontend uses **Stripe Pricing Table** - an embeddable UI component that displays subscription plans and routes users to Stripe Checkout. This is the fastest way to implement a paywall without requiring backend integration initially.

## Setup

### 1. Create a Pricing Table in Stripe Dashboard

1. Go to [Stripe Dashboard > Product catalog > Pricing Tables](https://dashboard.stripe.com/pricing-tables)
2. Click **+ Create pricing table**
3. Add your subscription products (up to 4 products with 3 prices each)
4. Customize the design (colors, fonts, buttons)
5. Configure payment settings and customer portal
6. Click **Copy code** to get the pricing table ID

### 2. Configure Environment Variables

Add these variables to your `.env.local` file:

```bash
NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID=prctbl_xxxxxxxxxxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxx
```

**Where to find these values:**
- **Pricing Table ID**: In the Stripe Dashboard pricing table URL or embed code
- **Publishable Key**: Stripe Dashboard > Developers > API Keys > Publishable key

### 3. Restart the Development Server

After adding environment variables, restart the dev server:

```bash
npm run dev
```

## Usage

### Profile Page Integration

The Stripe Pricing Table is integrated into the **Profile > Subscription & Access** section at:
```
/profile (Subscription & Access tab)
```

### Component Structure

- **`StripePricingTable`** (`/src/components/stripe-pricing-table.tsx`): Loads and renders the Stripe pricing table web component
- **`SubscriptionManagement`** (`/src/components/subscription-management.tsx`): Container component that shows subscription status and pricing table

### Features

- ✅ Displays pricing table with subscription plans
- ✅ Pre-fills user email from Firebase Auth
- ✅ Passes Firebase user ID as client reference
- ✅ Shows subscription status from platform context
- ✅ Handles script loading states
- ✅ Graceful fallback if Stripe is not configured

## User Flow

1. User navigates to **Profile > Subscription & Access**
2. Current subscription status is displayed
3. Pricing table shows available plans
4. User selects a plan → redirected to Stripe Checkout
5. After payment, Stripe sends webhook to backend (to be implemented)
6. Backend updates subscription status in Firebase/database

## Backend Integration (Future)

When backend Stripe integration is ready, you'll need to:

### 1. Install Stripe SDK

```bash
cd backend
npm install stripe
```

### 2. Create Webhook Endpoint

Handle these Stripe webhook events:
- `checkout.session.completed` - Payment successful
- `customer.subscription.created` - Subscription created
- `customer.subscription.updated` - Subscription modified
- `customer.subscription.deleted` - Subscription cancelled
- `invoice.payment_succeeded` - Recurring payment successful
- `invoice.payment_failed` - Payment failed

### 3. Update User Entitlements

After webhook receives successful payment:
```typescript
// Update Firebase user entitlements
await admin.firestore()
  .collection('users')
  .doc(userId)
  .update({
    subscription_tier: 'pro',
    entitlement_source: 'subscription',
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
  });
```

### 4. Configure Webhook in Stripe

1. Go to Stripe Dashboard > Developers > Webhooks
2. Add endpoint: `https://your-backend.com/api/stripe/webhook`
3. Select events to listen to
4. Copy webhook signing secret to backend `.env`

## Testing

### Test Mode vs Live Mode

- **Test Mode**: Use `pk_test_xxx` keys and test pricing table
- **Live Mode**: Use `pk_live_xxx` keys for production

### Test Cards

Use these test card numbers in Stripe Checkout:
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Requires Auth**: `4000 0025 0000 3155`

Any future expiry date and any 3-digit CVC works.

## Internationalization

The subscription management UI supports multiple languages:
- **English** (`en/common.json`)
- **German** (`de/common.json`)

Translation keys added:
- `manageSubscription` - "Manage subscription"
- `signInToManage` - "Sign in to manage your subscription"
- `stripeNotConfigured` - "Payment system not configured"
- `alreadySubscribed` - "You already have an active subscription..."

## Files Created

```
frontend/
├── src/
│   ├── components/
│   │   ├── stripe-pricing-table.tsx       # Stripe web component wrapper
│   │   └── subscription-management.tsx    # Subscription UI container
│   ├── types/
│   │   └── stripe.d.ts                    # TypeScript declarations
│   └── app/[locale]/profile/
│       └── page.tsx                       # Updated with SubscriptionManagement
├── .env.local                             # Add Stripe env vars here
└── .env.example.stripe                    # Example configuration
```

## Troubleshooting

### Pricing table not loading
1. Check browser console for errors
2. Verify `NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID` is set
3. Verify `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set
4. Restart dev server after adding env vars

### "Payment system not configured" message
- Environment variables are missing or empty
- Add variables to `.env.local` and restart server

### Stripe script errors
- Check Content Security Policy allows `https://js.stripe.com`
- Verify no browser extensions blocking external scripts

### User email not pre-filled
- User must be signed in with Firebase Auth
- Check `useAuth()` hook returns user object with email

## Resources

- [Stripe Pricing Table Docs](https://docs.stripe.com/payments/checkout/pricing-table)
- [Stripe Checkout Docs](https://docs.stripe.com/payments/checkout)
- [Stripe Customer Portal](https://docs.stripe.com/customer-management/activate-no-code-customer-portal)
- [Stripe Webhooks](https://docs.stripe.com/webhooks)
- [Testing Stripe](https://docs.stripe.com/testing)
