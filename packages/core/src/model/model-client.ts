export interface CompletionRequest {
  system: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface CompletionResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/** Gemma behind an API (prd §5). Implementations: Gemini API (native or OpenAI-compatible), OpenRouter. */
export interface ModelClient {
  readonly name: string;
  complete(request: CompletionRequest): Promise<CompletionResult>;
}

export class ModelHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }

  get retryable(): boolean {
    return this.status === 429 || this.status >= 500;
  }
}

export function isRetryable(error: unknown): boolean {
  if (error instanceof ModelHttpError) return error.retryable;
  // Timeouts and network failures.
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError" || error.name === "TypeError");
}
