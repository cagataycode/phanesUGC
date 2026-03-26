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
  };

  it('should validate and return a valid configuration object', () => {
    const validated = validateEnv(validConfig);

    // Check that defaults are applied
    expect(validated.PORT).toBe(3000);
    expect(validated.NODE_ENV).toBe('development');
    expect(validated.API_PREFIX).toBe('api');
    expect(validated.VERTEX_AI_MODEL_ID).toBe('veo-3.1-fast-generate-001');

    // Check that explicitly provided values are retained
    expect(validated.FIREBASE_PROJECT_ID).toBe('test-project');
    expect(validated.FIREBASE_CLIENT_EMAIL).toBe('test@example.com');
  });

  it('should coerce PORT to a number', () => {
    const configWithStringPort = { ...validConfig, PORT: '8080' };
    const validated = validateEnv(configWithStringPort);
    expect(validated.PORT).toBe(8080);
    expect(typeof validated.PORT).toBe('number');
  });

  it('should throw an error if a required field is missing', () => {
    const invalidConfig: Record<string, unknown> = { ...validConfig };
    delete invalidConfig.FIREBASE_PROJECT_ID;

    expect(() => validateEnv(invalidConfig)).toThrow(/FIREBASE_PROJECT_ID/);
  });

  it('should throw an error if an email is invalid', () => {
    const invalidConfig = {
      ...validConfig,
      FIREBASE_CLIENT_EMAIL: 'not-an-email',
    };
    expect(() => validateEnv(invalidConfig)).toThrow(/Invalid email/);
  });
});
