#!/bin/bash

# Test Stripe Payment Integration
# Make sure backend is running on localhost:3000
#
# IMPORTANT: This script requires a valid Firebase ID token and Business ID
# To obtain a token:
# 1. Log in to your app in a browser
# 2. Open browser DevTools > Application > Local Storage
# 3. Find the Firebase auth token
# 4. Set it as an environment variable: export FIREBASE_TOKEN="your-token-here"
# 5. Set your business ID: export BUSINESS_ID="your-business-id"
# 6. Run this script
#
# Alternatively, pass the token and business ID as arguments:
# ./test-payment.sh "your-token-here" "your-business-id"

# Get Firebase token from argument or environment variable
FIREBASE_TOKEN="${1:-$FIREBASE_TOKEN}"
BUSINESS_ID="${2:-$BUSINESS_ID}"

if [ -z "$FIREBASE_TOKEN" ]; then
  echo "❌ Error: Firebase ID token required"
  echo ""
  echo "Usage:"
  echo "  ./test-payment.sh \"your-firebase-token\" \"your-business-id\""
  echo "  OR"
  echo "  export FIREBASE_TOKEN=\"your-firebase-token\""
  echo "  export BUSINESS_ID=\"your-business-id\""
  echo "  ./test-payment.sh"
  echo ""
  echo "To obtain a token:"
  echo "  1. Log in to your app in a browser"
  echo "  2. Open DevTools > Application > Local Storage"
  echo "  3. Find the Firebase auth token"
  exit 1
fi

if [ -z "$BUSINESS_ID" ]; then
  echo "❌ Error: Business ID required"
  echo ""
  echo "Usage:"
  echo "  ./test-payment.sh \"your-firebase-token\" \"your-business-id\""
  echo "  OR"
  echo "  export FIREBASE_TOKEN=\"your-firebase-token\""
  echo "  export BUSINESS_ID=\"your-business-id\""
  echo "  ./test-payment.sh"
  echo ""
  echo "The Business ID must be a business that the authenticated user owns or is a member of."
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
  -H "x-business-id: $BUSINESS_ID" \
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
  -H "x-business-id: $BUSINESS_ID" \
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
  -H "x-business-id: $BUSINESS_ID" | jq '.'

echo ""
echo ""
echo "✅ Tests complete!"
