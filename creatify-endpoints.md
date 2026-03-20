# Creatify API Endpoints

> Complete API documentation based on Creatify.ai reverse engineering
> Endpoint specifications for Phanesugc MVP implementation

---

## Base URL

```
https://api.phanesugc.com/api/
```

---

## Authentication

All API requests require authentication headers:

```http
X-API-ID: your-api-id
X-API-KEY: your-api-key
```

### Authentication Flow

1. User subscribes to a plan (Starter/Pro/Enterprise)
2. System generates `X-API-ID` and `X-API-KEY`
3. User retrieves keys from dashboard
4. User includes headers in all API requests

### Error Responses

```json
{
  "error": "Unauthorized",
  "message": "Missing or invalid API credentials",
  "code": 401
}
```

---

## Common Response Format

All endpoint responses follow this structure:

```json
{
  "id": "uuid",
  "created_at": "2026-03-20T18:00:00Z",
  "updated_at": "2026-03-20T18:00:00Z",
  "status": "pending|generating|done|failed",
  "credits_used": 5,
  "progress": 0.5,
  "failed_reason": null,
  "video_output": "https://s3.../output.mp4",
  "thumbnail_url": "https://.../thumb.jpg",
  "webhook_url": "https://example.com/webhook"
}
```

---

## Job Status States

| State | Description |
|--------|-------------|
| `pending` | Job created, waiting in queue |
| `queued` | Job queued for processing |
| `generating` | Currently processing (script, assets, render) |
| `done` | Successfully completed |
| `failed` | Error occurred, check `failed_reason` |

---

## Rate Limiting

- **100 requests per minute** per API key
- **Burst limit:** 200 requests per 5 minutes

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1710900000
```

---

## Endpoints

### 1. Workspace & Credits

#### Get Remaining Credits
```http
GET /api/remaining_credits/
```

**Response:**
```json
{
  "remaining_credits": 450.0
}
```

**Cost:** 0 credits

---

### 2. URL to Video (Core MVP)

#### 2.1 Create Link
```http
POST /api/links/
Content-Type: application/json
```

**Request:**
```json
{
  "url": "https://example.com/product"
}
```

**Response:**
```json
{
  "id": "link-uuid",
  "url": "https://example.com/product",
  "link": {
    "id": "scraped-uuid",
    "url": "https://example.com/product",
    "title": "Product Title",
    "description": "Product description extracted from page",
    "image_urls": [
      "https://example.com/img1.jpg",
      "https://example.com/img2.jpg"
    ],
    "video_urls": [],
    "reviews": [
      "Great product!",
      "Highly recommended"
    ],
    "ai_summary": "AI-generated summary of the product",
    "ai_target_audiences": [
      "Eco-conscious consumers",
      "Young professionals"
    ]
  },
  "credits_used": 1
}
```

**Cost:** 1 credit

---

#### 2.2 Update Link
```http
PUT /api/links/{id}/
Content-Type: application/json
```

**Request:**
```json
{
  "title": "Custom Product Name",
  "description": "Enhanced description",
  "image_urls": [
    "https://custom-image.com/product.jpg"
  ],
  "logo_url": "https://brand.com/logo.png"
}
```

**Cost:** 0 credits

---

#### 2.3 Create Video from Link
```http
POST /api/link_to_videos/
Content-Type: application/json
```

**Request:**
```json
{
  "link": "link-uuid",
  "visual_style": "DynamicProductTemplate",
  "script_style": "DontWorryWriter",
  "aspect_ratio": "9x16",
  "video_length": 30,
  "language": "en",
  "target_audience": "Marketing professionals",
  "target_platform": "TikTok",
  "model_version": "aurora_v1_fast",
  "no_background_music": false,
  "no_caption": false,
  "no_cta": false,
  "no_stock_broll": false,
  "webhook_url": "https://example.com/webhook"
}
```

**Supported Options:**

| Parameter | Values |
|-----------|---------|
| `visual_style` | DynamicProductTemplate, Minimalist, Bold, Cinematic |
| `script_style` | DontWorryWriter, Professional, Casual, Enthusiastic |
| `aspect_ratio` | 9x16, 16x9, 1x1 |
| `video_length` | 15, 30, 45, 60 |
| `language` | en, es, fr, de, tr, it, pt |
| `target_platform` | TikTok, Instagram, YouTube, LinkedIn |
| `model_version` | aurora_v1, aurora_v1_fast |

**Response:**
```json
{
  "id": "video-uuid",
  "status": "pending",
  "credits_used": 0,
  "progress": 0,
  "webhook_url": "https://example.com/webhook"
}
```

**Cost:** 4-5 credits per 30 seconds

---

#### 2.4 Get Video Status
```http
GET /api/link_to_videos/{id}/
```

**Response:**
```json
{
  "id": "video-uuid",
  "status": "done",
  "credits_used": 5,
  "progress": 1.0,
  "video_output": "https://s3.../output.mp4",
  "thumbnail_url": "https://.../thumb.jpg",
  "preview": "https://app.phanesugc.com/preview?layout=..."
}
```

**Cost:** 0 credits

---

#### 2.5 Generate Preview
```http
POST /api/link_to_videos/{id}/preview/
Content-Type: application/json
```

**Cost:** 1 credit per 30 seconds

---

#### 2.6 Render Final Video
```http
POST /api/link_to_videos/{id}/render/
Content-Type: application/json
```

**Cost:** 4 credits per 30 seconds

---

### 3. AI Avatar (Phase 2)

#### 3.1 List Personas
```http
GET /api/personas/
```

**Query Params:**
- `page`: Pagination (default: 1)
- `limit`: Items per page (default: 50)
- `gender`: Filter by `male|female`

**Response:**
```json
[
  {
    "id": "persona-uuid",
    "name": "Sarah Johnson",
    "gender": "female",
    "thumbnail": "https://.../thumb.jpg",
    "preview_url": "https://.../preview.mp4",
    "is_custom": false,
    "language": "en"
  }
]
```

---

#### 3.2 List Voices
```http
GET /api/voices/
```

**Response:**
```json
[
  {
    "name": "Fatima",
    "gender": "female",
    "accents": [
      {
        "id": "accent-uuid",
        "accent_name": "American English",
        "language": "en",
        "preview_url": "https://.../preview.mp3"
      }
    ]
  }
]
```

---

#### 3.3 Create Avatar Video
```http
POST /api/lipsyncs/
Content-Type: application/json
```

**Request:**
```json
{
  "avatar_id": "persona-uuid",
  "voice_id": "accent-uuid",
  "input_text": "Welcome to Phanesugc!",
  "background_image_url": "https://.../bg.jpg",
  "aspect_ratio": "9x16",
  "video_length": 30,
  "webhook_url": "https://example.com/webhook"
}
```

**Response:**
```json
{
  "id": "avatar-uuid",
  "status": "pending",
  "credits_used": 0,
  "progress": 0
}
```

**Cost:** 5 credits per 30 seconds

---

#### 3.4 Get Avatar Status
```http
GET /api/lipsyncs/{id}/
```

---

### 4. AI Avatar v2 - Multi-Scene (Phase 2)

#### 4.1 Create Multi-Scene Video
```http
POST /api/lipsyncs_v2/
Content-Type: application/json
```

**Request:**
```json
{
  "video_inputs": [
    {
      "character": {
        "type": "avatar",
        "avatar_id": "persona-uuid",
        "avatar_style": "normal",
        "offset": {
          "x": -0.23,
          "y": 0.35
        },
        "scale": 1.0,
        "hidden": false
      },
      "voice": {
        "type": "text",
        "input_text": "Scene 1 text here",
        "voice_id": "accent-uuid",
        "volume": 0.8
      },
      "background": {
        "type": "image",
        "url": "https://.../bg1.jpg",
        "fit": "crop",
        "effect": null
      },
      "caption_setting": {
        "style": "normal-black",
        "offset": {
          "x": 0,
          "y": 0.45
        },
        "font_family": "Montserrat",
        "font_size": 70
      }
    }
  ],
  "aspect_ratio": "9x16",
  "model_version": "aurora_v1_fast",
  "webhook_url": "https://example.com/webhook"
}
```

**Cost:** 5 credits per 30 seconds × number of scenes

---

### 5. Text to Speech (MVP)

#### 5.1 Generate Speech
```http
POST /api/text_to_speech/
Content-Type: application/json
```

**Request:**
```json
{
  "script": "Welcome to Phanesugc AI!",
  "accent": "accent-uuid",
  "webhook_url": "https://example.com/webhook"
}
```

**Cost:** 1 credit per 30 seconds

**Response:**
```json
{
  "id": "tts-uuid",
  "status": "pending",
  "script": "Welcome to Phanesugc AI!",
  "accent": "accent-uuid"
  "media_job": "media-job-uuid",
  "progress": 0
}
```

---

#### 5.2 Get TTS Status
```http
GET /api/text_to_speech/{id}/
```

**Response:**
```json
{
  "id": "tts-uuid",
  "status": "done",
  "script": "Welcome to Phanesugc AI!",
  "output": "https://s3.../audio.mp3"
  "progress": 1.0
}
```

---

### 6. Aurora Avatar (Ultra-Realistic)

#### 6.1 Create Aurora Video
```http
POST /api/aurora/
Content-Type: application/json
```

**Request:**
```json
{
  "image": "https://example.com/person.jpg",
  "audio": "https://example.com/speech.mp3",
  "model_version": "aurora_v1_fast",
  "webhook_url": "https://example.com/webhook"
}
```

**Cost:** 10 credits per 15 seconds (fast) or 20 credits (standard)

**Response:**
```json
{
  "id": "aurora-uuid",
  "status": "pending",
  "credits_used": 0,
  "progress": 0
}
```

---

#### 6.2 Get Aurora Status
```http
GET /api/aurora/{id}/
```

---

### 7. Product to Video (Phase 2+)

#### 7.1 Generate Product Video
```http
POST /api/product_to_videos/gen_image/
Content-Type: application/json
```

**Request:**
```json
{
  "product_url": "https://example.com/product.jpg",
  "aspect_ratio": "16x9",
  "webhook_url": "https://example.com/webhook"
}
```

**Cost:** 1 credit (preview image)

**Response:**
```json
{
  "id": "product-uuid",
  "status": "initializing",
  "generated_photo_url": "https://s3.../preview.jpg",
  "credits_used": 1
}
```

---

#### 7.2 Generate Video from Preview
```http
POST /api/product_to_videos/{id}/gen_video/
Content-Type: application/json
```

**Cost:** 3 credits (video generation)

---

---

## Error Codes

| Code | Description |
|-------|-------------|
| 200 | Success |
| 201 | Resource Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (missing/invalid credentials) |
| 403 | Forbidden (insufficient credits) |
| 404 | Resource Not Found |
| 429 | Rate Limited |
| 500 | Internal Server Error |

---

## Webhook Format

All endpoints support optional `webhook_url`. When a job completes, POST request is sent:

```json
{
  "id": "job-uuid",
  "status": "done",
  "failed_reason": "",
  "video_output": "https://s3.../output.mp4",
  "credits_used": 5,
  "created_at": "2026-03-20T18:00:00Z"
}
```

---

## SDK Examples

### Python

```python
import requests

class PhanesugcAPI:
    BASE_URL = "https://api.phanesugc.com/api/"
    
    def __init__(self, api_id, api_key):
        self.api_id = api_id
        self.api_key = api_key
        self.headers = {
            "X-API-ID": api_id,
            "X-API-KEY": api_key
        }
    
    def create_link(self, url):
        response = requests.post(
            f"{self.BASE_URL}links/",
            headers=self.headers,
            json={"url": url}
        )
        return response.json()
    
    def create_video_from_link(self, link_id, **kwargs):
        response = requests.post(
            f"{self.BASE_URL}link_to_videos/",
            headers=self.headers,
            json={"link": link_id, **kwargs}
        )
        return response.json()
    
    def get_video_status(self, video_id):
        response = requests.get(
            f"{self.BASE_URL}link_to_videos/{video_id}/",
            headers=self.headers
        )
        return response.json()
    
    def create_avatar_video(self, avatar_id, voice_id, text, **kwargs):
        response = requests.post(
            f"{self.BASE_URL}lipsyncs/",
            headers=self.headers,
            json={
                "avatar_id": avatar_id,
                "voice_id": voice_id,
                "input_text": text,
                **kwargs
            }
        )
        return response.json()

# Usage
api = PhanesugcAPI(api_id="your-id", api_key="your-key")

# Create link from URL
link = api.create_link("https://example.com/product")

# Create video
video = api.create_video_from_link(
    link_id=link["id"],
    aspect_ratio="9x16",
    video_length=30,
    language="en",
    target_platform="TikTok"
)

# Check status
status = api.get_video_status(video["id"])
while status["status"] != "done":
    print(f"Progress: {status['progress']}")
    time.sleep(2)
    status = api.get_video_status(video["id"])

print(f"Video ready: {status['video_output']}")
```

---

### cURL Examples

#### Create Link

```bash
curl -X POST \
  https://api.phanesugc.com/api/links/ \
  -H "Content-Type: application/json" \
  -H "X-API-ID: your-api-id" \
  -H "X-API-KEY: your-api-key" \
  -d '{
    "url": "https://example.com/product"
  }'
```

#### Create Video

```bash
curl -X POST \
  https://api.phanesugc.com/api/link_to_videos/ \
  -H "Content-Type: application/json" \
  -H "X-API-ID: your-api-id" \
  -H "X-API-KEY: your-api-key" \
  -d '{
    "link": "link-uuid",
    "aspect_ratio": "9x16",
    "video_length": 30,
    "language": "en",
    "target_platform": "TikTok",
    "webhook_url": "https://example.com/webhook"
  }'
```

#### Check Credits

```bash
curl -X GET \
  https://api.phanesugc.com/api/remaining_credits/ \
  -H "X-API-ID: your-api-id" \
  -H "X-API-KEY: your-api-key"
```

---

## Pricing

### Credit Costs

| Feature | Cost | Unit |
|---------|-------|-------|
| URL to Video (Full) | 4-5 | per 30s |
| URL to Video (Preview) | 1 | per 30s |
| AI Avatar | 5 | per 30s |
| AI Avatar v2 (per scene) | 5 | per 30s |
| Aurora (Fast) | 10 | per 15s |
| Aurora (Standard) | 20 | per 15s |
| Text to Speech | 1 | per 30s |
| Product Video (Preview) | 1 | per image |
| Product Video (Video) | 3 | per video |
| Links | 1 | per link |

### Subscription Plans

| Plan | Credits | Price (EUR) |
|------|---------|--------------|
| Starter | 500 | €89/month |
| Pro | 2,000 | €269/month |
| Enterprise | Custom | Contact sales |

---

## Versioning

API version: `v1`

Current version: `1.0.0`

All endpoints are prefixed with `/api/v1/` or `/api/` for backward compatibility.

---

## Best Practices

### 1. Use Preview Before Render
- Generate preview first (1 credit)
- Review and approve
- Render final video (4 credits)
- Saves costs on不满意 outputs

### 2. Implement Polling for Status
- Poll every 2-5 seconds
- Stop when status is `done` or `failed`
- Use exponential backoff on rate limits

### 3. Use Webhooks for Efficiency
- Provide webhook_url to receive notifications
- Avoid constant polling
- Process results asynchronously

### 4. Handle All Status States
- `pending` - Job created
- `generating` - Processing
- `done` - Complete
- `failed` - Error (check `failed_reason`)

### 5. Implement Retry Logic
- Retry failed requests with exponential backoff
- Max 3 retries
- Differentiate transient vs permanent failures

---

## Migration Notes

### v1.0 → v1.1 (Planned)

- Add Aurora Fast endpoint
- Add Product to Video endpoints
- Enhance error messages
- Add rate limiting improvements

---

## Support

For API issues, contact: api@phanesugc.com

Include in support requests:
- API ID (truncated)
- Request ID (from headers)
- Error code and message
- Timestamp

---

**Last Updated:** 2026-03-20
**Version:** 1.0.0
