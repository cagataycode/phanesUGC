# Logging Issues - Development Environment

## Issue: Cloud Logging Authentication Errors

### Symptoms
```
[Nest] ERROR [StructuredLoggerService] Failed to write to Cloud Logging: 2 UNKNOWN: Getting metadata from plugin failed with error: {"error":"invalid_grant","error_description":"reauth related error (invalid_rapt)","error_uri":"https://support.google.com/a/answer/9368756","error_subtype":"invalid_rapt"}
```

### Root Cause
Google Cloud credentials in the local development environment need reauthentication. This is a common issue when using Application Default Credentials (ADC) that have expired or require additional verification.

### Impact
- **Development**: Logs are still written to console (stdout), so debugging is not affected
- **Production**: No impact - production uses service account credentials that don't expire

### Solution

#### Option 1: Reauthenticate with gcloud (Recommended for Development)
```bash
# Reauthenticate
gcloud auth application-default login

# Verify authentication
gcloud auth application-default print-access-token
```

#### Option 2: Disable Cloud Logging in Development
Add to your `.env.local`:
```
ENABLE_STRUCTURED_LOGGING=false
```

This will disable Cloud Logging writes while keeping console logging active.

#### Option 3: Use Service Account (Production-like Setup)
```bash
# Download service account key from GCP Console
# Set environment variable
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
```

### Verification
After applying the fix, you should no longer see the authentication errors. Logs will be written to both console and Cloud Logging.

## AWS Bedrock Model ID - Verified Correct

### Current Configuration
```
BEDROCK_MODEL_ID=us.anthropic.claude-sonnet-4-6
```

### Verification (March 2026)
According to [AWS Bedrock documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-sonnet-4-6.html):

- **Model**: Claude Sonnet 4.6
- **Launch Date**: February 17, 2026
- **Status**: Active
- **Geo Inference ID (US)**: `us.anthropic.claude-sonnet-4-6` ✅
- **Standard Model ID**: `anthropic.claude-sonnet-4-6`
- **Context Window**: 1M tokens
- **Max Output**: 64K tokens

The current configuration is correct. The logs show successful API calls:
```
[Nest] LOG [StructuredLoggerService] {"message":"API call: bedrock-claude.generate-content (9726ms) - success","context":{"service":"bedrock-claude","modelId":"us.anthropic.claude-sonnet-4-6","responseLength":974,"stopReason":"end_turn"}}
```

### Alternative Model IDs (if needed)
- **EU Region**: `eu.anthropic.claude-sonnet-4-6`
- **AU Region**: `au.anthropic.claude-sonnet-4-6`
- **Global**: `global.anthropic.claude-sonnet-4-6`
- **Standard (single region)**: `anthropic.claude-sonnet-4-6`

## Other Warnings (Non-Critical)

### Invalid Subscription Tier
```
[Nest] WARN [QuotaService] Invalid tier "undefined" for business i4WwKSnHZeKHh9vqj3lx, defaulting to FREE
```

**Cause**: Business document in Firestore doesn't have a `subscription.tier` field.

**Fix**: Ensure business documents have the subscription structure:
```typescript
{
  subscription: {
    tier: 'free' | 'starter' | 'pro' | 'enterprise'
  }
}
```

### EventEmitter Memory Leak Warning
```
(node:52647) MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 error listeners added to [PassThrough].
```

**Cause**: Multiple error handlers attached to the same stream during GCS download.

**Impact**: Low - this is a warning, not an error. The operation completes successfully.

**Future Fix**: Consider using `stream.setMaxListeners(15)` in the GCS download code.

## Summary

✅ **System is working correctly** - Video generation completed successfully  
⚠️ **Cloud Logging auth issue** - Local development only, doesn't affect functionality  
✅ **Bedrock model ID is correct** - Using latest Claude Sonnet 4.6 (Feb 2026)  
⚠️ **Minor warnings** - Subscription tier and stream listeners (non-blocking)
