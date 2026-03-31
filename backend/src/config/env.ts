import { z } from 'zod';

export const envSchema = z.object({
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().email(),
  FIREBASE_PRIVATE_KEY: z.string().min(1),
  GCS_BUCKET_NAME: z.string().min(1),
  GCS_LOCATION: z.string().min(1),
  GCP_PROJECT_ID: z.string().min(1),
  VERTEX_AI_LOCATION: z.string().min(1),
  VERTEX_AI_MODEL_ID: z.string().min(1).default('veo-3.1-fast-generate-001'),
  VERTEX_OUTPUT_GCS_URI: z.string().min(1).optional(),
  VERTEX_AI_API_KEY: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1), // Required for brief/script/scene generation
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  API_PREFIX: z.string().min(1).default('api'),
  REMOTION_RENDER_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(5 * 60 * 1000),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>) {
  return envSchema.parse(config);
}
