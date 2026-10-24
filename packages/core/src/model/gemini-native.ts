import { z } from "zod";
import { type CompletionRequest, type CompletionResult, type ModelClient, ModelHttpError } from "./model-client";

const responseSchema = z.object({
  candidates: z
    .array(z.object({ content: z.object({ parts: z.array(z.object({ text: z.string().optional() })).optional() }).optional() }))
    .default([]),
  usageMetadata: z
    .object({ promptTokenCount: z.number().optional(), candidatesTokenCount: z.number().optional() })
    .optional(),
});

export interface GeminiNativeOptions {
  apiKey: string;
  model: string;
  timeoutMs: number;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

/** Gemma via the Gemini API's generateContent, as documented for Gemma (ADR 0005). */
export function createGeminiNativeClient(options: GeminiNativeOptions): ModelClient {
  const base = options.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    name: `gemini:${options.model}`,
    async complete(request: CompletionRequest): Promise<CompletionResult> {
      const response = await fetchImpl(`${base}/models/${options.model}:generateContent`, {
        method: "POST",
        signal: AbortSignal.timeout(options.timeoutMs),
        headers: { "content-type": "application/json", "x-goog-api-key": options.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: request.system }] },
          contents: [{ role: "user", parts: [{ text: request.prompt }] }],
          generationConfig: { temperature: request.temperature ?? 0.4, maxOutputTokens: request.maxTokens ?? 4096 },
        }),
      });
      if (!response.ok) throw new ModelHttpError(response.status, `Gemini ${response.status}: ${(await response.text()).slice(0, 300)}`);
      const data = responseSchema.parse(await response.json());
      const text = (data.candidates[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
      return {
        text,
        model: options.model,
        inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      };
    },
  };
}
