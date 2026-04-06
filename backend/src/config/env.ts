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
    // For temporary credentials (STS/SSO), provide all three: ACCESS_KEY_ID, SECRET_ACCESS_KEY, and SESSION_TOKEN
    AWS_ACCESS_KEY_ID: z.string().min(1).optional(),
    AWS_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    AWS_SESSION_TOKEN: z.string().min(1).optional(),
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
    // Monitoring Configuration
    LOG_LEVEL: z.enum(['debug', 'log', 'warn', 'error']).default('log'),
    // Default to 'false' for local dev/CI to avoid GCP client initialization overhead
    // Set to 'true' explicitly in production
    ENABLE_STRUCTURED_LOGGING: z.enum(['true', 'false']).default('false'),
    ENABLE_ERROR_REPORTING: z.enum(['true', 'false']).default('false'),
    ALERT_EMAIL: z.string().email().optional(),
    // Stripe Configuration (optional - only required if payment features are enabled)
    ENABLE_PAYMENTS: z.enum(['true', 'false']).default('false'),
    STRIPE_SECRET_KEY: z.string().min(1).optional(),
    STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
    STRIPE_STARTER_PRICE_ID: z.string().min(1).optional(),
    STRIPE_PRO_PRICE_ID: z.string().min(1).optional(),
    STRIPE_ENTERPRISE_PRICE_ID: z.string().min(1).optional(),
    STRIPE_BILLING_PORTAL_RETURN_URL: z.string().url().optional(),
  })
  .refine(
    (data) => {
      // AWS explicit credentials must be internally consistent:
      // - access key and secret key must be both present or both absent
      // - session token may only be provided when both access key and secret key are provided
      const hasAccessKey = !!data.AWS_ACCESS_KEY_ID;
      const hasSecretKey = !!data.AWS_SECRET_ACCESS_KEY;
      const hasSessionToken = !!data.AWS_SESSION_TOKEN;

      if (hasAccessKey !== hasSecretKey) {
        return false;
      }

      if (hasSessionToken && (!hasAccessKey || !hasSecretKey)) {
        return false;
      }

      return true;
    },
    {
      message:
        'AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must both be provided or both be omitted, and AWS_SESSION_TOKEN may only be provided when both are set',
      path: ['AWS_ACCESS_KEY_ID'],
    },
  )
  .refine(
    (data) => {
      // If payments are enabled, all Stripe config must be provided
      if (data.ENABLE_PAYMENTS === 'true') {
        return !!(
          data.STRIPE_SECRET_KEY &&
          data.STRIPE_WEBHOOK_SECRET &&
          data.STRIPE_STARTER_PRICE_ID &&
          data.STRIPE_PRO_PRICE_ID &&
          data.STRIPE_ENTERPRISE_PRICE_ID &&
          data.STRIPE_BILLING_PORTAL_RETURN_URL
        );
      }
      return true;
    },
    {
      message:
        'All Stripe configuration variables must be provided when ENABLE_PAYMENTS=true',
      path: ['STRIPE_SECRET_KEY'],
    },
  );

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>) {
  return envSchema.parse(config);
}
