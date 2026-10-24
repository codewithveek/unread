export interface RetryOptions {
  attempts: number;
  /** First delay; doubles each attempt. */
  baseDelayMs: number;
  /** Return false to stop retrying (e.g. on a 400). */
  shouldRetry?: (error: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(fn: (attempt: number) => Promise<T>, options: RetryOptions): Promise<T> {
  const sleep = options.sleep ?? defaultSleep;
  let lastError: unknown;
  for (let attempt = 1; attempt <= options.attempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt === options.attempts || options.shouldRetry?.(error) === false) break;
      const jitter = Math.random() * options.baseDelayMs * 0.25;
      await sleep(options.baseDelayMs * 2 ** (attempt - 1) + jitter);
    }
  }
  throw lastError;
}
