import { withRetry } from "../util/retry";
import { type CompletionRequest, type ModelClient, isRetryable } from "./model-client";

export interface UsageLog {
  record(entry: { model: string; inputTokens: number; outputTokens: number }): void;
}

/** Primary with retries on 429/5xx/timeouts, then the fallback (prd §5). */
export function withFallback(options: {
  primary: ModelClient;
  fallback?: ModelClient;
  usage?: UsageLog;
  attempts?: number;
  baseDelayMs?: number;
}): ModelClient {
  const { primary, fallback, usage, attempts = 3, baseDelayMs = 1_000 } = options;
  const call = (client: ModelClient, request: CompletionRequest) =>
    withRetry(() => client.complete(request), { attempts, baseDelayMs, shouldRetry: isRetryable });
  return {
    name: fallback ? `${primary.name}→${fallback.name}` : primary.name,
    async complete(request) {
      try {
        const result = await call(primary, request);
        usage?.record(result);
        return result;
      } catch (error) {
        if (!fallback || !isRetryable(error)) throw error;
        const result = await call(fallback, request);
        usage?.record(result);
        return result;
      }
    },
  };
}
