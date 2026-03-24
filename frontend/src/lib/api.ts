const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api';
export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

// Models based on PRD Section 11.1
export interface AdJobRequest {
  prompt: string;
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
        resolve({
          id,
          status: 'processing',
        });
      }, 500);
    });
  }

  const res = await fetch(`${API_BASE_URL}/ads/${id}`);
  if (!res.ok) throw new Error("Failed to fetch ad job status");
  return res.json();
}
