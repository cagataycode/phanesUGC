# Cloud Functions

This directory contains Cloud Functions for backend production readiness features.

## Functions

### Scheduled Functions

#### resetMonthlyQuotas
- **Schedule**: `0 0 1 * *` (At 00:00 on day-of-month 1)
- **Purpose**: Resets monthly video quotas for all businesses
- **Note**: The actual reset happens automatically via month-based keys in Firestore. This function logs the reset event for tracking.

#### cleanupRateLimits
- **Schedule**: `0 * * * *` (At minute 0 of every hour)
- **Purpose**: Cleans up stale rate limit entries older than 1 hour
- **Impact**: Reduces Firestore storage costs and improves query performance

## Development

### Prerequisites
- Node.js 18+
- Firebase CLI: `npm install -g firebase-tools`
- Firebase project configured

### Setup
```bash
cd functions
npm install
```

### Build
```bash
npm run build
```

### Test Locally
```bash
npm run serve
```

### Deploy
```bash
# Deploy all functions
npm run deploy

# Deploy specific function
firebase deploy --only functions:resetMonthlyQuotas
firebase deploy --only functions:cleanupRateLimits
```

### View Logs
```bash
npm run logs
```

## Scheduling

The functions are automatically scheduled using Cloud Scheduler when deployed. You can also manually configure schedules in the Firebase Console:

1. Go to Firebase Console > Functions
2. Select the function
3. View the trigger configuration
4. Modify schedule if needed

## Monitoring

Monitor function execution in:
- Firebase Console > Functions > Logs
- Google Cloud Console > Cloud Functions
- Cloud Logging for detailed logs

## Cost Optimization

These functions are designed to be cost-effective:
- Run on minimal schedule (monthly/hourly)
- Use batch operations for efficiency
- Clean up unnecessary data to reduce storage costs
