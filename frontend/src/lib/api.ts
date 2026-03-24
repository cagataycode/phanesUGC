export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';
const API_BASE_URL = '/api';

// Models based on PRD Section 11.1
export interface AdJobRequest {
  prompt: string;
  platform?: string;
  aspect_ratio: string;
  duration_sec: number;
  language: string;
  tone?: string;
  cta?: string;
  product_info?: {
    name?: string;
    description?: string;
    benefits?: string[];
  };
  urls?: string[];
  subtitle_style?: string;
  voice_id?: string;
}

export interface AdJobResponse {
  id: string;
  status: string;
}

export interface AdJobStatusResponse {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  video_url?: string;
  error?: string;
}

/**
 * Creates a new Ad Video generation job
 */
export async function createAdJob(
  payload: AdJobRequest,
): Promise<AdJobResponse> {
  if (USE_MOCK) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          id: `ad_${Math.random().toString(36).substring(7)}`,
          status: "queued",
        });
      }, 800);
    });
  }

  const res = await fetch(`${API_BASE_URL}/ads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error("Failed to create ad job");
  return res.json();
}

/**
 * Polls the job status
 */
export async function getAdJobStatus(id: string): Promise<AdJobStatusResponse> {
  if (USE_MOCK) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const numericSeed = Number.parseInt(
          id.replace(/\D/g, "").slice(-2) || "0",
          10,
        );
        const timestampBucket = Math.floor(Date.now() / 1500);
        const progress = Math.min(
          ((timestampBucket + numericSeed) % 8) * 15,
          100,
        );

        resolve({
          id,
          status: progress >= 100 ? "done" : "rendering",
          progress,
          stages: {
            scrape: "done",
            brief: progress >= 30 ? "done" : "running",
            script:
              progress >= 45 ? "done" : progress >= 30 ? "running" : "pending",
            assets:
              progress >= 60 ? "done" : progress >= 45 ? "running" : "pending",
            voice:
              progress >= 75 ? "done" : progress >= 60 ? "running" : "pending",
            subtitles:
              progress >= 90 ? "done" : progress >= 75 ? "running" : "pending",
            render:
              progress >= 100 ? "done" : progress >= 90 ? "running" : "pending",
          },
        });
      }, 500);
    });
  }

  const res = await fetch(`${API_BASE_URL}/ads/${id}`);
  if (!res.ok) throw new Error("Failed to fetch ad job status");
  return res.json();
}

/**
 * Retrieves the final video outputs
 */
export async function getAdJobResult(id: string): Promise<AdJobResultResponse> {
  if (USE_MOCK) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          // Mock video (Big Buck Bunny via open storage)
          video_url:
            "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
          thumbnail_url:
            "https://images.unsplash.com/photo-1616469829581-73993eb86b02",
          script: {},
          subtitles: [],
          transcript: [],
          metadata: {},
        });
      }, 600);
    });
  }

  const res = await fetch(`/api/v1/ads/${id}/result`);
  if (!res.ok) throw new Error("Failed to fetch ad job result");
  return res.json();
}
