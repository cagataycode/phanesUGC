export const USE_MOCK = false;

// Models based on PRD Section 11.1
export interface AdJobRequest {
  prompt: string;
  platform?: string; // Opting to keep it optional since we removed it from UI
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
  status: "queued" | "rendering" | "done" | "failed";
  progress: number;
  stages: Record<string, string>;
}

export interface AdJobResultResponse {
  video_url: string;
  thumbnail_url: string;
  script: Record<string, unknown>;
  subtitles: Record<string, unknown>[];
  transcript: Record<string, unknown>[];
  metadata: Record<string, unknown>;
}

/**
 * Creates a new Ad Video generation job
 */
export async function createAdJob(payload: AdJobRequest): Promise<AdJobResponse> {
  if (USE_MOCK) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          id: `ad_${Math.random().toString(36).substring(7)}`,
          status: "queued"
        });
      }, 800);
    });
  }

  const res = await fetch("/api/v1/ads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error("API Error:", res.status, errorText);
    throw new Error(`Failed to create ad job: ${res.status} ${errorText}`);
  }
  return res.json();
}

/**
 * Polls the job status
 */
export async function getAdJobStatus(id: string): Promise<AdJobStatusResponse> {
  if (USE_MOCK) {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Randomly simulate a progress chunk
        const chunk = Math.floor(Math.random() * 30) + 10;
        resolve({
          id,
          status: "rendering",
          progress: chunk,
          stages: {
            scrape: "done",
            brief: "done",
            script: "running",
            render: "pending"
          }
        });
      }, 500);
    });
  }

  const res = await fetch(`/api/v1/ads/${id}`);
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
          video_url: "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
          thumbnail_url: "https://images.unsplash.com/photo-1616469829581-73993eb86b02",
          script: {},
          subtitles: [],
          transcript: [],
          metadata: {}
        });
      }, 600);
    });
  }

  const res = await fetch(`/api/v1/ads/${id}/result`);
  if (!res.ok) throw new Error("Failed to fetch ad job result");
  return res.json();
}
