# Deployment Guide

## Prerequisites

1. **Firebase CLI installed**:
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. **Google Cloud SDK installed**:
   ```bash
   # macOS
   brew install google-cloud-sdk
   
   # Login
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

3. **Environment variables configured**:
   - Create `.env.production` file with production credentials
   - Ensure all secrets are in Google Secret Manager

## Step 1: Run Tests

```bash
cd backend

# Run unit tests
npm test

# Run e2e tests (use test:e2e script, not npm test)
npm run test:e2e -- security.e2e-spec

# Run load tests
npm run test:e2e -- load.e2e-spec

# Run integration tests
npm run test:e2e -- integration.e2e-spec

# Run all e2e tests
npm run test:e2e

# Run lint
npm run lint

# Build
npm run build
```

**✅ All tests must pass before proceeding!**

## Step 2: Deploy Firestore Security Rules

```bash
# Review the rules
cat backend/firebase/firestore.rules

# Deploy to staging first (run from backend/firebase/ directory)
cd backend/firebase
firebase use staging
firebase deploy --only firestore:rules

# Test in staging
# ... run smoke tests ...

# Deploy to production
firebase use production
firebase deploy --only firestore:rules
cd ../..
```

**Verify rules are active**:
- Go to Firebase Console → Firestore Database → Rules
- Check the timestamp shows recent deployment
- Test a few operations manually

## Step 3: Deploy Backend Code

### Option A: Google App Engine

```bash
# Navigate to backend directory
cd backend

# Build the application
npm run build

# Deploy to staging
gcloud app deploy app.staging.yaml --project=YOUR_PROJECT_ID

# Run smoke tests on staging
curl https://staging-dot-YOUR_PROJECT_ID.appspot.com/

# If successful, deploy to production
gcloud app deploy app.yaml --project=YOUR_PROJECT_ID
```

### Option B: Cloud Run

```bash
# Navigate to backend directory
cd backend

# Build Docker image
docker build -t gcr.io/YOUR_PROJECT_ID/backend:latest .

# Push to Container Registry
docker push gcr.io/YOUR_PROJECT_ID/backend:latest

# Deploy to Cloud Run (staging)
gcloud run deploy backend-staging \
  --image gcr.io/YOUR_PROJECT_ID/backend:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated

# Test staging
curl https://backend-staging-xxx.run.app/

# Deploy to production
gcloud run deploy backend-production \
  --image gcr.io/YOUR_PROJECT_ID/backend:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

## Step 4: Verify Deployment

### Health Checks

```bash
# Check root endpoint (basic connectivity)
curl https://YOUR_DOMAIN/

# Expected response:
# "Hello World!" (from AppController)

# Note: Dedicated /health and /ready endpoints will be added in Phase 7
```

### Security Verification

```bash
# Test IDOR protection (should fail)
curl -X GET "https://YOUR_DOMAIN/ads?businessId=OTHER_BUSINESS_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected: 403 Forbidden

# Test rate limiting (make 11 requests quickly)
for i in {1..11}; do
  curl -X GET "https://YOUR_DOMAIN/ads?businessId=YOUR_BUSINESS_ID" \
    -H "Authorization: Bearer YOUR_TOKEN"
done

# Expected: 11th request returns 429 Too Many Requests

# Test input validation (invalid format in body)
curl -X POST "https://YOUR_DOMAIN/ads" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-business-id: YOUR_VALID_BUSINESS_ID" \
  -H "Content-Type: application/json" \
  -d '{"businessId":"","productId":"prod-123","createdBy":"user-123","prompt_inputs":{"prompt":"test","platform":"tiktok","language":"en"},"veo_config":{"aspect_ratio":"9:16","duration_sec":8}}'

# Expected: 400 Bad Request (empty businessId in body)
# Note: Guards run before ValidationPipe, so x-business-id header must be valid for auth
```

### Functional Tests

```bash
# Create a job
curl -X POST "https://YOUR_DOMAIN/ads" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-business-id: YOUR_BUSINESS_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "businessId": "YOUR_BUSINESS_ID",
    "productId": "YOUR_PRODUCT_ID",
    "createdBy": "YOUR_USER_ID",
    "prompt_inputs": {
      "prompt": "Create a video about...",
      "platform": "tiktok",
      "language": "en"
    },
    "veo_config": {
      "aspect_ratio": "9:16",
      "duration_sec": 5
    }
  }'

# Check job status
curl -X GET "https://YOUR_DOMAIN/ads/JOB_ID?businessId=YOUR_BUSINESS_ID" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-business-id: YOUR_BUSINESS_ID"

# Note: GET /quota endpoint will be added in Phase 4 (Payment Integration)
```

## Step 5: Monitor for 24 Hours

### Set up monitoring dashboards

1. **Go to Google Cloud Console → Monitoring**

2. **Create dashboards for**:
   - Request rate and latency
   - Error rates (4xx, 5xx)
   - Quota usage
   - Cost tracking
   - Rate limit hits

3. **Set up alerts**:
   ```bash
   # Example: Alert on high error rate
   gcloud alpha monitoring policies create \
     --notification-channels=YOUR_CHANNEL_ID \
     --display-name="High Error Rate" \
     --condition-display-name="Error rate > 5%" \
     --condition-threshold-value=0.05 \
     --condition-threshold-duration=300s
   ```

### Check logs regularly

```bash
# View recent logs
gcloud logging read "resource.type=gae_app" --limit 50 --format json

# Filter for errors
gcloud logging read "resource.type=gae_app AND severity>=ERROR" --limit 50

# Check specific patterns
gcloud logging read "resource.type=gae_app AND textPayload:quota_exceeded" --limit 20
```

### Monitor key metrics

- **Error Rate**: Should be < 1%
- **Latency**: p95 < 2s, p99 < 5s
- **Quota Accuracy**: No over-allocation
- **Rate Limit Effectiveness**: Blocking excessive requests
- **Cost Tracking**: All API calls logged

## Step 6: Rollback Procedure (if needed)

### Rollback Firestore Rules

```bash
# List previous versions
firebase firestore:rules:list

# Rollback to previous version
firebase firestore:rules:release RULESET_ID
```

### Rollback Backend Code

#### App Engine:
```bash
# List versions
gcloud app versions list

# Route traffic to previous version
gcloud app services set-traffic default --splits=PREVIOUS_VERSION=1
```

#### Cloud Run:
```bash
# List revisions
gcloud run revisions list --service=backend-production

# Route traffic to previous revision
gcloud run services update-traffic backend-production \
  --to-revisions=PREVIOUS_REVISION=100
```

## Troubleshooting

### Issue: High error rate after deployment

1. Check logs for specific errors:
   ```bash
   gcloud logging read "severity>=ERROR" --limit 100
   ```

2. Check if it's a specific endpoint:
   ```bash
   gcloud logging read "httpRequest.status>=500" --limit 50
   ```

3. Consider rollback if error rate > 5%

### Issue: Quota not incrementing

1. Check Firestore transactions:
   ```bash
   gcloud logging read "textPayload:runTransaction" --limit 20
   ```

2. Verify atomic operations are working
3. Check for transaction conflicts

### Issue: Rate limiting not working

1. Check rate limit collection in Firestore
2. Verify cleanup function is running
3. Check interceptor is applied to controllers

### Issue: IDOR protection failing

1. Verify BusinessOwnershipGuard is applied
2. Check Firebase Auth tokens are valid
3. Verify business membership data in Firestore

## Post-Deployment Checklist

- [ ] All tests passing
- [ ] Firestore rules deployed
- [ ] Backend code deployed
- [ ] Health checks passing
- [ ] Security tests verified
- [ ] Functional tests passing
- [ ] Monitoring dashboards created
- [ ] Alerts configured
- [ ] 24-hour monitoring started
- [ ] Team notified of deployment
- [ ] Rollback procedure documented
- [ ] On-call rotation updated

## Emergency Contacts

- **On-Call Engineer**: [Contact Info]
- **DevOps Lead**: [Contact Info]
- **Product Owner**: [Contact Info]

## Useful Commands

```bash
# Quick health check (basic connectivity)
curl https://YOUR_DOMAIN/

# View real-time logs
gcloud logging tail "resource.type=gae_app"

# Check current traffic split
gcloud app services describe default

# List all deployments
gcloud app versions list

# Check Firestore rules version
firebase firestore:rules:list
```
