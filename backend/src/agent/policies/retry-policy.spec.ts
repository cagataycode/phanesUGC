import { RetryPolicy } from './retry-policy';

describe('RetryPolicy', () => {
  let policy: RetryPolicy;

  beforeEach(() => {
    policy = new RetryPolicy({
      maxRetries: 2,
      initialDelayMs: 100,
      backoffMultiplier: 2,
      retryableErrors: ['timeout', 'rate limit', 'network error', 'ECONNRESET'],
    });
  });

  describe('execute', () => {
    it('should return result on first success', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const context = { jobId: 'test-job', stage: 'test-stage' };

      const result = await policy.execute(fn, context);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable error and succeed', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce('success');
      const context = { jobId: 'test-job', stage: 'test-stage' };

      const result = await policy.execute(fn, context);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw on non-retryable error immediately', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Validation error'));
      const context = { jobId: 'test-job', stage: 'test-stage' };

      await expect(policy.execute(fn, context)).rejects.toThrow(
        'Validation error',
      );
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should throw after max retries exceeded', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Network timeout'));
      const context = { jobId: 'test-job', stage: 'test-stage' };

      await expect(policy.execute(fn, context)).rejects.toThrow(
        'Network timeout',
      );
      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('isRetryable', () => {
    it('should return true for timeout errors', () => {
      expect(policy.isRetryable(new Error('Request timeout'))).toBe(true);
      expect(policy.isRetryable(new Error('Connection timeout'))).toBe(true);
    });

    it('should return true for rate limit errors', () => {
      expect(policy.isRetryable(new Error('Rate limit exceeded'))).toBe(true);
      expect(policy.isRetryable(new Error('Too many requests'))).toBe(false);
    });

    it('should return true for network errors', () => {
      expect(policy.isRetryable(new Error('Network error occurred'))).toBe(
        true,
      );
      expect(policy.isRetryable(new Error('ECONNRESET'))).toBe(true);
    });

    it('should return false for validation errors', () => {
      expect(policy.isRetryable(new Error('Validation failed'))).toBe(false);
      expect(policy.isRetryable(new Error('Invalid input'))).toBe(false);
    });

    it('should return false for authentication errors', () => {
      expect(policy.isRetryable(new Error('Unauthorized'))).toBe(false);
      expect(policy.isRetryable(new Error('Authentication failed'))).toBe(
        false,
      );
    });

    it('should handle non-Error objects', () => {
      expect(policy.isRetryable('timeout error')).toBe(true);
      expect(policy.isRetryable('validation error')).toBe(false);
    });
  });

  describe('calculateDelay', () => {
    it('should calculate delay with exponential backoff', () => {
      expect(policy.calculateDelay(1)).toBe(100); // 100 * 2^0
      expect(policy.calculateDelay(2)).toBe(200); // 100 * 2^1
      expect(policy.calculateDelay(3)).toBe(400); // 100 * 2^2
    });

    it('should work with different backoff multipliers', () => {
      const customPolicy = new RetryPolicy({
        maxRetries: 3,
        initialDelayMs: 1000,
        backoffMultiplier: 3,
        retryableErrors: ['timeout'],
      });

      expect(customPolicy.calculateDelay(1)).toBe(1000); // 1000 * 3^0
      expect(customPolicy.calculateDelay(2)).toBe(3000); // 1000 * 3^1
      expect(customPolicy.calculateDelay(3)).toBe(9000); // 1000 * 3^2
    });
  });
});
