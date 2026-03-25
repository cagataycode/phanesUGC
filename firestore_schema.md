# PhanesUGC — Firestore Database Schema

**Version:** 1.0
**Date:** 2026-03-25
**Status:** MVP Schema Design

---

## Architecture Overview

```
users/{uid}
businesses/{bizId}
businesses/{bizId}/members/{uid}
businesses/{bizId}/products/{productId}
businesses/{bizId}/projects/{projectId}
businesses/{bizId}/projects/{projectId}/scenes/{sceneId}
```

### Design Decisions Applied

- **Subcollection hierarchy** under businesses (Option A)
- **Pipeline state** stored directly on the project document
- **No version history** — latest-only for briefs and scripts
- **Inline storageKey fields** — no separate artifacts collection
- **Soft deletes** — `deletedAt` timestamp on all primary entities
- **Many-to-many** user ↔ business via `members` subcollection
- **Two-tier subscriptions** — user-level (individual) and business-level (enterprise)

---

## 1. `users/{uid}`

Minimal user document. Firebase Auth handles authentication. No personal data beyond what's needed for the app to function.

| Field | Type | Required | Description |
|---|---|---|---|
| `uid` | `string` | yes | Firebase Auth UID (matches document ID) |
| `email` | `string` | yes | User email (from Firebase Auth, for display/lookup) |
| `displayName` | `string` | no | Optional display name |
| `subscription` | `map` | no | User-level subscription (for individual plans) |
| `subscription.tier` | `string` | yes | `free` \| `pro` |
| `subscription.status` | `string` | yes | `active` \| `canceled` \| `past_due` \| `trialing` |
| `subscription.currentPeriodStart` | `timestamp` | no | Billing period start |
| `subscription.currentPeriodEnd` | `timestamp` | no | Billing period end |
| `subscription.stripeCustomerId` | `string` | no | Stripe customer reference |
| `subscription.stripeSubscriptionId` | `string` | no | Stripe subscription reference |
| `defaultBusinessId` | `string` | no | Last-used business context |
| `createdAt` | `timestamp` | yes | Account creation |
| `updatedAt` | `timestamp` | yes | Last update |
| `deletedAt` | `timestamp` | no | Soft delete marker |

### Notes
- User-level subscription covers individuals who don't have an enterprise business.
- If a user belongs to a business with an enterprise subscription, the business subscription takes precedence.
- No usage counters here — usage is tracked at the business level.

---

## 2. `businesses/{bizId}`

A business (organization/brand) that owns products and projects.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | yes | Auto-generated document ID |
| `name` | `string` | yes | Business/brand name |
| `subscription` | `map` | no | Business-level enterprise subscription |
| `subscription.tier` | `string` | yes | `free` \| `pro` \| `enterprise` |
| `subscription.status` | `string` | yes | `active` \| `canceled` \| `past_due` \| `trialing` |
| `subscription.currentPeriodStart` | `timestamp` | no | Billing period start |
| `subscription.currentPeriodEnd` | `timestamp` | no | Billing period end |
| `subscription.stripeCustomerId` | `string` | no | Stripe customer reference |
| `subscription.stripeSubscriptionId` | `string` | no | Stripe subscription reference |
| `subscription.seats` | `number` | no | Max allowed members (enterprise) |
| `usage` | `map` | yes | Usage tracking |
| `usage.adsGeneratedThisMonth` | `number` | yes | Counter reset monthly |
| `usage.adsGeneratedTotal` | `number` | yes | Lifetime counter |
| `usage.currentPeriodStart` | `timestamp` | yes | When the current usage period started |
| `brandKit` | `map` | no | Business-level brand defaults |
| `brandKit.logoStorageKey` | `string` | no | GCS path to logo |
| `brandKit.colors` | `array<string>` | no | Brand hex colors |
| `brandKit.fonts` | `array<string>` | no | Brand font names |
| `defaults` | `map` | no | Default ad parameters |
| `defaults.tone` | `string` | no | Default tone |
| `defaults.language` | `string` | no | Default language |
| `defaults.targetAudience` | `string` | no | Default audience |
| `ownerId` | `string` | yes | UID of the user who created the business |
| `createdAt` | `timestamp` | yes | Creation timestamp |
| `updatedAt` | `timestamp` | yes | Last update |
| `deletedAt` | `timestamp` | no | Soft delete marker |

---

## 3. `businesses/{bizId}/members/{uid}`

Many-to-many relationship between users and businesses. Document ID = user UID.

| Field | Type | Required | Description |
|---|---|---|---|
| `uid` | `string` | yes | User UID (matches document ID) |
| `email` | `string` | yes | Denormalized for display |
| `role` | `string` | yes | `owner` \| `admin` \| `member` |
| `joinedAt` | `timestamp` | yes | When user joined this business |

### Notes
- `owner` = full control including billing and deletion.
- `admin` = manage products, projects, members.
- `member` = create and view projects only.
- For MVP, role-based access can be enforced via Firestore security rules.

---

## 4. `businesses/{bizId}/products/{productId}`

A product/service the business wants to advertise.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | yes | Auto-generated document ID |
| `businessId` | `string` | yes | Parent business reference |
| `name` | `string` | yes | Product name |
| `description` | `string` | no | Product description |
| `benefits` | `array<string>` | no | Key product benefits |
| `urls` | `array<string>` | no | Product page URLs |
| `brandAssets` | `array<map>` | no | Uploaded brand/product assets |
| `brandAssets[].storageKey` | `string` | yes | GCS path |
| `brandAssets[].type` | `string` | yes | `image` \| `video` \| `logo` |
| `brandAssets[].filename` | `string` | yes | Original filename |
| `defaults` | `map` | no | Product-specific ad defaults |
| `defaults.tone` | `string` | no | Default tone for this product |
| `defaults.targetAudience` | `string` | no | Default audience |
| `defaults.language` | `string` | no | Default language |
| `defaults.cta` | `string` | no | Default CTA |
| `createdAt` | `timestamp` | yes | Creation timestamp |
| `updatedAt` | `timestamp` | yes | Last update |
| `deletedAt` | `timestamp` | no | Soft delete marker |

---

## 5. `businesses/{bizId}/projects/{projectId}`

A single ad generation job. This is the core document — replaces the current flat `ads` collection.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | yes | Auto-generated document ID |
| `businessId` | `string` | yes | Parent business reference |
| `productId` | `string` | yes | Reference to the product being advertised |
| `createdBy` | `string` | yes | UID of the user who initiated |
| **— Input Parameters —** | | | |
| `prompt` | `string` | yes | User's original prompt |
| `platform` | `string` | yes | `tiktok` \| `instagram_reels` \| `youtube_shorts` |
| `aspectRatio` | `string` | yes | `9:16` \| `1:1` |
| `durationSec` | `number` | yes | Requested duration in seconds |
| `language` | `string` | yes | Language code (e.g., `en`) |
| `tone` | `string` | no | `direct` \| `playful` \| `professional` \| etc. |
| `targetAudience` | `string` | no | Target audience description |
| `cta` | `string` | no | Call-to-action text |
| `subtitleStyle` | `string` | no | `standard` \| `kinetic` \| `karaoke` |
| `voiceId` | `string` | no | Voice selection for generation |
| **— Scrape Result —** | | | |
| `scrapeResult` | `map` | no | Populated if URLs were scraped |
| `scrapeResult.sourceUrl` | `string` | yes | URL that was scraped |
| `scrapeResult.status` | `string` | yes | `success` \| `failed` \| `skipped` |
| `scrapeResult.extractedData` | `map` | no | Normalized extracted product data |
| `scrapeResult.extractedData.productName` | `string` | no | |
| `scrapeResult.extractedData.tagline` | `string` | no | |
| `scrapeResult.extractedData.description` | `string` | no | |
| `scrapeResult.extractedData.benefits` | `array<string>` | no | |
| `scrapeResult.extractedData.pricing` | `string` | no | |
| `scrapeResult.extractedData.reviews` | `array<string>` | no | |
| `scrapeResult.extractedData.mediaUrls` | `array<string>` | no | |
| `scrapeResult.extractedData.ctaText` | `string` | no | |
| `scrapeResult.extractedData.brandColors` | `array<string>` | no | |
| **— Creative Brief —** | | | |
| `creativeBrief` | `map` | no | Generated creative brief |
| `creativeBrief.productName` | `string` | yes | |
| `creativeBrief.offer` | `string` | yes | |
| `creativeBrief.audience` | `string` | yes | |
| `creativeBrief.painPoints` | `array<string>` | no | |
| `creativeBrief.benefits` | `array<string>` | no | |
| `creativeBrief.tone` | `string` | yes | |
| `creativeBrief.language` | `string` | yes | |
| `creativeBrief.durationSec` | `number` | yes | |
| `creativeBrief.platform` | `string` | yes | |
| `creativeBrief.cta` | `string` | no | |
| `creativeBrief.visualStyle` | `string` | no | |
| `creativeBrief.aspectRatio` | `string` | yes | |
| **— Script —** | | | |
| `script` | `map` | no | Generated ad script |
| `script.title` | `string` | yes | |
| `script.hook` | `string` | yes | |
| `script.voiceoverLines` | `array<map>` | yes | |
| `script.voiceoverLines[].scene` | `number` | yes | Scene number |
| `script.voiceoverLines[].text` | `string` | yes | Narration text |
| `script.cta` | `string` | yes | |
| **— Pipeline State —** | | | |
| `status` | `string` | yes | `created` \| `processing` \| `completed` \| `failed` |
| `progress` | `number` | yes | 0–100 percentage |
| `stages` | `map` | yes | Per-stage status tracking |
| `stages.scrape` | `string` | no | `pending` \| `running` \| `done` \| `failed` \| `skipped` |
| `stages.brief` | `string` | no | `pending` \| `running` \| `done` \| `failed` |
| `stages.script` | `string` | no | `pending` \| `running` \| `done` \| `failed` |
| `stages.scenes` | `string` | no | `pending` \| `running` \| `done` \| `failed` |
| `stages.assets` | `string` | no | `pending` \| `running` \| `done` \| `failed` |
| `stages.audio` | `string` | no | `pending` \| `running` \| `done` \| `failed` |
| `stages.subtitles` | `string` | no | `pending` \| `running` \| `done` \| `failed` |
| `stages.render` | `string` | no | `pending` \| `running` \| `done` \| `failed` |
| `failedStage` | `string` | no | Which stage failed (if status = `failed`) |
| `errorMessage` | `string` | no | Error details for debugging |
| **— Output —** | | | |
| `output` | `map` | no | Final rendered output (populated on completion) |
| `output.videoStorageKey` | `string` | yes | GCS path to final MP4 |
| `output.thumbnailStorageKey` | `string` | no | GCS path to thumbnail |
| **— Audio Track —** | | | |
| `audioTrack` | `map` | no | Extracted/generated audio |
| `audioTrack.storageKey` | `string` | yes | GCS path to audio file |
| `audioTrack.format` | `string` | yes | `wav` \| `mp3` |
| `audioTrack.sampleRateHz` | `number` | no | e.g., 16000 |
| `audioTrack.channels` | `number` | no | e.g., 1 |
| **— Subtitles —** | | | |
| `subtitleSegments` | `array<map>` | no | Chunked subtitle segments with word-level timing |
| `subtitleSegments[].start` | `number` | yes | Segment start time (seconds) |
| `subtitleSegments[].end` | `number` | yes | Segment end time (seconds) |
| `subtitleSegments[].text` | `string` | yes | Display text for this segment |
| `subtitleSegments[].words` | `array<map>` | yes | Per-word timing for highlighting |
| `subtitleSegments[].words[].word` | `string` | yes | Individual word |
| `subtitleSegments[].words[].start` | `number` | yes | Word start time (seconds) |
| `subtitleSegments[].words[].end` | `number` | yes | Word end time (seconds) |
| **— Timestamps —** | | | |
| `createdAt` | `timestamp` | yes | Creation timestamp |
| `updatedAt` | `timestamp` | yes | Last update |
| `deletedAt` | `timestamp` | no | Soft delete marker |

### Notes on Project Document
- `subtitleSegments` holds the chunked, phrase-aware segments (not raw per-word dumps). Each segment contains its own `words` array for karaoke/per-word highlighting during Remotion rendering.
- `audioTrack` stores the GCS path to extracted audio. The backend generates signed URLs on-demand.
- `output.videoStorageKey` and `output.thumbnailStorageKey` store GCS paths, never signed URLs (which expire).
- The `script.voiceoverLines` array maps 1:1 with scenes by scene number.

---

## 6. `businesses/{bizId}/projects/{projectId}/scenes/{sceneId}`

Individual scene instructions — the planned inputs that get sent to Veo 3.1 for video generation.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | yes | Auto-generated document ID |
| `projectId` | `string` | yes | Parent project reference |
| `sceneOrder` | `number` | yes | Scene sequence number (1-based) |
| `durationSec` | `number` | yes | Planned duration for this scene |
| **— Visual Instructions —** | | | |
| `visualType` | `string` | yes | `ai_video` \| `ai_image` \| `uploaded` |
| `visualPrompt` | `string` | no | Prompt sent to Veo / Imagen |
| `cameraMotion` | `string` | no | e.g., `slow_push_in`, `static`, `handheld` |
| `overlayText` | `string` | no | On-screen text overlay |
| `transitionIn` | `string` | no | `cut` \| `fade` \| `slide` |
| `transitionOut` | `string` | no | `cut` \| `fade` \| `slide` |
| **— Generated Asset —** | | | |
| `assetStorageKey` | `string` | no | GCS path to generated/uploaded scene asset |
| `assetType` | `string` | no | `video` \| `image` |
| `generationStatus` | `string` | yes | `pending` \| `generating` \| `completed` \| `failed` |
| `generationError` | `string` | no | Error message if generation failed |
| **— Timestamps —** | | | |
| `createdAt` | `timestamp` | yes | Creation timestamp |
| `updatedAt` | `timestamp` | yes | Last update |

### Notes on Scenes
- Scenes are the **input instructions** to Veo 3.1. Once Veo returns a result, `assetStorageKey` is populated with the GCS path.
- `sceneOrder` is used for sequencing during composition. Use integers (1, 2, 3...) for easy reordering.
- `generationStatus` allows individual scene retry/regeneration without affecting sibling scenes.
- No `deletedAt` on scenes — if a project is soft-deleted, its scenes are implicitly deleted.

---

## Collection Hierarchy Diagram

```
users/
  └── {uid}                          # Minimal user profile + individual subscription

businesses/
  └── {bizId}                        # Business profile + enterprise subscription + usage
        ├── members/
        │     └── {uid}              # User ↔ Business membership + role
        ├── products/
        │     └── {productId}        # Product catalog entry + defaults + brand assets
        └── projects/
              └── {projectId}        # Full ad generation job (input → pipeline → output)
                    └── scenes/
                          └── {sceneId}  # Individual scene instruction + generated asset
```

---

## Subscription Resolution Logic

```
function getEffectivePlan(user, business):
    if business.subscription.tier == "enterprise" AND business.subscription.status == "active":
        return business.subscription    // enterprise plan takes precedence
    if user.subscription.tier == "pro" AND user.subscription.status == "active":
        return user.subscription        // user's individual pro plan
    return { tier: "free" }             // default free tier
```

### Subscription Tiers

| Tier | Level | Description |
|---|---|---|
| `free` | User or Business | Limited ads/month, watermarked output |
| `pro` | User | Individual paid plan, higher limits |
| `enterprise` | Business | Team plan with seats, highest limits, brand kit |

---

## Migration Path from Current `ads` Collection

The existing `ads` collection maps to the new schema as follows:

| Current `ads` field | New location |
|---|---|
| `id` | `projects/{projectId}.id` |
| `user_id` | `projects/{projectId}.createdBy` |
| `prompt` | `projects/{projectId}.prompt` |
| `platform`, `aspect_ratio`, `duration_sec`, `language`, `tone`, `cta` | `projects/{projectId}.*` (top-level input params) |
| `product_info` | `products/{productId}.*` (separate product doc) |
| `urls` | `products/{productId}.urls` |
| `voice_id` | `projects/{projectId}.voiceId` |
| `subtitle_style` | `projects/{projectId}.subtitleStyle` |
| `creative_brief` | `projects/{projectId}.creativeBrief` |
| `script` | `projects/{projectId}.script` |
| `scenes[]` | `projects/{projectId}/scenes/{sceneId}` (subcollection) |
| `audio_track.audio_url` | `projects/{projectId}.audioTrack.storageKey` |
| `audio_track.segments` | `projects/{projectId}.subtitleSegments` |
| `subtitles[]` | `projects/{projectId}.subtitleSegments` (merged with audio segments) |
| `video_url` | `projects/{projectId}.output.videoStorageKey` |
| `thumbnail_url` | `projects/{projectId}.output.thumbnailStorageKey` |
| `status`, `progress`, `stages` | `projects/{projectId}.status`, `.progress`, `.stages` |
| `created_at`, `updated_at` | `projects/{projectId}.createdAt`, `.updatedAt` |

### Key Migration Notes
1. **Store GCS paths, not signed URLs.** Current `ads` stores full signed URLs with expiring signatures. New schema stores GCS paths (e.g., `generated_assets/videos/veo_video_1.mp4`). Backend generates signed URLs on-demand.
2. **Scenes move to subcollection.** Current `scenes[]` array becomes individual documents in `projects/{projectId}/scenes/{sceneId}`.
3. **`audio_track.segments` and `subtitles` merge.** Current schema has both `audio_track.segments` (with word-level timing) and a flat `subtitles` array. New schema unifies these into `subtitleSegments` with nested `words[]` for per-word highlighting.
4. **Product data gets extracted.** Current `product_info` map becomes a standalone product document. Projects reference the product by ID.

---

## Firestore Security Rules (Skeleton)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can only read/write their own user doc
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    // Business access: must be a member
    match /businesses/{bizId} {
      allow read: if isMember(bizId);
      allow write: if isOwnerOrAdmin(bizId);

      match /members/{uid} {
        allow read: if isMember(bizId);
        allow write: if isOwnerOrAdmin(bizId);
      }

      match /products/{productId} {
        allow read: if isMember(bizId);
        allow write: if isMember(bizId);
      }

      match /projects/{projectId} {
        allow read: if isMember(bizId);
        allow create: if isMember(bizId);
        allow update: if isMember(bizId);

        match /scenes/{sceneId} {
          allow read: if isMember(bizId);
          allow write: if isMember(bizId);
        }
      }
    }

    function isMember(bizId) {
      return request.auth != null &&
        exists(/databases/$(database)/documents/businesses/$(bizId)/members/$(request.auth.uid));
    }

    function isOwnerOrAdmin(bizId) {
      return request.auth != null &&
        get(/databases/$(database)/documents/businesses/$(bizId)/members/$(request.auth.uid)).data.role in ['owner', 'admin'];
    }
  }
}
```

---

## Indexes Required

| Collection | Fields | Query Use Case |
|---|---|---|
| `businesses/{bizId}/projects` | `productId`, `createdAt` DESC | List projects for a product |
| `businesses/{bizId}/projects` | `status`, `createdAt` DESC | List active/failed projects |
| `businesses/{bizId}/projects` | `createdBy`, `createdAt` DESC | List projects by user |
| `businesses/{bizId}/projects` | `deletedAt`, `createdAt` DESC | Filter out soft-deleted |
| `businesses/{bizId}/projects/{projectId}/scenes` | `sceneOrder` ASC | Ordered scene list |

---

## GCS Storage Key Conventions

```
businesses/{bizId}/projects/{projectId}/scenes/{sceneId}/video.mp4
businesses/{bizId}/projects/{projectId}/scenes/{sceneId}/image.jpg
businesses/{bizId}/projects/{projectId}/audio/extracted.wav
businesses/{bizId}/projects/{projectId}/output/final.mp4
businesses/{bizId}/projects/{projectId}/output/thumbnail.jpg
businesses/{bizId}/products/{productId}/assets/{filename}
businesses/{bizId}/brand/logo.png
```

This convention mirrors the Firestore hierarchy, making it easy to:
- Apply GCS lifecycle rules per business
- Cascade-delete storage when a project is purged
- Scope IAM/signed URL access by path prefix
