import { fetchWithAuth } from "./api-client";

export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

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
  aspect_ratio: "9:16" | "16:9";
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
  video_url?: string;
  source_video_url?: string;
  thumbnail_url?: string;
  script: Record<string, unknown> | null;
  creativeBrief: Record<string, unknown> | null;
  subtitles: unknown[];
  transcript: unknown[];
  metadata: Record<string, unknown>;
  generationConfig: {
    platform?: string;
    aspectRatio?: string;
    durationSec?: number;
  };
  timestamps: {
    createdAt: string | null;
    updatedAt: string | null;
  };
  pipeline: {
    status: string;
    stages: Record<string, string>;
  };
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

  const res = await fetchWithAuth(
    `/ads?businessId=${encodeURIComponent(payload.businessId)}`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );

  if (!res.ok) throw new Error("Failed to create ad job");
  return res.json();
}

/**
 * Polls the job status
 */
export async function getAdJobStatus(
  id: string,
  businessId: string,
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
                  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
              }
            : {}),
        });
      }, 500);
    });
  }

  const res = await fetchWithAuth(
    `/ads/${id}?businessId=${encodeURIComponent(businessId)}`,
  );
  if (!res.ok) throw new Error("Failed to fetch ad job status");
  return res.json();
}

/**
 * Retrieves the final video outputs
 */
export async function getAdJobResult(
  id: string,
  businessId: string,
): Promise<AdJobResultResponse> {
  const query = `?businessId=${encodeURIComponent(businessId)}`;
  const res = await fetchWithAuth(`/ads/${id}/result${query}`);
  if (!res.ok) throw new Error("Failed to fetch ad job result");
  return res.json();
}

export interface AdJobListItem {
  id: string;
  prompt: string;
  platform: string;
  status: string;
  createdAt: { _seconds: number; _nanoseconds: number };
  output?: {
    videoStorageKey: string;
    thumbnailStorageKey?: string;
  };
}

/**
 * Lists all ad jobs for a business
 */
export async function listAdJobs(businessId: string): Promise<AdJobListItem[]> {
  const res = await fetchWithAuth(
    `/ads?businessId=${encodeURIComponent(businessId)}`,
  );
  if (!res.ok) throw new Error("Failed to list ad jobs");
  return res.json();
}
