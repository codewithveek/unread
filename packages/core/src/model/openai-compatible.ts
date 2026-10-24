import { z } from "zod";
import { type CompletionRequest, type CompletionResult, type ModelClient, ModelHttpError } from "./model-client";

const responseSchema = z.object({
  model: z.string().optional(),
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable().optional() }) })).default([]),
  usage: z.object({ prompt_tokens: z.number().optional(), completion_tokens: z.number().optional() }).optional(),
});

export interface OpenAICompatibleOptions {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  extraHeaders?: Record<string, string>;
  fetchImpl?: typeof fetch;
}

/** Chat Completions over any OpenAI-compatible API: OpenRouter, or the Gemini API's compatibility layer. */
export function createOpenAICompatibleClient(options: OpenAICompatibleOptions): ModelClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    name: `${options.name}:${options.model}`,
    async complete(request: CompletionRequest): Promise<CompletionResult> {
      const response = await fetchImpl(`${options.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        signal: AbortSignal.timeout(options.timeoutMs),
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${options.apiKey}`,
          ...options.extraHeaders,
        },
        body: JSON.stringify({
          model: options.model,
          temperature: request.temperature ?? 0.4,
          max_tokens: request.maxTokens ?? 4096,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.prompt },
          ],
        }),
      });
      if (!response.ok) {
        throw new ModelHttpError(response.status, `${options.name} ${response.status}: ${(await response.text()).slice(0, 300)}`);
      }
      const data = responseSchema.parse(await response.json());
      return {
        text: data.choices[0]?.message.content ?? "",
        model: data.model ?? options.model,
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      };
    },
  };
}
