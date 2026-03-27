# Firebase Firestore Setup Instructions

## Step 1: Install Firebase CLI

```bash
npm install -g firebase-tools
```

## Step 2: Login to Firebase

```bash
firebase login
```

This opens a browser window. Authenticate with the Google account that owns the PhanesUGC Firebase project.

## Step 3: Initialize Firestore in the project

Navigate to the project root directory and run:

```bash
cd /path/to/your/project
firebase init firestore
```

When prompted:
- Select the existing `phanesugc` Firebase project
- Accept the default filenames: `firestore.rules` and `firestore.indexes.json`
- If files already exist, overwrite them (we will replace the content anyway)

## Step 4: Replace `firestore.indexes.json` with this content

```json
{
  "indexes": [
    {
      "collectionGroup": "projects",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "isDeleted", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "projects",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "isDeleted", "order": "ASCENDING" },
        { "fieldPath": "productId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "projects",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "isDeleted", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "projects",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "isDeleted", "order": "ASCENDING" },
        { "fieldPath": "createdBy", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "scenes",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "sceneOrder", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

## Step 5: Replace `firestore.rules` with this content

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

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

## Step 6: Deploy to Firebase

```bash
firebase deploy --only firestore
```

This deploys both the indexes and the security rules in one command.

## Step 7: Configure GCS CORS (one-time)

Create a file called `cors.json` in the project root:

```json
[
  {
    "origin": ["https://yourdomain.com", "http://localhost:3000"],
    "method": ["GET"],
    "maxAgeSeconds": 3600
  }
]
```

Then run:

```bash
gsutil cors set cors.json gs://phanesugc-assets
```

Replace `https://yourdomain.com` with your actual production domain. The `localhost:3000` entry is for local development.

## Notes

- Composite indexes take a few minutes to build. Check status in Firebase Console under Firestore > Indexes.
- If you run a query in code that needs an index you have not created, Firestore will throw an error with a direct link to create it in the console.
- No collections need to be created manually. Firestore creates them automatically when you first write a document.
