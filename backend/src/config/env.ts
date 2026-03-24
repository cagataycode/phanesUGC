import { z } from 'zod';

export const envSchema = z.object({
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_PRIVATE_KEY: z.string().min(1),
  GCS_BUCKET_NAME: z.string().min(1),
  GCS_LOCATION: z.string().min(1),
  GCP_PROJECT_ID: z.string().min(1),
  VERTEX_AI_LOCATION: z.string().min(1),
  VERTEX_AI_API_KEY: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PREFIX: z.string().min(1).default('api'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>) {
  return envSchema.parse(config);
}
