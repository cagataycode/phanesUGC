#!/bin/bash

# Test Stripe Payment Integration
# Make sure backend is running on localhost:3000

echo "🧪 Testing Stripe Payment Integration"
echo "======================================"
echo ""

# Test 1: Create Checkout Session
echo "Test 1: Create Checkout Session for Starter Tier"
echo "--------------------------------------------------"
curl -X POST http://localhost:3000/api/v1/subscriptions/checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -H "x-business-id: test-business-123" \
  -d '{
    "tier": "starter",
    "successUrl": "http://localhost:3000/success",
    "cancelUrl": "http://localhost:3000/cancel"
  }' | jq '.'

echo ""
echo ""

# Test 2: Validate Promo Code
echo "Test 2: Validate Promo Code"
echo "----------------------------"
curl -X POST http://localhost:3000/api/v1/subscriptions/promo-codes/validate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{
    "code": "TESTCODE"
  }' | jq '.'

echo ""
echo ""

# Test 3: Get Billing Portal URL
echo "Test 3: Get Billing Portal URL"
echo "-------------------------------"
curl -X GET http://localhost:3000/api/v1/subscriptions/portal \
  -H "Authorization: Bearer test-token" \
  -H "x-business-id: test-business-123" | jq '.'

echo ""
echo ""
echo "✅ Tests complete!"
