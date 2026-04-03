import { z } from 'zod';

export const envSchema = z
  .object({
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
    // AWS Bedrock Configuration (Primary LLM Provider)
    // Credentials are optional - if not provided, AWS SDK will use default credential chain
    // (IAM roles, instance profiles, etc.)
    AWS_ACCESS_KEY_ID: z.string().min(1).optional(),
    AWS_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    AWS_REGION: z.string().min(1).default('us-east-1'),
    BEDROCK_MODEL_ID: z
      .string()
      .min(1)
      .default('us.anthropic.claude-sonnet-4-6'),
    // Gemini API (Fallback LLM Provider)
    GEMINI_API_KEY: z.string().min(1).optional(), // Now optional - used as fallback
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
  })
  .refine(
    (data) => {
      // AWS credentials must be both present or both absent
      const hasAccessKey = !!data.AWS_ACCESS_KEY_ID;
      const hasSecretKey = !!data.AWS_SECRET_ACCESS_KEY;
      return hasAccessKey === hasSecretKey;
    },
    {
      message:
        'AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must both be provided or both be omitted',
      path: ['AWS_ACCESS_KEY_ID'],
    },
  );

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>) {
  return envSchema.parse(config);
}
