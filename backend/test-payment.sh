#!/bin/bash

# Test Stripe Payment Integration
# Make sure backend is running on localhost:3000
#
# IMPORTANT: This script requires a valid Firebase ID token
# To obtain a token:
# 1. Log in to your app in a browser
# 2. Open browser DevTools > Application > Local Storage
# 3. Find the Firebase auth token
# 4. Set it as an environment variable: export FIREBASE_TOKEN="your-token-here"
# 5. Run this script
#
# Alternatively, pass the token as the first argument: ./test-payment.sh "your-token-here"

# Get Firebase token from argument or environment variable
FIREBASE_TOKEN="${1:-$FIREBASE_TOKEN}"

if [ -z "$FIREBASE_TOKEN" ]; then
  echo "❌ Error: Firebase ID token required"
  echo ""
  echo "Usage:"
  echo "  ./test-payment.sh \"your-firebase-token\""
  echo "  OR"
  echo "  export FIREBASE_TOKEN=\"your-firebase-token\""
  echo "  ./test-payment.sh"
  echo ""
  echo "To obtain a token:"
  echo "  1. Log in to your app in a browser"
  echo "  2. Open DevTools > Application > Local Storage"
  echo "  3. Find the Firebase auth token"
  exit 1
fi

echo "🧪 Testing Stripe Payment Integration"
echo "======================================"
echo ""

# Test 1: Create Checkout Session
echo "Test 1: Create Checkout Session for Starter Tier"
echo "--------------------------------------------------"
curl -X POST http://localhost:3000/api/v1/subscriptions/checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
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
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  -H "x-business-id: test-business-123" \
  -d '{
    "code": "TESTCODE"
  }' | jq '.'

echo ""
echo ""

# Test 3: Get Billing Portal URL
echo "Test 3: Get Billing Portal URL"
echo "-------------------------------"
curl -X GET http://localhost:3000/api/v1/subscriptions/portal \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  -H "x-business-id: test-business-123" | jq '.'

echo ""
echo ""
echo "✅ Tests complete!"
