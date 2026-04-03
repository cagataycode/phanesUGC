import { validateEnv } from './env';

describe('Environment Configuration Validation (env.ts)', () => {
  const validConfig = {
    FIREBASE_PROJECT_ID: 'test-project',
    FIREBASE_CLIENT_EMAIL: 'test@example.com',
    FIREBASE_PRIVATE_KEY:
      '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
    GCS_BUCKET_NAME: 'test-bucket',
    GCS_LOCATION: 'us-central1',
    GCP_PROJECT_ID: 'test-gcp-project',
    VERTEX_AI_LOCATION: 'us-central1',
    AWS_ACCESS_KEY_ID: 'test-access-key',
    AWS_SECRET_ACCESS_KEY: 'test-secret-key',
    GEMINI_API_KEY: 'test-gemini-key',
  };

  it('should validate and return a valid configuration object', () => {
    const validated = validateEnv(validConfig);

    // Check that defaults are applied
    expect(validated.PORT).toBe(3000);
    expect(validated.NODE_ENV).toBe('development');
    expect(validated.API_PREFIX).toBe('api');
    expect(validated.VERTEX_AI_MODEL_ID).toBe('veo-3.1-fast-generate-001');
    expect(validated.AWS_REGION).toBe('us-east-1');
    expect(validated.BEDROCK_MODEL_ID).toBe('us.anthropic.claude-sonnet-4-6');

    // Check that explicitly provided values are retained
    expect(validated.FIREBASE_PROJECT_ID).toBe('test-project');
    expect(validated.FIREBASE_CLIENT_EMAIL).toBe('test@example.com');
    expect(validated.AWS_ACCESS_KEY_ID).toBe('test-access-key');
    expect(validated.AWS_SECRET_ACCESS_KEY).toBe('test-secret-key');
  });

  it('should coerce PORT to a number', () => {
    const configWithStringPort = { ...validConfig, PORT: '8080' };
    const validated = validateEnv(configWithStringPort);
    expect(validated.PORT).toBe(8080);
    expect(typeof validated.PORT).toBe('number');
  });

  it('should throw an error if an email is invalid', () => {
    const invalidConfig = {
      ...validConfig,
      FIREBASE_CLIENT_EMAIL: 'not-an-email',
    };
    expect(() => validateEnv(invalidConfig)).toThrow(/Invalid email/);
  });

  it('should throw an error if a required field is missing', () => {
    const invalidConfig: Record<string, unknown> = { ...validConfig };
    delete invalidConfig.FIREBASE_PROJECT_ID;

    expect(() => validateEnv(invalidConfig)).toThrow(/FIREBASE_PROJECT_ID/);
  });

  it('should throw an error if only one AWS credential is provided', () => {
    const invalidConfig = {
      ...validConfig,
      AWS_ACCESS_KEY_ID: 'test-key',
    };
    delete invalidConfig.AWS_SECRET_ACCESS_KEY;

    expect(() => validateEnv(invalidConfig)).toThrow(
      /AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must both be provided or both be omitted/,
    );
  });

  it('should allow GEMINI_API_KEY to be optional (for fallback)', () => {
    const configWithoutGemini = { ...validConfig };
    delete configWithoutGemini.GEMINI_API_KEY;

    const validated = validateEnv(configWithoutGemini);
    expect(validated.GEMINI_API_KEY).toBeUndefined();
  });

  it('should allow AWS credentials to be optional (for IAM role auth)', () => {
    const configWithoutAWSCreds: Record<string, unknown> = { ...validConfig };
    delete configWithoutAWSCreds.AWS_ACCESS_KEY_ID;
    delete configWithoutAWSCreds.AWS_SECRET_ACCESS_KEY;

    const validated = validateEnv(configWithoutAWSCreds);
    expect(validated.AWS_ACCESS_KEY_ID).toBeUndefined();
    expect(validated.AWS_SECRET_ACCESS_KEY).toBeUndefined();
    expect(validated.AWS_REGION).toBe('us-east-1'); // Region still has default
    expect(validated.BEDROCK_MODEL_ID).toBe('us.anthropic.claude-sonnet-4-6');
  });
});
