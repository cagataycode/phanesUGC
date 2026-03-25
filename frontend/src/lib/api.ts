export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";
const API_BASE_URL = "/api";

// Models based on PRD Section 11.1
export interface AdPromptInputs {
  prompt: string;
  platform?: "tiktok" | "instagram" | "youtube";
  language?: "en" | "de";
  tone?: string;
  target_audience?: string;
  cta?: string;
  product_info?: {
    name?: string;
    description?: string;
    benefits?: string[];
  };
  urls?: string[];
  subtitle_style?: string;
}

export interface AdVeoConfigInputs {
  aspect_ratio: "9:16" | "1:1" | "16:9";
  duration_sec: 8 | 15 | 30 | 60;
  negative_prompt?: string;
  person_generation?: "allow_all" | "allow_adult";
  enhance_prompt?: boolean;
}

export interface AdJobRequest {
  businessId: string;
  productId: string;
  createdBy: string;
  prompt_inputs: AdPromptInputs;
  veo_config: AdVeoConfigInputs;
}

export interface AdJobResponse {
  id: string;
  status: string;
}

export interface AdJobStatusResponse {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  video_url?: string;
  error?: string;
}

export interface AdJobResultResponse {
  video_url: string;
  thumbnail_url?: string;
  script: Record<string, unknown>;
  subtitles: unknown[];
  transcript: unknown[];
  metadata: Record<string, unknown>;
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
export async function getAdJobStatus(
  id: string,
  businessId: string = "test-business-id",
): Promise<AdJobStatusResponse> {
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
          status: progress >= 100 ? "completed" : "processing",
          ...(progress >= 100
            ? {
                video_url:
                  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
              }
            : {}),
        });
      }, 500);
    });
  }

  const res = await fetch(`${API_BASE_URL}/ads/${id}?businessId=${businessId}`);
  if (!res.ok) throw new Error("Failed to fetch ad job status");
  return res.json();
}

/**
 * Retrieves the final video outputs
 */
export async function getAdJobResult(
  id: string,
  businessId: string = "test-business-id",
): Promise<AdJobResultResponse> {
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

  const res = await fetch(
    `${API_BASE_URL}/ads/${id}/result?businessId=${businessId}`,
  );
  if (!res.ok) throw new Error("Failed to fetch ad job result");
  return res.json();
}
