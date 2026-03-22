# Phanes UGC - Backend

This is the NestJS backend for the Prompt-to-Ad Video Generator MVP.

## Architecture

The backend follows the PRD specifications with the following components:

- **API Layer**: NestJS REST API with endpoints for ad creation, status checking, and result retrieval
- **Database**: Cloud Firebase (Firestore) for data persistence
- **AI Services**: 
  - Gemini 2.5 Pro for LLM tasks (brief generation, script generation, scene planning)
  - Veo 3 for video and audio generation
  - Imagen 4 for image generation
- **Storage**: Google Cloud Storage (EU region)
- **Queue**: Cloud Tasks / Pub/Sub for async job processing
- **Rendering**: Remotion on Cloud Run

## Project Structure

```
backend/
├── src/
│   ├── ads/               # Ad management module
│   │   ├── ads.controller.ts  # REST endpoints
│   │   ├── ads.service.ts     # Business logic
│   │   ├── ads.module.ts     # Module definition
│   │   └── dto/              # Data transfer objects
│   │       ├── create-ad.dto.ts
│   │       └── ad-response.dto.ts
│   ├── ai/                 # AI services
│   │   ├── llm.service.ts    # Gemini 2.5 Pro integration
│   │   ├── veo.service.ts   # Veo 3 integration
│   │   ├── imagen.service.ts # Imagen 4 integration
│   │   └── ai.module.ts
│   ├── storage/            # Cloud Storage service
│   │   ├── storage.service.ts
│   │   └── storage.module.ts
│   ├── pipeline/          # Async job processing
│   │   ├── pipeline.service.ts
│   │   └── pipeline.module.ts
│   ├── config/            # Configuration
│   │   └── firebase.config.ts
│   ├── auth/              # Authentication
│   │   └── firebase-auth.guard.ts
│   ├── app.module.ts
│   └── main.ts
├── .env.example
├── package.json
└── tsconfig.json
```

## API Endpoints

### POST /api/v1/ads
Create a new ad generation job.

**Request Body:**
```json
{
  "prompt": "Create a 30 second TikTok ad for...",
  "platform": "tiktok",
  "aspect_ratio": "9:16",
  "duration_sec": 30,
  "language": "en",
  "tone": "direct",
  "cta": "Learn more",
  "product_info": {
    "name": "Product Name",
    "description": "Description",
    "benefits": ["benefit1", "benefit2"]
  }
}
```

**Response:**
```json
{
  "id": "ad_abc123",
  "status": "queued"
}
```

### GET /api/v1/ads/:id
Get ad job status and progress.

**Response:**
```json
{
  "id": "ad_abc123",
  "status": "processing",
  "progress": 45,
  "stages": {
    "scrape": "done",
    "brief": "done",
    "script": "done",
    "assets": "running",
    "voice": "pending",
    "subtitles": "pending",
    "render": "pending"
  }
}
```

### GET /api/v1/ads/:id/result
Get completed ad result (only available when status is "completed").

### POST /api/v1/ads/:id/scenes/:sceneId/regenerate
Regenerate a specific scene.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

3. Configure Firebase credentials:
   - Create a Firebase project
   - Enable Firestore and Storage
   - Download service account key
   - Set environment variables

4. Run the development server:
```bash
npm run start:dev
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| FIREBASE_PROJECT_ID | Firebase project ID |
| FIREBASE_PRIVATE_KEY | Firebase service account private key |
| FIREBASE_CLIENT_EMAIL | Firebase service account email |
| GCS_BUCKET_NAME | Google Cloud Storage bucket name |
| GCS_LOCATION | Storage location (e.g., EU) |
| GEMINI_API_KEY | Google Gemini API key |
| REMOTION_RENDER_URL | Remotion Cloud Run URL |
| PORT | Server port (default: 3000) |

## Pipeline Stages

The ad generation pipeline runs through these stages:

1. **scrape** - Product URL scraping (optional)
2. **brief** - Creative brief generation via Gemini
3. **script** - Script generation via Gemini
4. **assets** - Visual asset generation via Veo/Imagen
5. **voice** - Voiceover generation via Veo 3
6. **subtitles** - Subtitle generation and sync
7. **render** - Final video rendering via Remotion

## Mock Mode

The backend runs in mock mode when API keys are not configured. Mock services return placeholder data for development.

## Notes

- All external services (Gemini, Veo, Imagen) have mock fallbacks
- The pipeline is designed to be async via Cloud Tasks/Pub/Sub
- Currently runs synchronously for MVP simplicity
