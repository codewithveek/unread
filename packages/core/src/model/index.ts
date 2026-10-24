import type { CoreConfig } from "../config";
import { type UsageLog, withFallback } from "./fallback";
import { createGeminiNativeClient } from "./gemini-native";
import type { ModelClient } from "./model-client";
import { createOpenAICompatibleClient } from "./openai-compatible";

export * from "./fallback";
export * from "./gemini-native";
export * from "./model-client";
export * from "./openai-compatible";
export * from "./structured";

export class ModelNotConfiguredError extends Error {}

/** Gemini API (Gemma) first, OpenRouter (Gemma) as fallback; either alone works. */
export function modelClientFromConfig(config: CoreConfig, usage?: UsageLog): ModelClient {
  const env = config.env;
  const gemini = env.GEMINI_API_KEY
    ? env.GEMINI_API_STYLE === "openai"
      ? createOpenAICompatibleClient({
          name: "gemini",
          baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
          apiKey: env.GEMINI_API_KEY,
          model: env.GEMMA_MODEL,
          timeoutMs: env.MODEL_TIMEOUT_MS,
        })
      : createGeminiNativeClient({ apiKey: env.GEMINI_API_KEY, model: env.GEMMA_MODEL, timeoutMs: env.MODEL_TIMEOUT_MS })
    : undefined;
  const openrouter = env.OPENROUTER_API_KEY
    ? createOpenAICompatibleClient({
        name: "openrouter",
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: env.OPENROUTER_API_KEY,
        model: env.OPENROUTER_MODEL,
        timeoutMs: env.MODEL_TIMEOUT_MS,
        extraHeaders: { "HTTP-Referer": env.APP_BASE_URL, "X-Title": "Unread" },
      })
    : undefined;
  const primary = gemini ?? openrouter;
  if (!primary) throw new ModelNotConfiguredError("Set GEMINI_API_KEY or OPENROUTER_API_KEY");
  return withFallback({ primary, fallback: gemini ? openrouter : undefined, usage });
}
