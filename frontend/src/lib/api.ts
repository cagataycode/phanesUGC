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
  businessId: string,
): Promise<AdJobStatusResponse> {
  const res = await fetch(`${API_BASE_URL}/ads/${id}?businessId=${businessId}`);
  if (!res.ok) throw new Error("Failed to fetch ad job status");
  return res.json();
}

/**
 * Retrieves the final video outputs
 */
export async function getAdJobResult(
  id: string,
  businessId?: string,
): Promise<AdJobResultResponse> {
  const query = businessId
    ? `?businessId=${encodeURIComponent(businessId)}`
    : "";
  const res = await fetch(`${API_BASE_URL}/ads/${id}/result${query}`);
  if (!res.ok) throw new Error("Failed to fetch ad job result");
  return res.json();
}
